import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { mapPage } from '../../../shared/application/pagination';
import { Role } from '../../../shared/domain/role.enum';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { Merchant } from '../../merchants/domain/merchant';
import { MerchantByIdPipe } from '../../merchants/presentation/merchant-by-id.pipe';
import { PaymentQueries } from '../application/payment-queries.use-cases';
import {
  ListPaymentsQueryDto,
  PaymentPageResponseDto,
  PaymentResponseDto,
  SalesSummaryQueryDto,
  SalesSummaryResponseDto,
} from './dto/payment-response.dto';

// Platform oversight: a platform admin monitors any merchant's payments and sales. Read-only;
// taking or reviewing payments stays with the merchant's own people.
@ApiTags('Merchants (platform)')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('merchants/:merchantId')
export class PlatformPaymentsController {
  constructor(private readonly queries: PaymentQueries) {}

  @Get('payments')
  @ApiOkResponse({ type: PaymentPageResponseDto })
  async list(
    @Param('merchantId', ParseUUIDPipe, MerchantByIdPipe) merchant: Merchant,
    @Query() query: ListPaymentsQueryDto,
  ): Promise<PaymentPageResponseDto> {
    const page = await this.queries.searchForMerchant(
      merchant.id,
      {
        status: query.status,
        method: query.method,
        customerId: query.customerId,
        text: query.q,
        from: query.from,
        to: query.to,
      },
      { page: query.page, pageSize: query.pageSize },
    );
    return mapPage(page, PaymentResponseDto.fromView);
  }

  @Get('payments/:id')
  @ApiOkResponse({ type: PaymentResponseDto })
  async get(
    @Param('merchantId', ParseUUIDPipe, MerchantByIdPipe) merchant: Merchant,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponseDto> {
    return PaymentResponseDto.fromView(await this.queries.getForMerchant(merchant.id, id));
  }

  @Get('reports/summary')
  @ApiOkResponse({ type: SalesSummaryResponseDto })
  summary(
    @Param('merchantId', ParseUUIDPipe, MerchantByIdPipe) merchant: Merchant,
    @Query() query: SalesSummaryQueryDto,
  ): Promise<SalesSummaryResponseDto> {
    return this.queries.summaryForMerchant(merchant, query.tz, query.days);
  }
}
