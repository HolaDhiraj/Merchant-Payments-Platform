import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { BusinessType, SalesChannel } from '../../domain/model/business-details';

// Upper bound keeps amounts well inside Number.MAX_SAFE_INTEGER.
const MAX_AMOUNT_MINOR = 1_000_000_000_000_000;

export class OwnerContactDto {
  @ApiProperty({ example: 'Jordan Example' })
  @IsString()
  @Length(2, 200)
  fullName: string;

  @ApiProperty({ example: 'owner@example.test' })
  @IsEmail()
  @Length(3, 320)
  email: string;

  // E.164 format, e.g. +15555550100
  @ApiProperty({ example: '+15555550100' })
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be in E.164 format' })
  phone: string;
}

export class ProcessingProfileDto {
  @ApiProperty({ example: '5812', description: 'ISO 18245 merchant category code' })
  @Matches(/^\d{4}$/, { message: 'merchantCategoryCode must be 4 digits' })
  merchantCategoryCode: string;

  @ApiProperty({ example: 'USD', description: 'ISO 4217 currency code' })
  @Matches(/^[A-Za-z]{3}$/, { message: 'currency must be a 3-letter ISO 4217 code' })
  currency: string;

  @ApiProperty({ example: 2500000, description: 'Expected monthly volume in minor units (cents)' })
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_MINOR)
  expectedMonthlyVolumeMinor: number;

  @ApiProperty({ example: 4500, description: 'Average ticket size in minor units (cents)' })
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_MINOR)
  averageTicketMinor: number;

  @ApiProperty({ enum: SalesChannel })
  @IsEnum(SalesChannel)
  salesChannel: SalesChannel;
}

// Shared base for the create and update request bodies.
export class BusinessDetailsDto {
  @ApiProperty({ example: 'Corner Coffee' })
  @IsString()
  @Length(2, 200)
  businessName: string;

  @ApiProperty({ example: 'Corner Coffee LLC' })
  @IsString()
  @Length(2, 200)
  legalBusinessName: string;

  @ApiProperty({ enum: BusinessType })
  @IsEnum(BusinessType)
  businessType: BusinessType;

  // Sensitive: encrypted at rest and only returned masked.
  @ApiProperty({
    example: '00-0000000',
    description: 'Business tax id (synthetic test value)',
    writeOnly: true,
  })
  @Matches(/^[A-Za-z0-9 -]{6,24}$/, { message: 'taxId has an invalid format' })
  taxId: string;

  @ApiProperty({ type: OwnerContactDto })
  @ValidateNested()
  @Type(() => OwnerContactDto)
  owner: OwnerContactDto;

  @ApiProperty({ type: ProcessingProfileDto })
  @ValidateNested()
  @Type(() => ProcessingProfileDto)
  processing: ProcessingProfileDto;
}
