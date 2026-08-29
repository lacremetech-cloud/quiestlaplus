import { byId, clear, confetti, el } from './dom.ts';
import { connectSocket } from './io.ts';
import { COUNTDOWN_STEP_MS, COUNTDOWN_STEPS } from '../shared/config.ts';
import type { HostState, PodiumRow, RosterEntry } from '../shared/types.ts';

const params = new URLSearchParams(window.location.search);
const code = (params.get('code') ?? '').toUpperCase();
const hostToken = localStorage.getItem(`qelp:host:${code}`) ?? '';

const bodyEl = byId('body');
const controlsEl = byId('controls');
const topRightEl = byId('top-right');
const toastsEl = byId('toasts');

const socket = connectSocket();

let state: HostState | null = null;
let editing = false;
let renderKey = '';
let knownArrivals = new Set<string>();
let countdownTimers: number[] = [];

if (!code || !hostToken) {
  bodyEl.appendChild(
    banner(
      'Session hôte introuvable',
      "Cet écran doit être ouvert depuis l'appareil qui a créé la partie.",
    ),
  );
} else {
  socket.on('connect', () => {
    socket.emit('host:join', { code, hostToken }, (response: { ok: boolean; error?: string }) => {
      if (!response?.ok) {
        clear(bodyEl);
        clear(controlsEl);
        bodyEl.appendChild(banner('Partie introuvable', response?.error ?? ''));
      }
    });
  });

  socket.on('host:state', ((next: HostState) => {
    const first = state === null;
    state = next;
    if (first) knownArrivals = new Set(next.roster.filter((r) => r.claimed).map((r) => r.id));
    render();
  }) as (...args: never[]) => void);
}

function banner(title: string, text: string): HTMLElement {
  const card = el('div', 'card setup');
  card.appendChild(el('h2', undefined, title));
  card.appendChild(el('p', 'muted', text));
  const link = el('a');
  link.href = '/';
  link.appendChild(Object.assign(el('button', 'btn'), { textContent: "Retour à l'accueil" }));
  card.appendChild(link);
  return card;
}

// ------------------------------------------------------------------ rendu

function render(): void {
  const s = state;
  if (!s) return;

  const key = `${editing ? 'edit' : s.phase}|${s.questionIndex}|${s.result ? s.result.questionId : ''}`;
  if (key !== renderKey) {
    renderKey = key;
    clearCountdownTimers();
    clear(bodyEl);
    clear(controlsEl);
    if (editing) renderSetup(s);
    else if (s.phase === 'lobby') renderLobby(s);
    else if (s.phase === 'voting' || s.phase === 'locked') renderQuestion(s);
    else if (s.phase === 'countdown') renderCountdown();
    else if (s.phase === 'result') renderResult(s);
    else renderFinal(s);
    renderControls(s);
  }

  renderTopRight(s);
  updateLive(s);
}

function renderTopRight(s: HostState): void {
  clear(topRightEl);
  if (s.phase === 'lobby' || editing) {
    topRightEl.appendChild(el('div', 'pill-code', s.code));
  } else if (s.phase !== 'finished') {
    topRightEl.appendChild(
      el('div', 'pill-code', `${s.questionIndex + 1} / ${s.totalQuestions}`),
    );
  }
}

function renderControls(s: HostState): void {
  if (editing) {
    controlsEl.appendChild(
      button('ENREGISTRER', 'btn', () => {
        const names = [...document.querySelectorAll<HTMLInputElement>('.name-row input')]
          .map((input) => input.value)
          .filter((value) => value.trim().length > 0);
        socket.emit('host:setNames', { names });
        editing = false;
        renderKey = '';
        render();
      }),
    );
    controlsEl.appendChild(
      button('Annuler', 'btn btn--ghost', () => {
        editing = false;
        renderKey = '';
        render();
      }),
    );
    return;
  }

  switch (s.phase) {
    case 'lobby': {
      const start = button("C'EST PARTI 💗", 'btn btn--big', () => socket.emit('host:start'));
      start.id = 'start-btn';
      start.disabled = s.roster.length < 2;
      controlsEl.appendChild(start);
      controlsEl.appendChild(
        button('Modifier les prénoms', 'btn btn--ghost', () => {
          editing = true;
          renderKey = '';
          render();
        }),
      );
      break;
    }
    case 'voting':
      controlsEl.appendChild(
        button('Fermer les votes', 'btn btn--ghost', () => socket.emit('host:closeVotes')),
      );
      controlsEl.appendChild(
        button('RÉVÉLER 👀', 'btn btn--big', () => socket.emit('host:reveal')),
      );
      break;
    case 'locked':
      controlsEl.appendChild(
        button('Rouvrir les votes', 'btn btn--ghost', () => socket.emit('host:reopenVotes')),
      );
      controlsEl.appendChild(
        button('RÉVÉLER 👀', 'btn btn--big', () => socket.emit('host:reveal')),
      );
      break;
    case 'result':
      controlsEl.appendChild(
        button('QUESTION SUIVANTE →', 'btn btn--big', () => socket.emit('host:next')),
      );
      controlsEl.appendChild(
        button('Terminer la partie', 'btn btn--ghost', () => socket.emit('host:finish')),
      );
      break;
    case 'finished': {
      const link = el('a');
      link.href = '/';
      link.appendChild(
        Object.assign(el('button', 'btn'), { textContent: 'Nouvelle partie 💗' }),
      );
      controlsEl.appendChild(link);
      break;
    }
    default:
      break;
  }
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = el('button', className, label);
  node.addEventListener('click', onClick);
  return node;
}

