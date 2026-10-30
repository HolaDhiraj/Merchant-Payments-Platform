import { Skeleton } from './Skeleton';
import styles from './Table.module.css';

// Placeholder rows shaped like the real table, so the layout doesn't jump when data arrives.
export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} aria-hidden="true">
          {Array.from({ length: columns }, (_, column) => (
            <td key={column} className={column === 0 ? styles.serial : undefined}>
              <Skeleton width={column === 0 ? 16 : column === 1 ? '70%' : `${40 + ((row + column) % 3) * 15}%`} />
              {column === 1 && (
                <span className={styles.secondary}>
                  <Skeleton width="45%" height={10} />
                </span>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
