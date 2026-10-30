import type { Price } from '@/api/types';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/format';
import styles from './PriceTag.module.css';

// Final price, with the "was" price struck through and the percentage when discounted.
export function PriceTag({ price, currency, size = 'md' }: { price: Price; currency: string; size?: 'md' | 'lg' }) {
  const discounted = price.discountPercent > 0;
  return (
    <span className={cx(styles.price, size === 'lg' && styles.large)}>
      <span className={cx(styles.final, 'mono')}>{formatMoney(price.finalPriceMinor, currency)}</span>
      {discounted && (
        <>
          <s className={cx(styles.was, 'mono')} aria-label={`was ${formatMoney(price.listPriceMinor, currency)}`}>
            {formatMoney(price.listPriceMinor, currency)}
          </s>
          <span className={styles.off}>−{price.discountPercent}%</span>
        </>
      )}
    </span>
  );
}
