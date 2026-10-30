import { effectiveDiscountPercent, unitPrice } from './pricing';

describe('pricing', () => {
  it("prefers the product's own discount, then the category's, then none", () => {
    expect(effectiveDiscountPercent(20, 10)).toBe(20);
    expect(effectiveDiscountPercent(0, 10)).toBe(0);
    expect(effectiveDiscountPercent(null, 10)).toBe(10);
    expect(effectiveDiscountPercent(null, null)).toBe(0);
  });

  it('rounds the discount half up to whole minor units', () => {
    expect(unitPrice(999, 15)).toEqual({
      listPriceMinor: 999,
      discountPercent: 15,
      discountMinor: 150,
      finalPriceMinor: 849,
    });
    expect(unitPrice(400, 0).finalPriceMinor).toBe(400);
    expect(unitPrice(400, 100).finalPriceMinor).toBe(0);
  });
});
