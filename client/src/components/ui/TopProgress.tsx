import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { cx } from '@/lib/cx';
import styles from './TopProgress.module.css';

// A thin bar at the top of the window while the user is waiting on the server: first loads,
// new filters or pages, and mutations. Background polling and refetches of data already on
// screen stay silent. It appears after a short delay so fast responses don't flicker it.
export function TopProgress() {
  const loading = useIsFetching({ predicate: (query) => query.state.data === undefined });
  const mutating = useIsMutating();
  return <div className={cx(styles.bar, (loading > 0 || mutating > 0) && styles.active)} aria-hidden="true" />;
}
