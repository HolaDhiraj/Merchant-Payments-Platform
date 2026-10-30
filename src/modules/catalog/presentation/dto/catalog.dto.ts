import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateIf } from 'class-validator';
import { PageMetaDto } from '../../../../shared/presentation/dto/page-response.dto';
import { PaginationQueryDto } from '../../../../shared/presentation/dto/pagination-query.dto';
import { Category, PricedProduct } from '../../domain/catalog';

export class CategoryInputDto {
  @ApiProperty() @IsString() @Length(1, 80) name: string;

  @ApiPropertyOptional({ nullable: true, description: 'Whole percent 0-100; null for none' })
  @ValidateIf((dto: CategoryInputDto) => dto.discountPercent !== null && dto.discountPercent !== undefined)
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number | null;
}

export class UpdateCategoryDto extends PartialType(CategoryInputDto) {}

export class CategoryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) discountPercent: number | null;
  @ApiProperty() productCount: number;

  static fromDomain(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      discountPercent: category.discountPercent,
      productCount: category.productCount ?? 0,
    };
  }
}

export class ProductInputDto {
  @ApiProperty() @IsString() @Length(1, 120) name: string;

  @ApiProperty({ example: 'CROISSANT-01' })
  @Matches(/^[A-Za-z0-9._-]{1,40}$/, { message: 'sku may use letters, digits, dot, dash and underscore' })
  sku: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((dto: ProductInputDto) => dto.description !== null)
  @IsString()
  @Length(0, 1000)
  description?: string | null;

  @ApiProperty({ description: 'Price in minor units (e.g. cents)' })
  @IsInt()
  @Min(1)
  @Max(10_000_000_000)
  priceMinor: number;

  @ApiPropertyOptional({ nullable: true, description: 'Overrides the category discount' })
  @ValidateIf((dto: ProductInputDto) => dto.discountPercent !== null && dto.discountPercent !== undefined)
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((dto: ProductInputDto) => dto.categoryId !== null && dto.categoryId !== undefined)
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateProductDto extends PartialType(ProductInputDto) {}

export class ListProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;

  @ApiPropertyOptional({ description: 'Only products that can be sold' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  activeOnly?: boolean;
}

class ProductPriceDto {
  @ApiProperty() listPriceMinor: number;
  @ApiProperty() discountPercent: number;
  @ApiProperty() discountMinor: number;
  @ApiProperty() finalPriceMinor: number;
}

export class ProductResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() sku: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() priceMinor: number;
  @ApiProperty({ nullable: true }) discountPercent: number | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ nullable: true }) categoryId: string | null;
  @ApiProperty({ nullable: true }) categoryName: string | null;
  @ApiProperty({ type: ProductPriceDto, description: 'Price after product or category discount' })
  price: ProductPriceDto;
  @ApiProperty() updatedAt: Date;

  static fromDomain({ product, category, price }: PricedProduct): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      priceMinor: product.priceMinor,
      discountPercent: product.discountPercent,
      isActive: product.isActive,
      categoryId: product.categoryId,
      categoryName: category?.name ?? null,
      price: { ...price },
      updatedAt: product.updatedAt,
    };
  }
}

export class ProductPageResponseDto extends PageMetaDto {
  @ApiProperty({ type: [ProductResponseDto] }) items: ProductResponseDto[];
}
