import { useState } from 'react';
import { useSaveCategory } from '@/api/portalQueries';
import type { Category } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errors';
import { parsePercent } from '@/lib/pricing';

export function CategoryDialog({ category, onClose }: { category: Category | null; onClose(): void }) {
  const save = useSaveCategory();
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? '');
  const [discount, setDiscount] = useState(category?.discountPercent?.toString() ?? '');
  const [attempted, setAttempted] = useState(false);
  const percent = parsePercent(discount);

  function submit() {
    setAttempted(true);
    if (!name.trim() || percent === 'invalid') return;
    save.mutate(
      { id: category?.id, name: name.trim(), discountPercent: percent },
      {
        onSuccess: (saved) => {
          toast.success(category ? `${saved.name} updated` : `${saved.name} added`);
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      onSubmit={submit}
      busy={save.isPending}
      title={category ? 'Edit category' : 'Add category'}
      description="A category discount applies to every product in it that has no discount of its own."
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            {category ? 'Save changes' : 'Add category'}
          </Button>
        </>
      }
    >
      {save.isError && <Callout tone="danger">{errorMessage(save.error)}</Callout>}
      <Field label="Name" error={attempted && !name.trim() ? 'Enter a name.' : undefined}>
        <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus maxLength={80} />
      </Field>
      <Field label="Discount" optional error={attempted && percent === 'invalid' ? 'A whole percentage from 0 to 100.' : undefined} hint="Percent off. Leave empty for none.">
        <Input value={discount} onChange={(event) => setDiscount(event.target.value)} inputMode="numeric" placeholder="0" />
      </Field>
    </Dialog>
  );
}