function renderSetup(s: HostState): void {
  const card = el('div', 'card setup');
  card.appendChild(el('p', 'eyebrow', 'Avant de commencer'));
  card.appendChild(el('h2', undefined, 'Les participantes'));
  card.appendChild(
    el('p', 'muted', 'Modifie, supprime ou ajoute les vrais prénoms. Minimum 2 participantes.'),
  );

  const grid = el('div', 'name-grid');
  const addRow = (value: string): void => {
    const row = el('div', 'name-row');
    const input = el('input');
    input.type = 'text';
    input.value = value;
    input.maxLength = 24;
    input.placeholder = 'Prénom';
    const remove = button('×', '', () => row.remove());
    remove.title = 'Supprimer';
    row.append(input, remove);
    grid.appendChild(row);
  };
  for (const entry of s.roster) addRow(entry.name);
  card.appendChild(grid);

  card.appendChild(
    button('+ Ajouter un prénom', 'btn btn--ghost', () => {
      addRow('');
      const inputs = grid.querySelectorAll<HTMLInputElement>('input');
      inputs[inputs.length - 1]?.focus();
    }),
  );
  bodyEl.appendChild(card);
}

function renderLobby(s: HostState): void {
  const wrap = el('div', 'lobby');

  const left = el('div');
  const qr = el('div', 'qr');
  if (s.qrDataUrl) {
    const img = el('img');
    img.src = s.qrDataUrl;
    img.alt = 'QR code pour rejoindre la partie';
    qr.appendChild(img);
  }
  left.appendChild(qr);
  const codeBig = el('div', 'code-big', `CODE : ${s.code}`);
  left.appendChild(codeBig);
  left.appendChild(el('p', 'muted', s.joinUrl));

  const right = el('div');
  right.appendChild(el('h1', 'lobby__title', 'QUI EST LA PLUS ?'));
  right.appendChild(el('p', 'lobby__sub', 'Scanne pour rejoindre 👀'));
  right.appendChild(el('div', 'counter', ''));
  const players = el('div', 'players');
  players.id = 'players';
  right.appendChild(players);

  const warning = el('p', 'lobby-warning');
  warning.id = 'lobby-warning';
  right.appendChild(warning);

  wrap.append(left, right);
  bodyEl.appendChild(wrap);
}

function renderQuestion(s: HostState): void {
  const wrap = el('div', 'question');
  wrap.appendChild(el('div', 'question__emoji', s.question?.emoji ?? '💗'));
  wrap.appendChild(
    el('p', 'eyebrow question__index', `Question ${s.questionIndex + 1} / ${s.totalQuestions}`),
  );
  wrap.appendChild(el('h1', 'question__text', s.question?.text ?? ''));

  const meter = el('div', 'votes-meter');
  const count = el('div', 'votes-meter__count');
  count.id = 'vote-count';
  const bar = el('div', 'votes-meter__bar');
  const fill = el('div', 'votes-meter__fill');
  fill.id = 'vote-fill';
  bar.appendChild(fill);
  const hint = el('div', 'muted');
  hint.id = 'vote-hint';
  meter.append(count, bar, hint);
  wrap.appendChild(meter);

  const preview = el('div', 'choices-preview');
  for (const choice of s.choices) preview.appendChild(el('span', 'chip', choice.name));
  wrap.appendChild(preview);

  bodyEl.appendChild(wrap);
}

