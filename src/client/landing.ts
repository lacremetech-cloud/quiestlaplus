import { byId } from './dom.ts';

const errorLine = byId('error');
const codeInput = byId<HTMLInputElement>('code');

byId<HTMLButtonElement>('create').addEventListener('click', async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  button.disabled = true;
  errorLine.textContent = '';
  try {
    const response = await fetch('/api/rooms', { method: 'POST' });
    if (!response.ok) throw new Error('bad status');
    const data = (await response.json()) as { code: string; hostToken: string };
    localStorage.setItem(`qelp:host:${data.code}`, data.hostToken);
    window.location.href = `/host?code=${data.code}`;
  } catch {
    errorLine.textContent = 'Impossible de créer la partie. Réessaie.';
    button.disabled = false;
  }
});

function join(): void {
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== 4) {
    errorLine.textContent = 'Le code fait 4 caractères.';
    return;
  }
  window.location.href = `/j/${code}`;
}

byId<HTMLButtonElement>('join').addEventListener('click', join);
codeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') join();
});
