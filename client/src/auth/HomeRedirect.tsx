import { Navigate } from 'react-router-dom';
import { homePathFor } from '@/lib/roles';
import { useCurrentUser } from './AuthProvider';

// "/" sends platform staff to onboarding and merchant users to their portal.
export function HomeRedirect() {
  const user = useCurrentUser();
  return <Navigate to={homePathFor(user.role)} replace />;
}
