import { useMerchantScope } from '@/api/merchantScope';
import { useState } from 'react';
import { useCategories, useDeleteCategory, useMerchantProfile, useProducts } from '@/api/portalQueries';
import type { Category, Product } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { PriceTag } from '@/components/portal/PriceTag';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { SearchField } from '@/components/ui/SearchField';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { serialNumber } from '@/components/ui/tableSerial';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import table from '@/components/ui/Table.module.css';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { useUrlFilters } from '@/lib/useUrlFilters';
import { CategoryDialog } from './CategoryDialog';
import { ProductDialog } from './ProductDialog';
import styles from './Catalog.module.css';

type View = 'products' | 'categories';

// The merchant's catalogue. Everyone can browse it; only the merchant admin edits it.
export function ProductsPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('MERCHANT_ADMIN');
  const { oversight } = useMerchantScope();
  const { params, update } = useUrlFilters();
  const view = (params.get('view') as View | null) ?? 'products';
  const [editingProduct, setEditingProduct] = useState<Product | 'new' | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | 'new' | null>(null);
  const currency = useMerchantProfile().data?.currency ?? 'USD';

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={oversight ? 'What this merchant sells, with prices and discounts.' : 'What you sell, with prices and discounts.'}
        actions={
          canEdit &&
          (view === 'products' ? (
            <Button variant="primary" icon="plus" onClick={() => setEditingProduct('new')}>
              Add product
            </Button>
          ) : (
            <Button variant="primary" icon="plus" onClick={() => setEditingCategory('new')}>
              Add category
            </Button>
          ))
        }
      />
      <div className={styles.toolbar}>
        <Tabs
          label="Catalogue view"
          value={view}
          options={[
            { value: 'products', label: 'Products' },
            { value: 'categories', label: 'Categories' },
          ]}
          onChange={(next) => update({ view: next === 'products' ? undefined : next, page: undefined, q: undefined, category: undefined })}
        />
      </div>

      {view === 'products' ? (
        <ProductTable currency={currency} canEdit={canEdit} onEdit={setEditingProduct} />
      ) : (
        <CategoryTable canEdit={canEdit} onEdit={setEditingCategory} />
      )}

      {editingProduct && (
        <ProductDialog
          product={editingProduct === 'new' ? null : editingProduct}
          currency={currency}
          onClose={() => setEditingProduct(null)}
        />
      )}
      {editingCategory && (
        <CategoryDialog category={editingCategory === 'new' ? null : editingCategory} onClose={() => setEditingCategory(null)} />
      )}
    </>
  );
}

function ProductTable({ currency, canEdit, onEdit }: { currency: string; canEdit: boolean; onEdit(product: Product): void }) {
  const { params, page, update } = useUrlFilters();
  const q = params.get('q') ?? '';
  const categoryId = params.get('category') ?? '';
  const categories = useCategories();
  const query = useProducts({ q: q || undefined, categoryId: categoryId || undefined, page });
  const data = query.data;

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <SearchField label="Search products" placeholder="Name or SKU" value={q} onSearch={(value) => update({ q: value || undefined, page: undefined })} />
          <Select
            className={styles.categoryFilter}
            aria-label="Category"
            value={categoryId}
            onChange={(event) => update({ category: event.target.value || undefined, page: undefined })}
          >
            <option value="">All categories</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {query.isError ? (
        <Callout tone="danger" title="Couldn't load products">
          {errorMessage(query.error)}
        </Callout>
      ) : (
        <Panel flush>
          {data && data.totalItems === 0 ? (
            <EmptyState icon="tag" title={q || categoryId ? 'No matching products' : 'No products yet'}>
              {canEdit ? 'Add the products you sell to start taking payments.' : 'Your admin adds the products you sell.'}
            </EmptyState>
          ) : (
            <>
              <div className={cx(table.wrap, query.isPlaceholderData && table.stale)}>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th className={table.serial}>S.No</th>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!data && <TableSkeleton columns={6} />}
                    {data?.items.map((product, index) => (
                      <tr key={product.id} className={cx(canEdit && table.clickable)} onClick={canEdit ? () => onEdit(product) : undefined}>
                        <td className={table.serial}>{serialNumber(data.page, data.pageSize, index)}</td>
                        <td>
                          <span className={table.primary}>{product.name}</span>
                          <span className={cx(table.secondary, 'mono')}>{product.sku}</span>
                        </td>
                        <td className={table.muted}>{product.categoryName ?? '—'}</td>
                        <td>
                          <PriceTag price={product.price} currency={currency} />
                        </td>
                        <td>
                          {product.isActive ? (
                            <Badge tone="success" dot>
                              On sale
                            </Badge>
                          ) : (
                            <Badge dot>Hidden</Badge>
                          )}
                        </td>
                        <td className={table.muted}>{formatRelative(product.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data && (
                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  totalItems={data.totalItems}
                  totalPages={data.totalPages}
                  onChange={(next) => update({ page: next === 1 ? undefined : String(next) })}
                />
              )}
            </>
          )}
        </Panel>
      )}
    </>
  );
}

function CategoryTable({ canEdit, onEdit }: { canEdit: boolean; onEdit(category: Category): void }) {
  const categories = useCategories();
  const remove = useDeleteCategory();
  const toast = useToast();
  const [deleting, setDeleting] = useState<Category | null>(null);

  function deleteCategory(category: Category) {
    remove.mutate(category.id, {
      onSuccess: () => {
        toast.success(`${category.name} deleted`);
        setDeleting(null);
      },
      onError: (error) => toast.error(errorMessage(error)),
    });
  }

  if (categories.isError) {
    return (
      <Callout tone="danger" title="Couldn't load categories">
        {errorMessage(categories.error)}
      </Callout>
    );
  }
  return (
    <Panel flush>
      {categories.data && categories.data.length === 0 ? (
        <EmptyState icon="tag" title="No categories yet">
          Group products into categories to discount a whole group at once.
        </EmptyState>
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead>
              <tr>
                <th className={table.serial}>S.No</th>
                <th>Category</th>
                <th>Discount</th>
                <th className={table.numeric}>Products</th>
                {canEdit && (
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {!categories.data && <TableSkeleton columns={canEdit ? 5 : 4} rows={4} />}
              {categories.data?.map((category, index) => (
                <tr key={category.id}>
                  <td className={table.serial}>{index + 1}</td>
                  <td className={table.primary}>{category.name}</td>
                  <td>{category.discountPercent ? <Badge tone="success">−{category.discountPercent}%</Badge> : <span className={table.muted}>None</span>}</td>
                  <td className={cx(table.numeric, 'tabular')}>{category.productCount}</td>
                  {canEdit && (
                    <td className={styles.actions}>
                      <div className={styles.actionGroup}>
                        <Button size="sm" variant="ghost" icon="pencil" onClick={() => onEdit(category)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" icon="trash" aria-label={`Delete ${category.name}`} onClick={() => setDeleting(category)} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete category"
          danger
          busy={remove.isPending}
          onConfirm={() => deleteCategory(deleting)}
          onClose={() => setDeleting(null)}
        >
          {deleting.productCount
            ? `Its ${deleting.productCount} products stay on sale, just without a category or its discount.`
            : 'It has no products.'}
        </ConfirmDialog>
      )}
    </Panel>
  );
}
