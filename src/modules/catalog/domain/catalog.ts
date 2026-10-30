import { BusinessRuleViolationError } from '../../../shared/domain/domain-errors';
import { effectiveDiscountPercent, unitPrice, UnitPrice } from './pricing';

const MAX_PRICE_MINOR = 10_000_000_000;

export function assertDiscountPercent(value: number | null): void {
  if (value !== null && (!Number.isInteger(value) || value < 0 || value > 100)) {
    throw new BusinessRuleViolationError('A discount must be a whole percentage from 0 to 100');
  }
}

export interface Category {
  readonly id: string;
  readonly merchantId: string;
  readonly name: string;
  // Applies to every product in the category that has no discount of its own.
  readonly discountPercent: number | null;
  readonly productCount?: number;
  readonly createdAt: Date;
}

export interface Product {
  readonly id: string;
  readonly merchantId: string;
  readonly categoryId: string | null;
  readonly name: string;
  readonly sku: string;
  readonly description: string | null;
  readonly priceMinor: number;
  readonly discountPercent: number | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type ProductDraft = Pick<
  Product,
  'categoryId' | 'name' | 'sku' | 'description' | 'priceMinor' | 'discountPercent' | 'isActive'
>;

export function assertValidProduct(product: ProductDraft): void {
  if (!Number.isInteger(product.priceMinor) || product.priceMinor <= 0 || product.priceMinor > MAX_PRICE_MINOR) {
    throw new BusinessRuleViolationError('The price must be a positive amount');
  }
  assertDiscountPercent(product.discountPercent);
  if (!product.name.trim() || !product.sku.trim()) {
    throw new BusinessRuleViolationError('A product needs a name and a SKU');
  }
}

// A product as sold right now: its category and the discount that applies.
export interface PricedProduct {
  readonly product: Product;
  readonly category: Category | null;
  readonly price: UnitPrice;
}

export function priceProduct(product: Product, category: Category | null): PricedProduct {
  const percent = effectiveDiscountPercent(product.discountPercent, category?.discountPercent ?? null);
  return { product, category, price: unitPrice(product.priceMinor, percent) };
}
