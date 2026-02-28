type AuthListener = (token: string | null) => void;

const listeners: Set<AuthListener> = new Set();

export function onAuthChange(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitAuthChange(token: string | null) {
  listeners.forEach(fn => fn(token));
}
