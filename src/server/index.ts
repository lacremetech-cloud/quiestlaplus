import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import { Room } from './game.ts';
import { COUNTDOWN_MS } from '../shared/config.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/server/index.js -> racine du projet
const ROOT = path.resolve(__dirname, '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const PORT = Number(process.env.PORT ?? 3000);
const ROOM_TTL_MS = 8 * 60 * 60 * 1000;

const app = express();
app.use(express.json({ limit: '64kb' }));
app.set('trust proxy', true);

const server = http.createServer(app);
const io = new Server(server, {
  // 20 telephones : les valeurs par defaut suffisent largement.
  pingInterval: 20000,
  pingTimeout: 25000,
});

interface RoomEntry {
  room: Room;
  hostToken: string;
  countdown?: NodeJS.Timeout;
}

const rooms = new Map<string, RoomEntry>();

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode(): string {
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
  } while (rooms.has(code));
  return code;
}

function baseUrlFrom(req: express.Request): string {
  const envUrl = process.env.PUBLIC_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] ?? req.protocol;
  const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.get('host') ?? `localhost:${PORT}`;
  return `${proto}://${host}`;
}

// ------------------------------------------------------------------ routes

app.post('/api/rooms', async (req, res) => {
  const code = makeCode();
  const joinUrl = `${baseUrlFrom(req)}/j/${code}`;
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 520,
      color: { dark: '#2b1420', light: '#ffffff' },
    });
  } catch {
    qrDataUrl = '';
  }
  const hostToken = randomUUID();
  rooms.set(code, { room: new Room({ code, joinUrl, qrDataUrl }), hostToken });
  res.json({ code, hostToken, joinUrl });
});

app.get('/api/rooms/:code', (req, res) => {
  const entry = rooms.get(String(req.params.code).toUpperCase());
  if (!entry) {
    res.status(404).json({ ok: false, error: 'Partie introuvable' });
    return;
  }
  res.json({ ok: true, code: entry.room.code, phase: entry.room.getPhase() });
});

app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/host', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'host.html')));
app.get('/j/:code', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'play.html')));
app.get('/play', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'play.html')));
app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

app.use(express.static(PUBLIC_DIR, { maxAge: '1h' }));

// ---------------------------------------------------------------- realtime

interface SocketData {
  code?: string;
  role?: 'host' | 'player';
  deviceId?: string;
}

function hostRoom(code: string): string {
  return `host:${code}`;
}
function playerRoom(code: string): string {
  return `play:${code}`;
}

function broadcastHost(code: string): void {
  const entry = rooms.get(code);
  if (!entry) return;
  io.to(hostRoom(code)).emit('host:state', entry.room.hostState());
}

async function broadcastPlayers(code: string): Promise<void> {
  const entry = rooms.get(code);
  if (!entry) return;
  const sockets = await io.in(playerRoom(code)).fetchSockets();
  for (const s of sockets) {
    const deviceId = (s.data as SocketData).deviceId;
    if (!deviceId) continue;
    s.emit('player:state', entry.room.playerState(deviceId));
  }
}

function broadcastAll(code: string): void {
  broadcastHost(code);
  void broadcastPlayers(code);
}

