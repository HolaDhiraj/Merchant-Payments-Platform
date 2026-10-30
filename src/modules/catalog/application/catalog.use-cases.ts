import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import { Clock, CLOCK } from '../../../shared/domain/clock';
import { BusinessRuleViolationError, EntityNotFoundError } from '../../../shared/domain/domain-errors';
import { IdGenerator, ID_GENERATOR } from '../../../shared/domain/id-generator';
import { merchantIdOf } from '../../../shared/application/merchant-scope';
import { Page, PageRequest } from '../../../shared/application/pagination';
import {
  assertDiscountPercent,
  assertValidProduct,
  Category,
  priceProduct,
  PricedProduct,
  Product,
  ProductDraft,
} from '../domain/catalog';
import {
  CATEGORY_REPOSITORY,
  CategoryRepository,
  PRODUCT_REPOSITORY,
  ProductRepository,
  ProductSearch,
} from '../domain/catalog.repository';

// Merchant catalogue: every read and write is scoped to the caller's merchant.
// Reading is open to all merchant roles; writing is for the merchant admin (enforced at the controller).

export interface CategoryInput {
  name: string;
  discountPercent: number | null;
}

@Injectable()
export class CategoryUseCases {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  list(actor: Actor): Promise<Category[]> {
    return this.listForMerchant(merchantIdOf(actor));
  }

  // Platform oversight (a platform admin names the merchant; read-only).
  listForMerchant(merchantId: string): Promise<Category[]> {
    return this.categories.list(merchantId);
  }

  async create(actor: Actor, input: CategoryInput): Promise<Category> {
    assertDiscountPercent(input.discountPercent);
    const category: Category = {
      id: this.ids.next(),
      merchantId: merchantIdOf(actor),
      name: input.name.trim(),
      discountPercent: input.discountPercent,
      productCount: 0,
      createdAt: this.clock.now(),
    };
    await this.categories.insert(category);
    return category;
  }

  async update(actor: Actor, id: string, input: Partial<CategoryInput>): Promise<Category> {
    const current = await this.get(actor, id);
    const next: Category = {
      ...current,
      name: input.name?.trim() ?? current.name,
      discountPercent: input.discountPercent !== undefined ? input.discountPercent : current.discountPercent,
    };
    assertDiscountPercent(next.discountPercent);
    await this.categories.update(next);
    return next;
  }

  // Products in a deleted category stay on sale, just without a category (ON DELETE SET NULL).
  async delete(actor: Actor, id: string): Promise<void> {
    const category = await this.get(actor, id);
    await this.categories.delete(category.merchantId, category.id);
  }

  private async get(actor: Actor, id: string): Promise<Category> {
    const category = await this.categories.findById(merchantIdOf(actor), id);
    if (!category) throw new EntityNotFoundError('Category', id);
    return category;
  }
}

@Injectable()
export class ProductUseCases {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // Products with their category and current price (list price, discount, final price).
  search(actor: Actor, query: ProductSearch, page: PageRequest): Promise<Page<PricedProduct>> {
    return this.searchForMerchant(merchantIdOf(actor), query, page);
  }

  // Platform oversight (a platform admin names the merchant; read-only).
  async searchForMerchant(merchantId: string, query: ProductSearch, page: PageRequest): Promise<Page<PricedProduct>> {
    const result = await this.products.search(merchantId, query, page);
    return { ...result, items: await this.priced(merchantId, result.items) };
  }

  async get(actor: Actor, id: string): Promise<PricedProduct> {
    const merchantId = merchantIdOf(actor);
    const product = await this.products.findById(merchantId, id);
    if (!product) throw new EntityNotFoundError('Product', id);
    return (await this.priced(merchantId, [product]))[0];
  }

  async create(actor: Actor, draft: ProductDraft): Promise<PricedProduct> {
    const merchantId = merchantIdOf(actor);
    const product = this.normalise({
      id: this.ids.next(),
      merchantId,
      ...draft,
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
    });
    await this.assertCategory(merchantId, product.categoryId);
    await this.products.insert(product);
    return (await this.priced(merchantId, [product]))[0];
  }

  async update(actor: Actor, id: string, changes: Partial<ProductDraft>): Promise<PricedProduct> {
    const merchantId = merchantIdOf(actor);
    const current = await this.products.findById(merchantId, id);
    if (!current) throw new EntityNotFoundError('Product', id);
    const product = this.normalise({ ...current, ...definedOnly(changes), updatedAt: this.clock.now() });
    await this.assertCategory(merchantId, product.categoryId);
    await this.products.update(product);
    return (await this.priced(merchantId, [product]))[0];
  }

  private normalise(product: Product): Product {
    const normalised = {
      ...product,
      name: product.name.trim(),
      sku: product.sku.trim().toUpperCase(),
      description: product.description?.trim() || null,
    };
    assertValidProduct(normalised);
    return normalised;
  }

  private async assertCategory(merchantId: string, categoryId: string | null): Promise<void> {
    if (categoryId && !(await this.categories.findById(merchantId, categoryId))) {
      throw new BusinessRuleViolationError('Choose one of your own categories');
    }
  }

  private async priced(merchantId: string, products: Product[]): Promise<PricedProduct[]> {
    const categoryIds = [...new Set(products.map((p) => p.categoryId).filter((id): id is string => !!id))];
    const categories = new Map(
      (await this.categories.findByIds(merchantId, categoryIds)).map((c) => [c.id, c]),
    );
    return products.map((product) =>
      priceProduct(product, product.categoryId ? (categories.get(product.categoryId) ?? null) : null),
    );
  }
}

// Used by checkout: the current price of each requested product, from the merchant's own
// active catalogue only. Prices always come from here, never from the client.
@Injectable()
export class CatalogPricing {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
  ) {}

  async priceForSale(merchantId: string, productIds: string[]): Promise<Map<string, PricedProduct>> {
    const products = await this.products.findByIds(merchantId, productIds);
    const unavailable = productIds.filter(
      (id) => !products.some((product) => product.id === id && product.isActive),
    );
    if (unavailable.length > 0) {
      throw new BusinessRuleViolationError('Some products are no longer available; refresh and try again');
    }
    const categoryIds = [...new Set(products.map((p) => p.categoryId).filter((id): id is string => !!id))];
    const categories = new Map(
      (await this.categories.findByIds(merchantId, categoryIds)).map((c) => [c.id, c]),
    );
    return new Map(
      products.map((product) => [
        product.id,
        priceProduct(product, product.categoryId ? (categories.get(product.categoryId) ?? null) : null),
      ]),
    );
  }
}

// Drops keys whose value is undefined, so a partial update never erases stored fields.
function definedOnly<T extends object>(changes: T): Partial<T> {
  return Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)) as Partial<T>;
}
