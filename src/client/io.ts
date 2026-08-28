/** Petit typage du client socket.io servi par le serveur (/socket.io/socket.io.js). */
export interface ClientSocket {
  connected: boolean;
  on(event: string, listener: (...args: never[]) => void): ClientSocket;
  emit(event: string, ...args: unknown[]): ClientSocket;
}

declare const io: (options?: Record<string, unknown>) => ClientSocket;

export function connectSocket(): ClientSocket {
  return io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
}
