// Pricing rules shared by the catalogue (what customers see) and checkout (what they pay),
// so the two can never disagree. All amounts are integer minor units.

// A product's own discount wins; otherwise its category's discount applies; otherwise none.
export function effectiveDiscountPercent(
  productDiscountPercent: number | null,
  categoryDiscountPercent: number | null,
): number {
  return productDiscountPercent ?? categoryDiscountPercent ?? 0;
}

export interface UnitPrice {
  // Price before discount ("was" price).
  listPriceMinor: number;
  discountPercent: number;
  // Discount per unit, rounded half up to a whole minor unit.
  discountMinor: number;
  // What one unit costs after the discount.
  finalPriceMinor: number;
}

export function unitPrice(listPriceMinor: number, discountPercent: number): UnitPrice {
  const discountMinor = Math.round((listPriceMinor * discountPercent) / 100);
  return {
    listPriceMinor,
    discountPercent,
    discountMinor,
    finalPriceMinor: listPriceMinor - discountMinor,
  };
}
