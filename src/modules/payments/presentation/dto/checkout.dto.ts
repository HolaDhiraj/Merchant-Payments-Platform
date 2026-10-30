import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../../merchants/domain/payment-method.enum';

class CheckoutItemDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty({ minimum: 1, maximum: 999 }) @IsInt() @Min(1) @Max(999) quantity: number;
}

class CheckoutCustomerDto {
  @ApiProperty({ example: '+9779812345678' })
  @Matches(/^\+?[0-9 ()-]{7,24}$/, { message: 'customer.phone is not valid' })
  phone: string;

  @ApiPropertyOptional({ description: 'Required when the phone number is new' })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  fullName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((dto: CheckoutCustomerDto) => dto.email !== null)
  @IsEmail()
  email?: string | null;
}

// Card data is write-only: validated, fingerprinted, sent to the processor, never stored or returned.
class CardDto {
  @ApiProperty({ writeOnly: true, example: '4242 4242 4242 4242' })
  @Matches(/^[0-9 -]{12,23}$/, { message: 'card.number is not valid' })
  number: string;

  @ApiProperty({ minimum: 1, maximum: 12 }) @IsInt() @Min(1) @Max(12) expiryMonth: number;
  @ApiProperty({ example: 2028 }) @IsInt() @Min(2000) @Max(2100) expiryYear: number;

  @ApiProperty({ writeOnly: true })
  @Matches(/^\d{3,4}$/, { message: 'card.cvv must be 3 or 4 digits' })
  cvv: string;

  @ApiProperty() @IsString() @Length(2, 100) holderName: string;
}

class BankTransferDto {
  @ApiProperty({ writeOnly: true })
  @Matches(/^[0-9 -]{6,30}$/, { message: 'bankTransfer.accountNumber is not valid' })
  accountNumber: string;

  @ApiProperty({ writeOnly: true, description: 'Simulated bank: the PIN is BANK_SIMULATOR_PIN (0000)' })
  @Matches(/^\d{4,6}$/, { message: 'bankTransfer.pin must be 4-6 digits' })
  pin: string;
}

export class CheckoutDto {
  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];

  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method: PaymentMethod;

  @ApiPropertyOptional({ type: CheckoutCustomerDto, description: 'Required for cash payments' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutCustomerDto)
  customer?: CheckoutCustomerDto;

  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0) @Max(10_000_000) pointsToRedeem?: number;

  @ApiPropertyOptional({ description: 'Cash only: amount handed over, in minor units' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000_000_000)
  cashTenderedMinor?: number;

  @ApiPropertyOptional({ type: CardDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CardDto)
  card?: CardDto;

  @ApiPropertyOptional({ type: BankTransferDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BankTransferDto)
  bankTransfer?: BankTransferDto;
}

export class ReviewPaymentDto {
  @ApiProperty({ description: 'true completes the payment, false voids it' })
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) note?: string;
}
