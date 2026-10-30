// Access token storage. sessionStorage scopes the token to one browser tab and clears it when
// the tab closes; the token is short-lived (15 min by default) and there is no refresh token.
// When the token runs out the session ends on its own (not at the next click), and the reason is
// remembered so the sign-in page can say "Session expired" instead of appearing out of nowhere.

const STORAGE_KEY = 'merchant-desk.session';
const END_REASON_KEY = 'merchant-desk.session-ended';

export type EndReason = 'signed-out' | 'expired';

interface StoredSession {
  token: string;
  expiresAt: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

export const session = {
  token(): string | null {
    const stored = read();
    if (!stored) return null;
    if (Date.now() >= stored.expiresAt) {
      // Ending notifies subscribers; defer it so it never runs during a React render.
      queueMicrotask(() => session.end('expired'));
      return null;
    }
    return stored.token;
  },

  start(token: string, expiresInSeconds: number): void {
    const value: StoredSession = { token, expiresAt: Date.now() + expiresInSeconds * 1000 };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    sessionStorage.removeItem(END_REASON_KEY);
    scheduleExpiry(value.expiresAt);
    notify();
  },

  end(reason: EndReason = 'signed-out'): void {
    if (!read()) return;
    clearTimeout(expiryTimer);
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.setItem(END_REASON_KEY, reason);
    notify();
  },

  // Why the last session ended, until the sign-in page has shown it.
  endReason(): EndReason | null {
    const reason = sessionStorage.getItem(END_REASON_KEY);
    return reason === 'expired' || reason === 'signed-out' ? reason : null;
  },

  clearEndReason(): void {
    sessionStorage.removeItem(END_REASON_KEY);
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

function scheduleExpiry(expiresAt: number): void {
  clearTimeout(expiryTimer);
  // Browsers cap timers at ~24.8 days; tokens live minutes, so this is always in range.
  expiryTimer = setTimeout(() => session.end('expired'), Math.max(0, expiresAt - Date.now()));
}

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

// A session restored after a page reload still ends on time.
const restored = read();
if (restored) scheduleExpiry(restored.expiresAt);
