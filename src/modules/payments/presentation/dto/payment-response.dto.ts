import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { PageMetaDto } from '../../../../shared/presentation/dto/page-response.dto';
import { PaginationQueryDto } from '../../../../shared/presentation/dto/pagination-query.dto';
import { PaymentMethod } from '../../../merchants/domain/payment-method.enum';
import { FraudDecision } from '../../domain/fraud-screening';
import { PaymentStatus } from '../../domain/payment-transaction';
import { PaymentView, SalesSummary } from '../../domain/payment-transaction.repository';

class PaymentLineDto {
  @ApiProperty({ nullable: true }) productId: string | null;
  @ApiProperty() name: string;
  @ApiProperty() sku: string;
  @ApiProperty() unitPriceMinor: number;
  @ApiProperty() discountPercent: number;
  @ApiProperty() quantity: number;
  @ApiProperty() lineTotalMinor: number;
}

class PersonDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

class PaymentCustomerDto extends PersonDto {
  @ApiProperty() phone: string;
}

class FraudDto {
  @ApiProperty() score: number;
  @ApiProperty({ type: [String] }) reasons: string[];
  @ApiProperty({ enum: FraudDecision }) decision: FraudDecision;
}

class ReviewDto {
  @ApiProperty() reviewerName: string;
  @ApiProperty() reviewedAt: Date;
  @ApiProperty({ nullable: true }) note: string | null;
}

// Only the brand and last 4 digits of the instrument are ever returned.
export class PaymentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'PAY-261030-K7QM2X' }) reference: string;
  @ApiProperty({ enum: PaymentStatus }) status: PaymentStatus;
  @ApiProperty({ enum: PaymentMethod }) method: PaymentMethod;
  @ApiProperty() currency: string;
  @ApiProperty({ type: [PaymentLineDto] }) lines: PaymentLineDto[];
  @ApiProperty() subtotalMinor: number;
  @ApiProperty() discountMinor: number;
  @ApiProperty() pointsRedeemed: number;
  @ApiProperty() pointsDiscountMinor: number;
  @ApiProperty() totalMinor: number;
  @ApiProperty({ nullable: true }) amountTenderedMinor: number | null;
  @ApiProperty({ nullable: true }) changeMinor: number | null;
  @ApiProperty() pointsEarned: number;
  @ApiProperty({ nullable: true }) instrumentBrand: string | null;
  @ApiProperty({ nullable: true }) instrumentLast4: string | null;
  @ApiProperty({ nullable: true }) authorizationCode: string | null;
  @ApiProperty({ nullable: true }) declineReason: string | null;
  @ApiProperty({ type: FraudDto }) fraud: FraudDto;
  @ApiProperty({ type: PersonDto }) cashier: PersonDto;
  @ApiProperty({ type: PaymentCustomerDto, nullable: true }) customer: PaymentCustomerDto | null;
  @ApiProperty({ type: ReviewDto, nullable: true }) review: ReviewDto | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ nullable: true }) completedAt: Date | null;

  static fromView({ payment, cashierName, customerName, customerPhone, reviewerName }: PaymentView): PaymentResponseDto {
    return {
      id: payment.id,
      reference: payment.reference,
      status: payment.status,
      method: payment.method,
      currency: payment.currency,
      lines: payment.lines.map(({ id: _id, ...line }) => line),
      subtotalMinor: payment.subtotalMinor,
      discountMinor: payment.discountMinor,
      pointsRedeemed: payment.pointsRedeemed,
      pointsDiscountMinor: payment.pointsDiscountMinor,
      totalMinor: payment.totalMinor,
      amountTenderedMinor: payment.amountTenderedMinor,
      changeMinor: payment.changeMinor,
      pointsEarned: payment.pointsEarned,
      instrumentBrand: payment.instrument.brand,
      instrumentLast4: payment.instrument.last4,
      authorizationCode: payment.authorizationCode,
      declineReason: payment.declineReason,
      fraud: { ...payment.fraud },
      cashier: { id: payment.cashierId, name: cashierName },
      customer:
        payment.customerId && customerName
          ? { id: payment.customerId, name: customerName, phone: customerPhone ?? '' }
          : null,
      review:
        payment.reviewedAt && reviewerName
          ? { reviewerName, reviewedAt: payment.reviewedAt, note: payment.reviewNote }
          : null,
      createdAt: payment.createdAt,
      completedAt: payment.completedAt,
    };
  }
}

export class PaymentPageResponseDto extends PageMetaDto {
  @ApiProperty({ type: [PaymentResponseDto] }) items: PaymentResponseDto[];
}

export class ListPaymentsQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: PaymentStatus, required: false }) @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus;
  @ApiProperty({ enum: PaymentMethod, required: false }) @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() customerId?: string;
  @ApiProperty({ required: false, description: 'Reference, customer name or phone' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  q?: string;
  @ApiProperty({ required: false }) @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @ApiProperty({ required: false }) @IsOptional() @Type(() => Date) @IsDate() to?: Date;
}

export class SalesSummaryQueryDto {
  @ApiProperty({ required: false, example: 'Asia/Kathmandu', default: 'UTC' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  tz: string = 'UTC';

  @ApiProperty({ required: false, minimum: 7, maximum: 90, default: 14 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(7)
  @Max(90)
  days: number = 14;
}

class TotalsDto {
  @ApiProperty() collectedMinor: number;
  @ApiProperty() count: number;
}

export class SalesSummaryResponseDto {
  @ApiProperty() currency: string;
  @ApiProperty({ type: TotalsDto }) today: TotalsDto;
  @ApiProperty({ type: TotalsDto }) last7Days: TotalsDto;
  @ApiProperty({ type: TotalsDto }) last30Days: TotalsDto;
  @ApiProperty({ type: TotalsDto }) allTime: TotalsDto;
  @ApiProperty() averageTicketMinor: number;
  @ApiProperty() byMethod: SalesSummary['byMethod'];
  @ApiProperty() daily: SalesSummary['daily'];
  @ApiProperty() topProducts: SalesSummary['topProducts'];
  @ApiProperty({ type: TotalsDto }) pendingReview: TotalsDto;
  @ApiProperty() declinedToday: number;
  @ApiProperty() discountsGivenMinor: number;
  @ApiProperty() pointsRedeemedMinor: number;
  @ApiProperty() customersServed: number;
}
