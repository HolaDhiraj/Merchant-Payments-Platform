import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { PageMetaDto } from '../../../../shared/presentation/dto/page-response.dto';
import { PaginationQueryDto } from '../../../../shared/presentation/dto/pagination-query.dto';
import { Customer, LoyaltyEntry, LoyaltyEntryType } from '../../domain/customer';

const PHONE = /^\+?[0-9 ()-]{7,24}$/;

export class CreateCustomerDto {
  @ApiProperty() @IsString() @Length(2, 200) fullName: string;
  @ApiProperty({ example: '+9779812345678' }) @Matches(PHONE, { message: 'phone is not valid' }) phone: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((dto: CreateCustomerDto) => dto.email !== null)
  @IsEmail()
  email?: string | null;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 200) fullName?: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((dto: UpdateCustomerDto) => dto.email !== null)
  @IsEmail()
  email?: string | null;
}

export class ListCustomersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Name or phone' }) @IsOptional() @IsString() @Length(1, 100) q?: string;
}

export class LookupCustomerQueryDto {
  @ApiProperty() @Matches(PHONE, { message: 'phone is not valid' }) phone: string;
}

export class CustomerResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
  @ApiProperty() phone: string;
  @ApiProperty({ nullable: true }) email: string | null;
  @ApiProperty() pointsBalance: number;
  @ApiProperty() totalSpentMinor: number;
  @ApiProperty() visitCount: number;
  @ApiProperty({ nullable: true }) lastPurchaseAt: Date | null;
  @ApiProperty() createdAt: Date;

  static fromDomain(customer: Customer): CustomerResponseDto {
    const { merchantId: _merchantId, ...rest } = customer;
    return rest;
  }
}

export class CustomerPageResponseDto extends PageMetaDto {
  @ApiProperty({ type: [CustomerResponseDto] }) items: CustomerResponseDto[];
}

export class LoyaltyEntryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: LoyaltyEntryType }) type: LoyaltyEntryType;
  @ApiProperty() points: number;
  @ApiProperty() balanceAfter: number;
  @ApiProperty({ nullable: true }) transactionId: string | null;
  @ApiProperty() createdAt: Date;

  static fromDomain(entry: LoyaltyEntry): LoyaltyEntryResponseDto {
    const { merchantId: _merchantId, customerId: _customerId, ...rest } = entry;
    return rest;
  }
}

export class LoyaltyEntryPageResponseDto extends PageMetaDto {
  @ApiProperty({ type: [LoyaltyEntryResponseDto] }) items: LoyaltyEntryResponseDto[];
}

// Lookup by phone: `customer` is null for a number the merchant has not seen before.
export class CustomerLookupResponseDto {
  @ApiProperty({ type: CustomerResponseDto, nullable: true }) customer: CustomerResponseDto | null;
}
