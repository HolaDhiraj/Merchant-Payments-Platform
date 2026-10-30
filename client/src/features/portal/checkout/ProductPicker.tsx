import { useState } from 'react';
import { useCategories, useProducts } from '@/api/portalQueries';
import type { Product } from '@/api/types';
import { PriceTag } from '@/components/portal/PriceTag';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/SearchField';
import { Skeleton } from '@/components/ui/Skeleton';
import { cx } from '@/lib/cx';
import styles from './Checkout.module.css';

interface ProductPickerProps {
  currency: string;
  quantityOf(productId: string): number;
  onAdd(product: Product): void;
}

// Tap a product to add it to the order. Only products on sale are listed.
export function ProductPicker({ currency, quantityOf, onAdd }: ProductPickerProps) {
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const categories = useCategories();
  const products = useProducts({ q: q || undefined, categoryId: categoryId || undefined, activeOnly: true, page: 1, pageSize: 60 });

  return (
    <section className={styles.picker} aria-label="Products">
      <div className={styles.pickerTools}>
        <SearchField label="Search products" placeholder="Search name or SKU" value={q} onSearch={setQ} />
        <div className={styles.chips} role="group" aria-label="Category">
          <button type="button" className={styles.chip} aria-pressed={categoryId === ''} onClick={() => setCategoryId('')}>
            All
          </button>
          {categories.data?.map((category) => (
            <button
              key={category.id}
              type="button"
              className={styles.chip}
              aria-pressed={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
              {category.discountPercent ? <span className={styles.chipOff}>−{category.discountPercent}%</span> : null}
            </button>
          ))}
        </div>
      </div>

      {products.data && products.data.items.length === 0 ? (
        <EmptyState icon="tag" title={q || categoryId ? 'Nothing matches' : 'No products on sale'}>
          {q || categoryId ? 'Try another search or category.' : 'Products added in the Products page appear here.'}
        </EmptyState>
      ) : (
        <div className={cx(styles.grid, products.isPlaceholderData && styles.stale)}>
          {!products.data &&
            Array.from({ length: 8 }, (_, index) => (
              <div key={index} className={styles.productCard} aria-hidden="true">
                <Skeleton width="70%" />
                <Skeleton width="40%" height={10} />
              </div>
            ))}
          {products.data?.items.map((product) => {
            const quantity = quantityOf(product.id);
            return (
              <button
                key={product.id}
                type="button"
                className={cx(styles.productCard, quantity > 0 && styles.inCart)}
                onClick={() => onAdd(product)}
                aria-label={`Add ${product.name}`}
              >
                {quantity > 0 && <span className={styles.qtyBadge}>{quantity}</span>}
                <span className={styles.productName}>{product.name}</span>
                <span className={cx(styles.productSku, 'mono')}>{product.sku}</span>
                <span className={styles.productPrice}>
                  <PriceTag price={product.price} currency={currency} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
