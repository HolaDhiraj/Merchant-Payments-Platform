import type { Price } from '@/api/types';

// Mirrors the API's pricing rule for live previews: the product's own discount wins,
// otherwise the category's applies; the discount is rounded half up to a minor unit.
export function previewPrice(priceMinor: number, productDiscount: number | null, categoryDiscount: number | null): Price {
  const discountPercent = productDiscount ?? categoryDiscount ?? 0;
  const discountMinor = Math.round((priceMinor * discountPercent) / 100);
  return { listPriceMinor: priceMinor, discountPercent, discountMinor, finalPriceMinor: priceMinor - discountMinor };
}

// "" means "no discount of its own"; otherwise a whole percentage 0-100.
export function parsePercent(input: string): number | null | 'invalid' {
  if (input.trim() === '') return null;
  const value = Number(input);
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : 'invalid';
}
