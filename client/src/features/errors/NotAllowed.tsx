import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export function NotAllowed() {
  return (
    <EmptyState
      icon="alert"
      title="You don't have access to this page"
      action={<ButtonLink to="/applications">Back to applications</ButtonLink>}
    >
      Ask an administrator if you think you should.
    </EmptyState>
  );
}

export function NotFound() {
  return (
    <EmptyState
      icon="inbox"
      title="Nothing here"
      action={<ButtonLink to="/applications">Back to applications</ButtonLink>}
    >
      The page you were looking for doesn't exist or has moved.
    </EmptyState>
  );
}
