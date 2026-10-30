import { Page, PageRequest } from '../../../shared/application/pagination';
import { Category, Product } from './catalog';

// Every method is scoped by merchant id: a merchant can only ever read or write its own catalogue.
export interface CategoryRepository {
  list(merchantId: string): Promise<Category[]>;
  findById(merchantId: string, id: string): Promise<Category | null>;
  findByIds(merchantId: string, ids: string[]): Promise<Category[]>;
  insert(category: Category): Promise<void>;
  update(category: Category): Promise<void>;
  delete(merchantId: string, id: string): Promise<void>;
}

export interface ProductSearch {
  text?: string;
  categoryId?: string;
  activeOnly?: boolean;
}

export interface ProductRepository {
  search(merchantId: string, query: ProductSearch, page: PageRequest): Promise<Page<Product>>;
  findById(merchantId: string, id: string): Promise<Product | null>;
  findByIds(merchantId: string, ids: string[]): Promise<Product[]>;
  insert(product: Product): Promise<void>;
  update(product: Product): Promise<void>;
}

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
