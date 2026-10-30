import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, usersApi } from '@/api/endpoints';
import { queryKeys } from '@/api/queries';
import type { Role, User } from '@/api/types';
import { session } from './session';

interface AuthState {
  user: User | null;
  // True while a stored token is being exchanged for the user's profile.
  isRestoring: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): void;
  hasRole(...roles: Role[]): boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const token = useSyncExternalStore(session.subscribe, session.token);

  const me = useQuery({
    queryKey: [...queryKeys.me, token],
    queryFn: usersApi.me,
    enabled: token !== null,
    staleTime: Infinity,
    retry: false,
  });

  const signIn = useCallback(async (email: string, password: string) => {
    const issued = await authApi.login(email, password);
    session.start(issued.accessToken, issued.expiresIn);
  }, []);

  const signOut = useCallback(() => session.end(), []);

  // Whenever the session ends (sign out, expiry, revoked token) drop everything cached,
  // so nothing fetched as one user can be shown to the next.
  useEffect(() => {
    if (token === null) client.clear();
  }, [token, client]);

  const user = token ? (me.data ?? null) : null;

  const value = useMemo<AuthState>(
    () => ({
      user,
      isRestoring: token !== null && me.isPending,
      signIn,
      signOut,
      hasRole: (...roles) => (user ? roles.includes(user.role) : false),
    }),
    [user, token, me.isPending, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

// Convenience for components rendered only behind <RequireAuth>.
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used outside an authenticated route');
  return user;
}