function renderCountdown(): void {
  const wrap = el('div', 'countdown');
  wrap.appendChild(el('p', 'eyebrow', 'Résultats de la soirée'));
  const number = el('div', 'countdown__number', String(COUNTDOWN_STEPS));
  wrap.appendChild(number);
  bodyEl.appendChild(wrap);

  const show = (value: string): void => {
    number.textContent = value;
    number.style.animation = 'none';
    void number.offsetWidth;
    number.style.animation = '';
  };
  countdownTimers = [];
  for (let step = 1; step < COUNTDOWN_STEPS; step++) {
    const value = String(COUNTDOWN_STEPS - step);
    countdownTimers.push(
      window.setTimeout(() => show(value), step * COUNTDOWN_STEP_MS),
    );
  }
}

function clearCountdownTimers(): void {
  for (const timer of countdownTimers) window.clearTimeout(timer);
  countdownTimers = [];
}

function renderResult(s: HostState): void {
  const result = s.result;
  if (!result) return;

  const wrap = el('div', 'result');

  if (result.winners.length === 0) {
    wrap.appendChild(el('div', 'result__crown', '🤍'));
    wrap.appendChild(el('h1', 'result__name', 'Aucun vote'));
  } else {
    wrap.appendChild(el('div', 'result__crown', result.winners.length > 1 ? '👑👑' : '👑'));
    wrap.appendChild(
      el('h1', 'result__name', result.winners.map((w) => w.name).join(' & ').toUpperCase()),
    );
    const first = result.winners[0] as PodiumRow;
    wrap.appendChild(
      el('div', 'result__score', `${first.votes} vote${first.votes > 1 ? 's' : ''} · ${first.percent} %`),
    );
  }

  const podium = el('div', 'podium');
  const medals = ['🥇', '🥈', '🥉'];
  result.podium.forEach((row, index) => {
    const line = el('div', `podium__row podium__row--${row.rank}`);
    line.style.animationDelay = `${0.35 + index * 0.18}s`;
    line.appendChild(el('span', undefined, medals[row.rank - 1] ?? '✨'));
    line.appendChild(el('span', undefined, row.name));
    line.appendChild(
      el('span', 'muted', `${row.votes} vote${row.votes > 1 ? 's' : ''} · ${row.percent} %`),
    );
    podium.appendChild(line);
  });
  wrap.appendChild(podium);

  const comment = el('div', 'comment');
  if (result.strengthLine) comment.appendChild(el('div', 'comment__strength', result.strengthLine));
  comment.appendChild(el('div', 'comment__text', result.comment));
  wrap.appendChild(comment);

  // Repere pour l'hote : moment ou tout le monde a ete proposee autant de fois.
  if (s.balanced) {
    const badge = el(
      'p',
      'balance-note',
      `✓ Tout le monde est passé ${s.appearancesEach} fois — bon moment pour s'arrêter`,
    );
    wrap.appendChild(badge);
  }

  bodyEl.appendChild(wrap);

  const pieces =
    result.strength === 'landslide' ? 70 : result.strength === 'tie' ? 44 : 26;
  window.setTimeout(() => confetti(pieces), 220);
}

function renderFinal(s: HostState): void {
  const stats = s.finalStats;
  const wrap = el('div', 'final');
  wrap.appendChild(el('h1', 'final__title', "C'EST FINI 💗"));
  if (!stats) {
    bodyEl.appendChild(wrap);
    return;
  }

  const grid = el('div', 'stats');
  const addStat = (icon: string, label: string, value: string, delay: number): void => {
    const card = el('div', 'stat');
    card.style.animationDelay = `${delay}s`;
    card.appendChild(el('div', 'stat__icon', icon));
    card.appendChild(el('div', 'stat__label', label));
    card.appendChild(el('div', 'stat__value', value));
    grid.appendChild(card);
  };

  const queens = stats.queens.length
    ? `${stats.queens.map((q) => q.name).join(' & ')} — ${stats.queens[0]?.wins ?? 0} question${(stats.queens[0]?.wins ?? 0) > 1 ? 's' : ''}`
    : '—';
  const cited = stats.mostCited.length
    ? `${stats.mostCited.map((m) => m.name).join(' & ')} — ${stats.mostCited[0]?.votes ?? 0} votes`
    : '—';

  addStat('👑', 'Reine du jeu', queens, 0.1);
  addStat('✨', 'La plus citée', cited, 0.25);
  addStat('🗳️', 'Votes exprimés', `${stats.totalVotes}`, 0.4);
  addStat('💬', 'Questions jouées', `${stats.questionsPlayed}`, 0.55);
  wrap.appendChild(grid);

  const closing = el('div', 'comment');
  closing.style.animationDelay = '0.8s';
  closing.appendChild(el('div', 'comment__text', stats.closingLine));
  wrap.appendChild(closing);

  bodyEl.appendChild(wrap);
  window.setTimeout(() => confetti(90), 320);
}

