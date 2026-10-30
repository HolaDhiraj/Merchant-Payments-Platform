import { useState } from 'react';
import { useCategories, useSaveProduct } from '@/api/portalQueries';
import type { Product } from '@/api/types';
import { PriceTag } from '@/components/portal/PriceTag';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';
import { toMajorInput, toMinorUnits } from '@/lib/format';
import { parsePercent, previewPrice } from '@/lib/pricing';
import styles from './Catalog.module.css';

interface ProductDialogProps {
  product: Product | null;
  currency: string;
  onClose(): void;
}

// Add or edit a product, with a live preview of the price customers will pay.
export function ProductDialog({ product, currency, onClose }: ProductDialogProps) {
  const categories = useCategories();
  const save = useSaveProduct();
  const toast = useToast();
  const [values, setValues] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    description: product?.description ?? '',
    price: product ? toMajorInput(product.priceMinor, currency) : '',
    categoryId: product?.categoryId ?? '',
    discount: product?.discountPercent?.toString() ?? '',
    isActive: product?.isActive ?? true,
  });
  const [attempted, setAttempted] = useState(false);
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const priceMinor = toMinorUnits(values.price, currency);
  const discount = parsePercent(values.discount);
  const category = categories.data?.find((c) => c.id === values.categoryId) ?? null;
  const errors = {
    name: values.name.trim() ? undefined : 'Enter a name.',
    sku: /^[A-Za-z0-9._-]{1,40}$/.test(values.sku.trim()) ? undefined : 'Letters, digits, dot, dash or underscore.',
    price: priceMinor ? undefined : 'Enter a price above zero.',
    discount: discount === 'invalid' ? 'A whole percentage from 0 to 100.' : undefined,
  };
  const shown: Partial<typeof errors> = attempted ? errors : {};

  function submit() {
    setAttempted(true);
    if (Object.values(errors).some(Boolean) || !priceMinor || discount === 'invalid') return;
    save.mutate(
      {
        id: product?.id,
        input: {
          name: values.name.trim(),
          sku: values.sku.trim(),
          description: values.description.trim() || null,
          priceMinor,
          discountPercent: discount,
          categoryId: values.categoryId || null,
          isActive: values.isActive,
        },
      },
      {
        onSuccess: (saved) => {
          toast.success(product ? `${saved.name} updated` : `${saved.name} added`);
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      onSubmit={submit}
      busy={save.isPending}
      title={product ? 'Edit product' : 'Add product'}
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      {save.isError && <Callout tone="danger">{errorMessage(save.error)}</Callout>}
      <div className={styles.formGrid}>
        <Field label="Name" error={shown.name} className={styles.wide}>
          <Input value={values.name} onChange={(event) => set('name', event.target.value)} autoFocus />
        </Field>
        <Field label="SKU" error={shown.sku} hint="Your own product code.">
          <Input value={values.sku} onChange={(event) => set('sku', event.target.value)} className="mono" />
        </Field>
        <Field label="Category" optional>
          <Select value={values.categoryId} onChange={(event) => set('categoryId', event.target.value)}>
            <option value="">No category</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.discountPercent ? ` (−${c.discountPercent}%)` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Price" error={shown.price}>
          <Input value={values.price} onChange={(event) => set('price', event.target.value)} prefix={currency} inputMode="decimal" className="mono" />
        </Field>
        <Field
          label="Discount"
          optional
          error={shown.discount}
          hint={category?.discountPercent ? `Empty uses the category's ${category.discountPercent}%.` : 'Percent off this product.'}
        >
          <Input value={values.discount} onChange={(event) => set('discount', event.target.value)} inputMode="numeric" placeholder="0" />
        </Field>
        <Field label="Description" optional className={styles.wide}>
          <Textarea value={values.description} onChange={(event) => set('description', event.target.value)} rows={3} maxLength={1000} />
        </Field>
      </div>
      <div className={styles.previewRow}>
        <Switch
          checked={values.isActive}
          onChange={(checked) => set('isActive', checked)}
          label="On sale"
          description="Hidden products stay in your history but can't be sold."
        />
        {priceMinor && discount !== 'invalid' && (
          <div className={styles.preview}>
            <span className={styles.previewLabel}>Customers pay</span>
            <PriceTag price={previewPrice(priceMinor, discount, category?.discountPercent ?? null)} currency={currency} size="lg" />
          </div>
        )}
      </div>
    </Dialog>
  );
}
