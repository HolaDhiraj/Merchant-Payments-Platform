import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const MAX_MINOR = 100_000_000_000;

class AcceptedMethodsChangesDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() cash?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() card?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() bankTransfer?: boolean;
}

class LoyaltyChangesDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(MAX_MINOR) earnUnitMinor?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(MAX_MINOR) pointValueMinor?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) maxRedeemPercent?: number;
}

class SettlementAccountInputDto {
  @ApiPropertyOptional() @IsString() @Length(2, 120) bankName: string;
  @ApiPropertyOptional() @IsString() @Length(2, 200) accountHolder: string;
  @ApiPropertyOptional({ writeOnly: true, description: 'Stored encrypted; only the last 4 digits are shown' })
  @Matches(/^[0-9 -]{6,34}$/, { message: 'accountNumber must be 6-34 digits' })
  accountNumber: string;
}

export class UpdateMerchantSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'contactPhone must be in E.164 format' })
  contactPhone?: string;

  @ApiPropertyOptional({ type: AcceptedMethodsChangesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AcceptedMethodsChangesDto)
  acceptedMethods?: AcceptedMethodsChangesDto;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(MAX_MINOR) highValueThresholdMinor?: number;

  @ApiPropertyOptional({ type: LoyaltyChangesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LoyaltyChangesDto)
  loyalty?: LoyaltyChangesDto;

  @ApiPropertyOptional({ type: SettlementAccountInputDto, nullable: true, description: 'null removes it' })
  @IsOptional()
  @ValidateIf((dto: UpdateMerchantSettingsDto) => dto.settlementAccount !== null)
  @ValidateNested()
  @Type(() => SettlementAccountInputDto)
  settlementAccount?: SettlementAccountInputDto | null;
}
