export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Element #${id} introuvable`);
  return node as T;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

/** Identifiant local persistant : un refresh ne permet pas de revoter. */
export function deviceId(): string {
  const KEY = 'qelp:device';
  let id = '';
  try {
    id = localStorage.getItem(KEY) ?? '';
  } catch {
    id = '';
  }
  if (id.length < 8) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* mode navigation privee : l'id reste valable le temps de l'onglet */
    }
  }
  return id;
}

const CONFETTI_COLORS = ['#d6336c', '#f0a0be', '#e9e0f5', '#f7ece7', '#b085d1'];

/** Confettis discrets : quelques rubans, puis nettoyage automatique. */
export function confetti(count = 30): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = el('div', 'confetti');
  for (let i = 0; i < count; i++) {
    const piece = el('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background =
      CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] as string;
    piece.style.animationDuration = `${2.6 + Math.random() * 2.4}s`;
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 6200);
}