// ------------------------------------------------------ mises a jour vivantes

function updateLive(s: HostState): void {
  if (editing) return;

  if (s.phase === 'lobby') {
    updateLobby(s);
    const start = document.getElementById('start-btn') as HTMLButtonElement | null;
    if (start) start.disabled = s.roster.length < 2;
    return;
  }

  if (s.phase === 'voting' || s.phase === 'locked') {
    const count = document.getElementById('vote-count');
    const fill = document.getElementById('vote-fill');
    const hint = document.getElementById('vote-hint');
    const expected = Math.max(s.expectedVoters, 1);
    if (count) count.textContent = `${s.votesReceived} / ${s.expectedVoters} votes reçus`;
    if (fill) fill.style.width = `${Math.min(100, (s.votesReceived / expected) * 100)}%`;
    if (hint) {
      hint.textContent =
        s.phase === 'locked'
          ? 'Votes fermés — prête pour la révélation 👀'
          : 'Les résultats restent cachés jusqu’à la révélation.';
    }
  }
}

function updateLobby(s: HostState): void {
  const counter = bodyEl.querySelector('.counter');
  const players = document.getElementById('players');
  if (!counter || !players) return;

  const ready = s.roster.filter((r) => r.claimed).length;
  counter.textContent =
    ready === 0
      ? 'En attente des premières joueuses…'
      : `${ready} joueuse${ready > 1 ? 's' : ''} prête${ready > 1 ? 's' : ''}`;

  // Les prenoms non reclames restent proposes au vote : on previent l'hote
  // avant qu'il lance la partie, c'est le seul moment ou c'est corrigeable.
  const missing = s.roster.filter((r) => !r.claimed);
  const warning = document.getElementById('lobby-warning');
  if (warning) {
    warning.textContent =
      missing.length === 0
        ? ''
        : `⚠️ ${missing.length} prénom${missing.length > 1 ? 's' : ''} n'${missing.length > 1 ? 'ont' : 'a'} pas rejoint (${missing
            .map((m) => m.name)
            .join(', ')}). ${missing.length > 1 ? 'Elles seront' : 'Elle sera'} quand même proposé${missing.length > 1 ? 'es' : 'e'} au vote — retire-${missing.length > 1 ? 'les' : 'la'} si ${missing.length > 1 ? 'elles ne viennent' : 'elle ne vient'} pas.`;
  }

  const arrivals = s.roster.filter((r) => r.claimed);
  for (const entry of arrivals) {
    if (!knownArrivals.has(entry.id)) {
      knownArrivals.add(entry.id);
      toast(`✨ ${entry.name} vient d'arriver`);
    }
  }
  for (const id of [...knownArrivals]) {
    if (!arrivals.some((a) => a.id === id)) knownArrivals.delete(id);
  }

  // Mise a jour incrementale : on n'anime que les nouvelles pastilles.
  const ordered: RosterEntry[] = [...arrivals, ...s.roster.filter((r) => !r.claimed)];
  const existing = new Map<string, HTMLElement>();
  for (const node of players.querySelectorAll<HTMLElement>('[data-id]')) {
    existing.set(node.dataset.id as string, node);
  }
  for (const [id, node] of existing) {
    if (!ordered.some((entry) => entry.id === id)) node.remove();
  }
  let previous: HTMLElement | null = null;
  for (const entry of ordered) {
    let node = existing.get(entry.id);
    if (!node) {
      node = el('span', 'chip', entry.name);
      node.dataset.id = entry.id;
    }
    node.textContent = entry.name;
    node.className = entry.claimed ? 'chip' : 'chip chip--waiting';
    if (previous) previous.after(node);
    else players.prepend(node);
    previous = node;
  }
}

const MAX_TOASTS = 4;

function toast(message: string): void {
  const node = el('div', 'toast', message);
  toastsEl.appendChild(node);
  // Avec 20 arrivees quasi simultanees, on ne garde que les dernieres.
  while (toastsEl.childElementCount > MAX_TOASTS) toastsEl.firstElementChild?.remove();
  window.setTimeout(() => node.classList.add('toast--out'), 3200);
  window.setTimeout(() => node.remove(), 3800);
}
