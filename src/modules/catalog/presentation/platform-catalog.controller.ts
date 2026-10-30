import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { mapPage } from '../../../shared/application/pagination';
import { Role } from '../../../shared/domain/role.enum';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { Merchant } from '../../merchants/domain/merchant';
import { MerchantByIdPipe } from '../../merchants/presentation/merchant-by-id.pipe';
import { CategoryUseCases, ProductUseCases } from '../application/catalog.use-cases';
import {
  CategoryResponseDto,
  ListProductsQueryDto,
  ProductPageResponseDto,
  ProductResponseDto,
} from './dto/catalog.dto';

// Platform oversight: a platform admin reads any merchant's catalogue (read-only).
@ApiTags('Merchants (platform)')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('merchants/:merchantId')
export class PlatformCatalogController {
  constructor(
    private readonly categories: CategoryUseCases,
    private readonly products: ProductUseCases,
  ) {}

  @Get('categories')
  @ApiOkResponse({ type: [CategoryResponseDto] })
  async listCategories(
    @Param('merchantId', ParseUUIDPipe, MerchantByIdPipe) merchant: Merchant,
  ): Promise<CategoryResponseDto[]> {
    return (await this.categories.listForMerchant(merchant.id)).map(CategoryResponseDto.fromDomain);
  }

  @Get('products')
  @ApiOkResponse({ type: ProductPageResponseDto })
  async listProducts(
    @Param('merchantId', ParseUUIDPipe, MerchantByIdPipe) merchant: Merchant,
    @Query() query: ListProductsQueryDto,
  ): Promise<ProductPageResponseDto> {
    const page = await this.products.searchForMerchant(
      merchant.id,
      { text: query.q, categoryId: query.categoryId, activeOnly: query.activeOnly },
      { page: query.page, pageSize: query.pageSize },
    );
    return mapPage(page, ProductResponseDto.fromDomain);
  }
}
