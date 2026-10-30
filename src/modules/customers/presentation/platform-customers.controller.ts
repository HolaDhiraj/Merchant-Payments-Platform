import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { mapPage } from '../../../shared/application/pagination';
import { Role } from '../../../shared/domain/role.enum';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { PaginationQueryDto } from '../../../shared/presentation/dto/pagination-query.dto';
import { Merchant } from '../../merchants/domain/merchant';
import { MerchantByIdPipe } from '../../merchants/presentation/merchant-by-id.pipe';
import { CustomerUseCases } from '../application/customer.use-cases';
import {
  CustomerPageResponseDto,
  CustomerResponseDto,
  ListCustomersQueryDto,
  LoyaltyEntryPageResponseDto,
  LoyaltyEntryResponseDto,
} from './dto/customer.dto';

// Platform oversight: a platform admin reads any merchant's customers and loyalty points (read-only).
@ApiTags('Merchants (platform)')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('merchants/:merchantId/customers')
export class PlatformCustomersController {
  constructor(private readonly customers: CustomerUseCases) {}

  @Get()
  @ApiOkResponse({ type: CustomerPageResponseDto })
  async list(
    @Param('merchantId', ParseUUIDPipe, MerchantByIdPipe) merchant: Merchant,
    @Query() query: ListCustomersQueryDto,
  ): Promise<CustomerPageResponseDto> {
    const page = await this.customers.searchForMerchant(merchant.id, query.q, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return mapPage(page, CustomerResponseDto.fromDomain);
  }

  @Get(':id')
  @ApiOkResponse({ type: CustomerResponseDto })
  async get(
    @Param('merchantId', ParseUUIDPipe, MerchantByIdPipe) merchant: Merchant,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerResponseDto> {
    return CustomerResponseDto.fromDomain(await this.customers.getForMerchant(merchant.id, id));
  }

  @Get(':id/points')
  @ApiOkResponse({ type: LoyaltyEntryPageResponseDto })
  async points(
    @Param('merchantId', ParseUUIDPipe, MerchantByIdPipe) merchant: Merchant,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<LoyaltyEntryPageResponseDto> {
    await this.customers.getForMerchant(merchant.id, id);
    const page = await this.customers.ledgerForMerchant(merchant.id, id, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return mapPage(page, LoyaltyEntryResponseDto.fromDomain);
  }
}
