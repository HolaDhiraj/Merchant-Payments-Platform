import { useMemo, useState } from 'react';
import type { Product } from '@/api/types';

export interface CartLine {
  product: Product;
  quantity: number;
}

export const MAX_QUANTITY = 999;

// The basket at the till. Totals here are a preview from catalogue prices;
// the server prices the sale again and its numbers are the ones charged.
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + line.product.price.listPriceMinor * line.quantity, 0);
    const discount = lines.reduce((sum, line) => sum + line.product.price.discountMinor * line.quantity, 0);
    return { subtotal, discount, afterDiscount: subtotal - discount, items: lines.reduce((n, line) => n + line.quantity, 0) };
  }, [lines]);

  function add(product: Product) {
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (!existing) return [...current, { product, quantity: 1 }];
      return current.map((line) =>
        line.product.id === product.id ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + 1) } : line,
      );
    });
  }

  function setQuantity(productId: string, quantity: number) {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.product.id !== productId)
        : current.map((line) => (line.product.id === productId ? { ...line, quantity: Math.min(MAX_QUANTITY, quantity) } : line)),
    );
  }

  return {
    lines,
    totals,
    add,
    setQuantity,
    quantityOf: (productId: string) => lines.find((line) => line.product.id === productId)?.quantity ?? 0,
    clear: () => setLines([]),
  };
}

export type Cart = ReturnType<typeof useCart>;
