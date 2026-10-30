import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { mapPage } from '../../../shared/application/pagination';
import { Actor } from '../../../shared/domain/actor';
import { MERCHANT_ROLES, Role } from '../../../shared/domain/role.enum';
import { CurrentActor } from '../../../shared/presentation/decorators/current-actor.decorator';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { CategoryUseCases, ProductUseCases } from '../application/catalog.use-cases';
import {
  CategoryInputDto,
  CategoryResponseDto,
  ListProductsQueryDto,
  ProductInputDto,
  ProductPageResponseDto,
  ProductResponseDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/catalog.dto';

// The merchant's catalogue. Every merchant role can read it; only the merchant admin changes it.
@ApiTags('Merchant portal')
@ApiBearerAuth()
@Roles(...MERCHANT_ROLES)
@Controller('merchant')
export class CatalogController {
  constructor(
    private readonly categories: CategoryUseCases,
    private readonly products: ProductUseCases,
  ) {}

  @Get('categories')
  @ApiOkResponse({ type: [CategoryResponseDto] })
  async listCategories(@CurrentActor() actor: Actor): Promise<CategoryResponseDto[]> {
    return (await this.categories.list(actor)).map(CategoryResponseDto.fromDomain);
  }

  @Post('categories')
  @Roles(Role.MERCHANT_ADMIN)
  @ApiCreatedResponse({ type: CategoryResponseDto })
  async createCategory(@CurrentActor() actor: Actor, @Body() dto: CategoryInputDto): Promise<CategoryResponseDto> {
    const category = await this.categories.create(actor, {
      name: dto.name,
      discountPercent: dto.discountPercent ?? null,
    });
    return CategoryResponseDto.fromDomain(category);
  }

  @Patch('categories/:id')
  @Roles(Role.MERCHANT_ADMIN)
  @ApiOkResponse({ type: CategoryResponseDto })
  async updateCategory(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return CategoryResponseDto.fromDomain(await this.categories.update(actor, id, dto));
  }

  @Delete('categories/:id')
  @Roles(Role.MERCHANT_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Its products stay on sale without a category' })
  async deleteCategory(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.categories.delete(actor, id);
  }

  @Get('products')
  @ApiOkResponse({ type: ProductPageResponseDto })
  async listProducts(
    @CurrentActor() actor: Actor,
    @Query() query: ListProductsQueryDto,
  ): Promise<ProductPageResponseDto> {
    const page = await this.products.search(
      actor,
      { text: query.q, categoryId: query.categoryId, activeOnly: query.activeOnly },
      { page: query.page, pageSize: query.pageSize },
    );
    return mapPage(page, ProductResponseDto.fromDomain);
  }

  @Get('products/:id')
  @ApiOkResponse({ type: ProductResponseDto })
  async getProduct(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string): Promise<ProductResponseDto> {
    return ProductResponseDto.fromDomain(await this.products.get(actor, id));
  }

  @Post('products')
  @Roles(Role.MERCHANT_ADMIN)
  @ApiCreatedResponse({ type: ProductResponseDto })
  async createProduct(@CurrentActor() actor: Actor, @Body() dto: ProductInputDto): Promise<ProductResponseDto> {
    const product = await this.products.create(actor, {
      name: dto.name,
      sku: dto.sku,
      description: dto.description ?? null,
      priceMinor: dto.priceMinor,
      discountPercent: dto.discountPercent ?? null,
      categoryId: dto.categoryId ?? null,
      isActive: dto.isActive ?? true,
    });
    return ProductResponseDto.fromDomain(product);
  }

  @Patch('products/:id')
  @Roles(Role.MERCHANT_ADMIN)
  @ApiOkResponse({ type: ProductResponseDto })
  async updateProduct(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return ProductResponseDto.fromDomain(await this.products.update(actor, id, dto));
  }
}
