// Access token storage. sessionStorage scopes the token to one browser tab and clears it when
// the tab closes; the token is short-lived (15 min by default) and there is no refresh token.

const STORAGE_KEY = 'merchant-desk.session';

interface StoredSession {
  token: string;
  expiresAt: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export const session = {
  token(): string | null {
    const stored = read();
    if (!stored) return null;
    if (Date.now() >= stored.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored.token;
  },

  start(token: string, expiresInSeconds: number): void {
    const value: StoredSession = { token, expiresAt: Date.now() + expiresInSeconds * 1000 };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    notify();
  },

  end(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    notify();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

function read(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}
