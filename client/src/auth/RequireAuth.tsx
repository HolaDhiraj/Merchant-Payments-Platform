import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@/api/types';
import { PageLoader } from '@/components/ui/Spinner';
import { NotAllowed } from '@/features/errors/NotAllowed';
import { useAuth } from './AuthProvider';
import { session } from './session';

interface RequireAuthProps {
  roles?: Role[];
  // Only the change-password screen may be shown while the password is temporary.
  allowTemporaryPassword?: boolean;
  children: ReactNode;
}

export const CHANGE_PASSWORD_PATH = '/change-password';

// Route guard. The API enforces every permission itself; this only keeps users away from
// screens they could not use anyway.
export function RequireAuth({ roles, allowTemporaryPassword, children }: RequireAuthProps) {
  const { user, isRestoring } = useAuth();
  const location = useLocation();

  if (isRestoring) return <PageLoader label="Restoring your session" />;
  if (!user) {
    // Remember the page so signing in again returns to it, unless the user chose to sign out.
    const from = session.endReason() === 'signed-out' ? undefined : location.pathname + location.search;
    return <Navigate to="/login" replace state={from && { from }} />;
  }
  if (user.mustChangePassword && !allowTemporaryPassword) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }
  if (roles && !roles.includes(user.role)) return <NotAllowed />;
  return <>{children}</>;
}
