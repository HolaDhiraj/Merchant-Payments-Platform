import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantsModule } from '../merchants/merchants.module';
import { CatalogPricing, CategoryUseCases, ProductUseCases } from './application/catalog.use-cases';
import { CATEGORY_REPOSITORY, PRODUCT_REPOSITORY } from './domain/catalog.repository';
import { CategoryOrmEntity, ProductOrmEntity } from './infrastructure/catalog.orm-entities';
import { TypeOrmCategoryRepository, TypeOrmProductRepository } from './infrastructure/typeorm-catalog.repositories';
import { CatalogController } from './presentation/catalog.controller';
import { PlatformCatalogController } from './presentation/platform-catalog.controller';

// Products and categories of each merchant, with percentage discounts.
// Exports CatalogPricing so checkout prices sales from the same rules.
@Module({
  imports: [TypeOrmModule.forFeature([CategoryOrmEntity, ProductOrmEntity]), MerchantsModule],
  controllers: [CatalogController, PlatformCatalogController],
  providers: [
    { provide: CATEGORY_REPOSITORY, useClass: TypeOrmCategoryRepository },
    { provide: PRODUCT_REPOSITORY, useClass: TypeOrmProductRepository },
    CategoryUseCases,
    ProductUseCases,
    CatalogPricing,
  ],
  exports: [CatalogPricing],
})
export class CatalogModule {}
