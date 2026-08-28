import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { io, type Socket } from 'socket.io-client';
import type { HostState, PlayerState } from '../src/shared/types.ts';

const PORT = 4599;
const BASE = `http://127.0.0.1:${PORT}`;

let server: ChildProcess;

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`${BASE}/healthz`);
      if (response.ok) return;
    } catch {
      /* pas encore pret */
    }
    await delay(120);
  }
  throw new Error('le serveur ne démarre pas');
}

/** Attend le prochain evenement satisfaisant le predicat. */
function waitFor<T>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean,
  label = event,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout: ${label}`));
    }, 8000);
    const handler = (payload: T): void => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

function connected(socket: Socket): Promise<void> {
  return new Promise<void>((resolve) => {
    socket.on('connect', () => resolve());
  });
}

function emitAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise<T>((resolve) => socket.emit(event, payload, resolve));
}

test.before(async () => {
  server = spawn(
    process.execPath,
    ['--experimental-strip-types', 'src/server/index.ts'],
    { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' },
  );
  await waitForServer();
});

test.after(() => {
  server?.kill();
});

test('partie complète avec 20 téléphones', async () => {
  const created = (await (await fetch(`${BASE}/api/rooms`, { method: 'POST' })).json()) as {
    code: string;
    hostToken: string;
    joinUrl: string;
  };
  assert.match(created.code, /^[A-Z0-9]{4}$/);
  assert.match(created.joinUrl, /\/j\/[A-Z0-9]{4}$/);

  const host = io(BASE, { transports: ['websocket'] });
  await connected(host);
  const joined = await emitAck<{ ok: boolean }>(host, 'host:join', {
    code: created.code,
    hostToken: created.hostToken,
  });
  assert.equal(joined.ok, true);

  // Un token invalide ne donne pas la main sur la partie.
  const intruder = io(BASE, { transports: ['websocket'] });
  await connected(intruder);
  const refused = await emitAck<{ ok: boolean }>(intruder, 'host:join', {
    code: created.code,
    hostToken: 'nope',
  });
  assert.equal(refused.ok, false);
  intruder.close();

  const names = Array.from({ length: 20 }, (_, i) => `Joueuse${i + 1}`);
  const rosterReady = waitFor<HostState>(host, 'host:state', (s) => s.roster.length === 20);
  host.emit('host:setNames', { names });
  const lobby = await rosterReady;
  assert.equal(lobby.phase, 'lobby');

  // --- 20 telephones rejoignent et reservent un prenom -------------------
  const players: { socket: Socket; deviceId: string; name: string }[] = [];
  for (let i = 0; i < 20; i++) {
    const socket = io(BASE, { transports: ['websocket'], forceNew: true });
    await connected(socket);
    const deviceId = `device-integration-${i}-${Math.random().toString(36).slice(2)}`;
    const ack = await emitAck<{ ok: boolean }>(socket, 'player:join', {
      code: created.code,
      deviceId,
    });
    assert.equal(ack.ok, true);
    players.push({ socket, deviceId, name: names[i] as string });
  }

  await Promise.all(
    players.map(async (player, index) => {
      const state = await waitFor<PlayerState>(player.socket, 'player:state', (s) => s.me === null || s.me !== null);
      const target = state.availableNames.find((n) => n.name === player.name);
      assert.ok(target, `prénom introuvable pour ${player.name}`);
      const ack = await emitAck<{ ok: boolean }>(player.socket, 'player:claim', {
        participantId: target.id,
      });
      assert.equal(ack.ok, true, `claim refusé pour ${index}`);
    }),
  );

  const allReady = await waitFor<HostState>(
    host,
    'host:state',
    (s) => s.roster.filter((r) => r.claimed).length === 20,
  );
  assert.equal(allReady.connectedCount, 20);

  // --- lancement ---------------------------------------------------------
  const votingState = waitFor<HostState>(host, 'host:state', (s) => s.phase === 'voting');
  host.emit('host:start');
  const voting = await votingState;
  assert.equal(voting.choices.length, 6);
  assert.equal(voting.votesReceived, 0);

  // Chaque telephone recoit la question et les 6 memes prenoms.
  const playerStates = await Promise.all(
    players.map((p) => waitFor<PlayerState>(p.socket, 'player:state', (s) => s.phase === 'voting')),
  );
  for (const state of playerStates) {
    assert.equal(state.choices.length, 6);
    assert.equal(state.question?.id, voting.question?.id);
    assert.equal(state.myVote, null);
  }

  // --- votes simultanes --------------------------------------------------
  const allVoted = waitFor<HostState>(host, 'host:state', (s) => s.votesReceived === 20);
  await Promise.all(
    players.map(async (player, index) => {
      const state = playerStates[index] as PlayerState;
      const target = state.choices.find((c) => c.id !== state.me?.id);
      const ack = await emitAck<{ ok: boolean }>(player.socket, 'player:vote', {
        choiceId: target!.id,
      });
      assert.equal(ack.ok, true);
    }),
  );
  const voted = await allVoted;
  assert.equal(voted.votesReceived, 20);
  // Rien n'est revele automatiquement.
  assert.equal(voted.phase, 'voting');
  assert.equal(voted.result, null);

  // --- double vote refuse ------------------------------------------------
  const first = players[0]!;
  const firstState = playerStates[0] as PlayerState;
  const other = firstState.choices.find(
    (c) => c.id !== firstState.me?.id && c.id !== firstState.choices[0]?.id,
  );
  const second = await emitAck<{ ok: boolean; error?: string }>(first.socket, 'player:vote', {
    choiceId: other!.id,
  });
  assert.equal(second.ok, false);
  assert.match(second.error ?? '', /déjà voté/);

  // --- vote pour soi refuse ---------------------------------------------
  const selfVoter = players.find((_, i) => {
    const state = playerStates[i] as PlayerState;
    return state.choices.some((c) => c.id === state.me?.id);
  });
  if (selfVoter) {
    const index = players.indexOf(selfVoter);
    const state = playerStates[index] as PlayerState;
    const ack = await emitAck<{ ok: boolean; error?: string }>(selfVoter.socket, 'player:vote', {
      choiceId: state.me!.id,
    });
    assert.equal(ack.ok, false);
  }

  // --- reconnexion : meme deviceId, le vote est conserve ------------------
  first.socket.close();
  await delay(150);
  const reconnected = io(BASE, { transports: ['websocket'], forceNew: true });
  await connected(reconnected);
  const rejoinState = waitFor<PlayerState>(reconnected, 'player:state', () => true);
  await emitAck(reconnected, 'player:join', { code: created.code, deviceId: first.deviceId });
  const restored = await rejoinState;
  assert.equal(restored.me?.name, first.name);
  assert.ok(restored.myVote, 'le vote doit survivre à un refresh');
  const revote = await emitAck<{ ok: boolean }>(reconnected, 'player:vote', {
    choiceId: restored.choices.find((c) => c.id !== restored.me?.id)!.id,
  });
  assert.equal(revote.ok, false);
  first.socket = reconnected;

  // --- revelation : immediate, sans decompte ------------------------------
  let sawCountdown = false;
  const watchCountdown = (state: HostState): void => {
    if (state.phase === 'countdown') sawCountdown = true;
  };
  host.on('host:state', watchCountdown);
  const revealed = waitFor<HostState>(host, 'host:state', (s) => s.phase === 'result');
  host.emit('host:reveal');
  const result = await revealed;
  assert.equal(sawCountdown, false, 'aucun décompte entre deux questions');
  assert.ok(result.result);
  assert.equal(result.result!.totalVotes, 20);
  assert.ok(result.result!.winners.length >= 1);
  assert.ok(result.result!.podium.length >= 1);
  assert.ok(result.result!.comment.length > 0);
  assert.ok(!JSON.stringify(result).includes('device-integration'));

  // --- question suivante --------------------------------------------------
  const nextQuestion = waitFor<HostState>(
    host,
    'host:state',
    (s) => s.phase === 'voting' && s.questionIndex === 1,
  );
  host.emit('host:next');
  const second2 = await nextQuestion;
  assert.equal(second2.votesReceived, 0);
  assert.notEqual(second2.question?.id, voting.question?.id);
  const playerNext = await waitFor<PlayerState>(
    players[1]!.socket,
    'player:state',
    (s) => s.question?.id === second2.question?.id,
  );
  assert.equal(playerNext.myVote, null);

  // --- fin de partie : la seule etape qui passe par le decompte 3-2-1 -------
  const finalCountdown = waitFor<HostState>(host, 'host:state', (s) => s.phase === 'countdown');
  const finished = waitFor<HostState>(host, 'host:state', (s) => s.phase === 'finished');
  host.emit('host:finish');
  const counting = await finalCountdown;
  assert.equal(counting.finalStats, null, 'les stats restent cachées pendant le décompte');
  const end = await finished;
  host.off('host:state', watchCountdown);
  assert.ok(end.finalStats);
  assert.equal(end.finalStats!.questionsPlayed, 1);
  assert.equal(end.finalStats!.totalVotes, 20);

  host.close();
  for (const player of players) player.socket.close();
  await delay(120);
});