io.on('connection', (socket) => {
  const data = socket.data as SocketData;

  socket.on('host:join', (payload: { code?: string; hostToken?: string }, ack?: (r: unknown) => void) => {
    const code = String(payload?.code ?? '').toUpperCase();
    const entry = rooms.get(code);
    if (!entry) {
      ack?.({ ok: false, error: 'Partie introuvable' });
      return;
    }
    if (payload?.hostToken !== entry.hostToken) {
      ack?.({ ok: false, error: 'Session hôte invalide' });
      return;
    }
    data.code = code;
    data.role = 'host';
    void socket.join(hostRoom(code));
    ack?.({ ok: true });
    socket.emit('host:state', entry.room.hostState());
  });

  socket.on('player:join', (payload: { code?: string; deviceId?: string }, ack?: (r: unknown) => void) => {
    const code = String(payload?.code ?? '').toUpperCase();
    const deviceId = String(payload?.deviceId ?? '');
    const entry = rooms.get(code);
    if (!entry) {
      ack?.({ ok: false, error: 'Partie introuvable' });
      return;
    }
    if (deviceId.length < 8) {
      ack?.({ ok: false, error: 'Identifiant invalide' });
      return;
    }
    data.code = code;
    data.role = 'player';
    data.deviceId = deviceId;
    void socket.join(playerRoom(code));
    entry.room.markOnline(deviceId);
    ack?.({ ok: true });
    socket.emit('player:state', entry.room.playerState(deviceId));
    broadcastHost(code);
  });

  const withHost = (fn: (entry: RoomEntry, code: string) => void) => {
    return (): void => {
      if (data.role !== 'host' || !data.code) return;
      const entry = rooms.get(data.code);
      if (!entry) return;
      fn(entry, data.code);
    };
  };

  socket.on('host:setNames', (payload: { names?: unknown }) => {
    if (data.role !== 'host' || !data.code) return;
    const entry = rooms.get(data.code);
    if (!entry) return;
    entry.room.setRoster(Array.isArray(payload?.names) ? (payload.names as string[]) : []);
    broadcastAll(data.code);
  });

  socket.on('host:start', withHost((entry, code) => {
    if (entry.room.start()) broadcastAll(code);
  }));

  socket.on('host:closeVotes', withHost((entry, code) => {
    if (entry.room.closeVotes()) broadcastAll(code);
  }));

  socket.on('host:reopenVotes', withHost((entry, code) => {
    if (entry.room.reopenVotes()) broadcastAll(code);
  }));

  /** Le decompte n'existe plus qu'a la fin de partie. */
  const scheduleFinale = (entry: RoomEntry, code: string): void => {
    if (entry.room.getPhase() !== 'countdown') return;
    if (entry.countdown) clearTimeout(entry.countdown);
    entry.countdown = setTimeout(() => {
      entry.countdown = undefined;
      if (entry.room.completeFinale()) broadcastAll(code);
    }, COUNTDOWN_MS);
  };

  socket.on('host:reveal', withHost((entry, code) => {
    if (entry.room.revealResult()) broadcastAll(code);
  }));

  socket.on('host:next', withHost((entry, code) => {
    if (!entry.room.nextQuestion()) return;
    broadcastAll(code);
    scheduleFinale(entry, code);
  }));

  socket.on('host:finish', withHost((entry, code) => {
    if (!entry.room.beginFinale()) return;
    broadcastAll(code);
    scheduleFinale(entry, code);
  }));

  socket.on('player:claim', (payload: { participantId?: string }, ack?: (r: unknown) => void) => {
    if (data.role !== 'player' || !data.code || !data.deviceId) return;
    const entry = rooms.get(data.code);
    if (!entry) return;
    const result = entry.room.claim(data.deviceId, String(payload?.participantId ?? ''));
    ack?.(result);
    socket.emit('player:state', entry.room.playerState(data.deviceId));
    broadcastAll(data.code);
  });

  socket.on('player:vote', (payload: { choiceId?: string }, ack?: (r: unknown) => void) => {
    if (data.role !== 'player' || !data.code || !data.deviceId) return;
    const entry = rooms.get(data.code);
    if (!entry) return;
    const result = entry.room.vote(data.deviceId, String(payload?.choiceId ?? ''));
    ack?.(result);
    socket.emit('player:state', entry.room.playerState(data.deviceId));
    if (result.ok) broadcastAll(data.code);
  });

  socket.on('disconnect', () => {
    if (data.role === 'player' && data.code && data.deviceId) {
      const entry = rooms.get(data.code);
      if (entry) {
        entry.room.markOffline(data.deviceId);
        broadcastHost(data.code);
      }
    }
  });
});

// Menage : une soiree ne dure pas 8 heures.
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of rooms) {
    if (now - entry.room.lastActivityAt > ROOM_TTL_MS) {
      if (entry.countdown) clearTimeout(entry.countdown);
      rooms.delete(code);
    }
  }
}, 15 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`✨ Qui est la plus ? → http://localhost:${PORT}`);
});
