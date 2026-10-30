import { Injectable } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { buildPage, Page, PageRequest } from '../../../shared/application/pagination';
import { DuplicateEntityError } from '../../../shared/domain/domain-errors';
import { TransactionalEntityManager } from '../../../shared/infrastructure/database/transactional-entity-manager';
import { isUniqueViolation } from '../../../shared/infrastructure/database/postgres-errors';
import { Category, Product } from '../domain/catalog';
import { CategoryRepository, ProductRepository, ProductSearch } from '../domain/catalog.repository';
import { CategoryOrmEntity, ProductOrmEntity } from './catalog.orm-entities';

// The unique indexes are the real guard against duplicate names / SKUs under concurrency.
async function guardUnique<T>(work: () => Promise<T>, message: string): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateEntityError(message);
    throw error;
  }
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class TypeOrmCategoryRepository implements CategoryRepository {
  constructor(private readonly entityManager: TransactionalEntityManager) {}

  private get repository(): Repository<CategoryOrmEntity> {
    return this.entityManager.current().getRepository(CategoryOrmEntity);
  }

  // Categories with how many products each holds, in one query.
  async list(merchantId: string): Promise<Category[]> {
    const { entities, raw } = await this.repository
      .createQueryBuilder('category')
      .addSelect(
        (sub) =>
          sub
            .select('count(*)')
            .from(ProductOrmEntity, 'product')
            .where('product.category_id = category.id'),
        'product_count',
      )
      .where('category.merchant_id = :merchantId', { merchantId })
      .orderBy('lower(category.name)', 'ASC')
      .getRawAndEntities<{ product_count: string }>();
    return entities.map((row, index) =>
      toCategory({ ...row, productCount: Number(raw[index].product_count) }),
    );
  }

  async findById(merchantId: string, id: string): Promise<Category | null> {
    const row = await this.repository.findOneBy({ merchantId, id });
    return row ? toCategory(row) : null;
  }

  async findByIds(merchantId: string, ids: string[]): Promise<Category[]> {
    if (ids.length === 0) return [];
    return (await this.repository.findBy({ merchantId, id: In(ids) })).map(toCategory);
  }

  insert(category: Category): Promise<void> {
    return guardUnique(async () => {
      await this.repository.insert(fromCategory(category));
    }, 'A category with this name already exists');
  }

  update(category: Category): Promise<void> {
    return guardUnique(async () => {
      await this.repository.update(
        { merchantId: category.merchantId, id: category.id },
        { name: category.name, discountPercent: category.discountPercent },
      );
    }, 'A category with this name already exists');
  }

  async delete(merchantId: string, id: string): Promise<void> {
    await this.repository.delete({ merchantId, id });
  }
}

@Injectable()
export class TypeOrmProductRepository implements ProductRepository {
  constructor(private readonly entityManager: TransactionalEntityManager) {}

  private get repository(): Repository<ProductOrmEntity> {
    return this.entityManager.current().getRepository(ProductOrmEntity);
  }

  async search(merchantId: string, query: ProductSearch, page: PageRequest): Promise<Page<Product>> {
    const builder = this.repository
      .createQueryBuilder('product')
      .where('product.merchant_id = :merchantId', { merchantId });
    if (query.text) {
      builder.andWhere('(product.name ILIKE :text OR product.sku ILIKE :text)', {
        text: `%${escapeLike(query.text)}%`,
      });
    }
    if (query.categoryId) {
      builder.andWhere('product.category_id = :categoryId', { categoryId: query.categoryId });
    }
    if (query.activeOnly) {
      builder.andWhere('product.is_active = true');
    }
    const [rows, total] = await builder
      .orderBy('lower(product.name)', 'ASC')
      .addOrderBy('product.id', 'ASC')
      .skip((page.page - 1) * page.pageSize)
      .take(page.pageSize)
      .getManyAndCount();
    return buildPage(rows.map(toProduct), total, page);
  }

  async findById(merchantId: string, id: string): Promise<Product | null> {
    const row = await this.repository.findOneBy({ merchantId, id });
    return row ? toProduct(row) : null;
  }

  async findByIds(merchantId: string, ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    return (await this.repository.findBy({ merchantId, id: In(ids) })).map(toProduct);
  }

  insert(product: Product): Promise<void> {
    return guardUnique(async () => {
      await this.repository.insert({ ...product });
    }, 'A product with this SKU already exists');
  }

  update(product: Product): Promise<void> {
    return guardUnique(async () => {
      const { id, merchantId, createdAt: _createdAt, updatedAt: _updatedAt, ...changes } = product;
      await this.repository.update({ merchantId, id }, changes);
    }, 'A product with this SKU already exists');
  }
}

function toCategory(row: CategoryOrmEntity & { productCount?: number }): Category {
  return {
    id: row.id,
    merchantId: row.merchantId,
    name: row.name,
    discountPercent: row.discountPercent,
    productCount: row.productCount,
    createdAt: row.createdAt,
  };
}

function fromCategory(category: Category): Partial<CategoryOrmEntity> {
  return {
    id: category.id,
    merchantId: category.merchantId,
    name: category.name,
    discountPercent: category.discountPercent,
    createdAt: category.createdAt,
  };
}

function toProduct(row: ProductOrmEntity): Product {
  return { ...row };
}
