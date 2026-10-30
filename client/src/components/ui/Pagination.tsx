import { Button } from './Button';
import styles from './Pagination.module.css';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onChange(page: number): void;
}

export function Pagination({ page, pageSize, totalItems, totalPages, onChange }: PaginationProps) {
  if (totalItems === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <span className="tabular">
        {first}–{last} of {totalItems.toLocaleString('en')}
      </span>
      <div className={styles.controls}>
        <Button size="sm" variant="ghost" icon="chevronLeft" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)} />
        <span className="tabular">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <Button size="sm" variant="ghost" icon="chevronRight" aria-label="Next page" disabled={page >= totalPages} onClick={() => onChange(page + 1)} />
      </div>
    </nav>
  );
}
