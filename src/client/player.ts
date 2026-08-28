import { byId, clear, confetti, deviceId, el } from './dom.ts';
import { connectSocket } from './io.ts';
import type { PlayerState, PodiumRow } from '../shared/types.ts';

const match = /\/j\/([A-Za-z0-9]{4})/.exec(window.location.pathname);
const code = (match?.[1] ?? new URLSearchParams(window.location.search).get('code') ?? '')
  .toUpperCase();
const device = deviceId();

const bodyEl = byId('body');
const meEl = byId('me');
const statusEl = byId('status');
const errorEl = byId('error');

const socket = connectSocket();

let state: PlayerState | null = null;
let renderKey = '';
let pendingVote: string | null = null;

socket.on('connect', () => {
  statusEl.textContent = 'Connectée';
  errorEl.textContent = '';
  socket.emit('player:join', { code, deviceId: device }, (response: { ok: boolean; error?: string }) => {
    if (!response?.ok) {
      renderKey = 'error';
      clear(bodyEl);
      const box = el('div', 'phone__state');
      box.appendChild(el('h2', undefined, 'Partie introuvable'));
      box.appendChild(el('p', undefined, response?.error ?? 'Vérifie le code auprès de l’hôte.'));
      bodyEl.appendChild(box);
    }
  });
});

socket.on('disconnect', () => {
  statusEl.textContent = 'Reconnexion…';
});

socket.on('player:state', ((next: PlayerState) => {
  state = next;
  pendingVote = null;
  render();
}) as (...args: never[]) => void);

function render(): void {
  const s = state;
  if (!s) return;

  meEl.textContent = s.me ? `💗 ${s.me.name}` : 'Choisis ton prénom';

  const key = [
    s.phase,
    s.me?.id ?? '-',
    s.question?.id ?? '-',
    s.myVote ?? '-',
    s.result ? s.result.questionId : '-',
    s.phase === 'lobby' ? s.availableNames.map((n) => n.id).join(',') : '',
  ].join('|');
  if (key === renderKey) {
    updateLive(s);
    return;
  }
  renderKey = key;
  clear(bodyEl);
  errorEl.textContent = '';

  if (!s.me) {
    renderNamePicker(s);
    return;
  }

  switch (s.phase) {
    case 'lobby':
      renderWaiting("Tu es dans la partie 💗", 'On attend que tout le monde arrive…');
      break;
    case 'voting':
      if (s.myVote) renderVoted(s);
      else renderVote(s);
      break;
    case 'locked':
      renderWaiting(
        s.myVote ? "C'EST VOTÉ 💗" : 'Votes fermés',
        s.myVote ? 'Les votes sont fermés. Regarde l’écran 👀' : 'Trop tard pour cette question 😅',
      );
      break;
    case 'countdown':
      renderWaiting('👀', 'Regarde l’écran…');
      break;
    case 'result':
      renderResult(s);
      break;
    case 'finished':
      renderFinal(s);
      break;
    default:
      break;
  }
}

function renderNamePicker(s: PlayerState): void {
  const wrap = el('div');
  wrap.appendChild(el('p', 'eyebrow', `Partie ${s.code}`));
  wrap.appendChild(el('h2', 'phone__question', 'Qui es-tu ?'));
  const grid = el('div', 'name-picker');
  for (const person of s.availableNames) {
    const btn = el('button', 'choice', person.name);
    btn.addEventListener('click', () => {
      errorEl.textContent = '';
      socket.emit('player:claim', { participantId: person.id }, (response: { ok: boolean; error?: string }) => {
        if (!response?.ok) errorEl.textContent = response?.error ?? 'Impossible.';
      });
    });
    grid.appendChild(btn);
  }
  if (s.availableNames.length === 0) {
    wrap.appendChild(el('p', 'muted', 'Tous les prénoms sont pris. Demande à l’hôte.'));
  }
  wrap.appendChild(grid);
  bodyEl.appendChild(wrap);
}

function renderWaiting(title: string, text: string): void {
  const box = el('div', 'phone__state');
  box.appendChild(el('h2', undefined, title));
  box.appendChild(el('p', undefined, text));
  bodyEl.appendChild(box);
}

function renderVote(s: PlayerState): void {
  const wrap = el('div');
  wrap.appendChild(el('div', 'phone__question', s.question?.text ?? ''));
  const list = el('div', 'choice-list');
  for (const choice of s.choices) {
    const isSelf = choice.id === s.me?.id;
    const btn = el('button', isSelf ? 'choice choice--self' : 'choice', choice.name);
    btn.disabled = isSelf;
    if (isSelf) btn.title = 'On ne vote pas pour soi 😄';
    else {
      btn.addEventListener('click', () => {
        if (pendingVote) return;
        pendingVote = choice.id;
        btn.classList.add('choice--picked');
        for (const other of list.querySelectorAll('button')) other.disabled = true;
        socket.emit('player:vote', { choiceId: choice.id }, (response: { ok: boolean; error?: string }) => {
          if (!response?.ok) {
            pendingVote = null;
            errorEl.textContent = response?.error ?? 'Vote refusé.';
            btn.classList.remove('choice--picked');
            for (const other of list.querySelectorAll('button')) {
              other.disabled = other.classList.contains('choice--self');
            }
          }
        });
      });
    }
    list.appendChild(btn);
  }
  wrap.appendChild(list);
  bodyEl.appendChild(wrap);
}

function renderVoted(s: PlayerState): void {
  const box = el('div', 'phone__state');
  box.appendChild(el('h2', undefined, "C'EST VOTÉ 💗"));
  box.appendChild(el('p', undefined, 'Maintenant on attend les autres…'));
  const meter = el('p', 'muted');
  meter.id = 'phone-meter';
  meter.textContent = `${s.votesReceived} / ${s.expectedVoters} votes`;
  box.appendChild(meter);
  bodyEl.appendChild(box);
}

function renderResult(s: PlayerState): void {
  const result = s.result;
  const box = el('div', 'phone__state');
  if (!result || result.winners.length === 0) {
    box.appendChild(el('h2', undefined, 'Aucun vote'));
    box.appendChild(el('p', undefined, 'On passe à la suivante 💗'));
    bodyEl.appendChild(box);
    return;
  }
  box.appendChild(el('div', 'result__crown', '👑'));
  box.appendChild(
    el('h2', undefined, result.winners.map((w) => w.name).join(' & ')),
  );
  const first = result.winners[0] as PodiumRow;
  box.appendChild(el('p', undefined, `${first.votes} vote${first.votes > 1 ? 's' : ''} · ${first.percent} %`));
  box.appendChild(el('p', 'muted', result.comment));
  bodyEl.appendChild(box);
  if (result.winners.some((w) => w.participantId === s.me?.id)) confetti(24);
}

function renderFinal(s: PlayerState): void {
  const box = el('div', 'phone__state');
  box.appendChild(el('h2', undefined, "C'EST FINI 💗"));
  box.appendChild(
    el('p', undefined, s.finalStats ? `${s.finalStats.totalVotes} votes exprimés` : 'Merci d’avoir joué !'),
  );
  box.appendChild(el('p', 'muted', 'Regarde l’écran pour les statistiques 👀'));
  bodyEl.appendChild(box);
}

function updateLive(s: PlayerState): void {
  const meter = document.getElementById('phone-meter');
  if (meter) meter.textContent = `${s.votesReceived} / ${s.expectedVoters} votes`;
}
