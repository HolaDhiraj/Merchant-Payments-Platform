import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { mapPage } from '../../../shared/application/pagination';
import { Actor } from '../../../shared/domain/actor';
import { MERCHANT_ROLES, Role } from '../../../shared/domain/role.enum';
import { CurrentActor } from '../../../shared/presentation/decorators/current-actor.decorator';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { CheckoutUseCase } from '../application/checkout.use-case';
import { PaymentQueries } from '../application/payment-queries.use-cases';
import { ReviewPaymentUseCase } from '../application/review-payment.use-case';
import { CheckoutDto, ReviewPaymentDto } from './dto/checkout.dto';
import {
  ListPaymentsQueryDto,
  PaymentPageResponseDto,
  PaymentResponseDto,
  SalesSummaryQueryDto,
  SalesSummaryResponseDto,
} from './dto/payment-response.dto';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;

@ApiTags('Merchant portal')
@ApiBearerAuth()
@Roles(...MERCHANT_ROLES)
@Controller('merchant')
export class PaymentsController {
  constructor(
    private readonly checkout: CheckoutUseCase,
    private readonly review: ReviewPaymentUseCase,
    private readonly queries: PaymentQueries,
  ) {}

  // 201 with the outcome (COMPLETED, PENDING_REVIEW or DECLINED: a decline is a result, not an error).
  // Repeating a request with the same Idempotency-Key returns the stored result with 200.
  @Post('payments')
  @Roles(Role.MERCHANT_ADMIN, Role.MERCHANT_SALES)
  @ApiOperation({ summary: 'Take a payment (cash, card or bank transfer)' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: '8-100 characters, unique per payment attempt' })
  @ApiCreatedResponse({ type: PaymentResponseDto })
  @ApiConflictResponse({ description: 'Idempotency-Key reused for a different request' })
  async pay(
    @CurrentActor() actor: Actor,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CheckoutDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PaymentResponseDto> {
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new BadRequestException('An Idempotency-Key header of 8-100 letters, digits, - or _ is required');
    }
    const { payment, replayed } = await this.checkout.execute(actor, dto, idempotencyKey);
    if (replayed) {
      response.status(HttpStatus.OK).setHeader('Idempotent-Replayed', 'true');
    }
    return PaymentResponseDto.fromView(await this.queries.get(actor, payment.id));
  }

  @Get('payments')
  @ApiOkResponse({ type: PaymentPageResponseDto })
  async list(@CurrentActor() actor: Actor, @Query() query: ListPaymentsQueryDto): Promise<PaymentPageResponseDto> {
    const page = await this.queries.search(
      actor,
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
  async get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string): Promise<PaymentResponseDto> {
    return PaymentResponseDto.fromView(await this.queries.get(actor, id));
  }

  // Decide on a payment held by fraud screening.
  @Post('payments/:id/review')
  @Roles(Role.MERCHANT_ADMIN, Role.MERCHANT_REVIEWER)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PaymentResponseDto })
  async decide(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewPaymentDto,
  ): Promise<PaymentResponseDto> {
    await this.review.execute(actor, id, dto);
    return PaymentResponseDto.fromView(await this.queries.get(actor, id));
  }

  @Get('reports/summary')
  @Roles(Role.MERCHANT_ADMIN, Role.MERCHANT_REVIEWER)
  @ApiOkResponse({ type: SalesSummaryResponseDto })
  summary(@CurrentActor() actor: Actor, @Query() query: SalesSummaryQueryDto): Promise<SalesSummaryResponseDto> {
    return this.queries.summary(actor, query.tz, query.days);
  }
}
