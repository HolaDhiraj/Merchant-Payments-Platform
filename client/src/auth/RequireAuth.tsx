import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@/api/types';
import { PageLoader } from '@/components/ui/Spinner';
import { NotAllowed } from '@/features/errors/NotAllowed';
import { useAuth } from './AuthProvider';

interface RequireAuthProps {
  roles?: Role[];
  children: ReactNode;
}

// Route guard. The API enforces every permission itself; this only keeps users away from
// screens they could not use anyway.
export function RequireAuth({ roles, children }: RequireAuthProps) {
  const { user, isRestoring } = useAuth();
  const location = useLocation();

  if (isRestoring) return <PageLoader label="Restoring your session" />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (roles && !roles.includes(user.role)) return <NotAllowed />;
  return <>{children}</>;
}
