import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessType } from '../../../merchant-applications/domain/model/business-details';
import { PageMetaDto } from '../../../../shared/presentation/dto/page-response.dto';
import { User } from '../../../users/domain/user';
import { Merchant, MerchantStatus } from '../../domain/merchant';

class AcceptedMethodsDto {
  @ApiProperty() cash: boolean;
  @ApiProperty() card: boolean;
  @ApiProperty() bankTransfer: boolean;
  @ApiProperty({ description: 'Always false: no QR provider is connected yet' }) qr: boolean;
}

// The account number itself is never returned, only its last 4 digits.
class SettlementAccountDto {
  @ApiProperty() bankName: string;
  @ApiProperty() accountHolder: string;
  @ApiProperty() accountLast4: string;
}

class LoyaltyDto {
  @ApiProperty() enabled: boolean;
  @ApiProperty({ description: 'Minor units spent per point earned' }) earnUnitMinor: number;
  @ApiProperty({ description: 'Value of one point in minor units' }) pointValueMinor: number;
  @ApiProperty() maxRedeemPercent: number;
}

class MerchantOwnerDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() fullName: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() mustChangePassword: boolean;
}

export class MerchantResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() applicationId: string;
  @ApiProperty() tradingName: string;
  @ApiProperty() legalName: string;
  @ApiProperty({ enum: BusinessType }) businessType: BusinessType;
  @ApiProperty() merchantCategoryCode: string;
  @ApiProperty() currency: string;
  @ApiProperty() contactName: string;
  @ApiProperty() contactEmail: string;
  @ApiProperty() contactPhone: string;
  @ApiProperty({ enum: MerchantStatus }) status: MerchantStatus;
  @ApiProperty({ type: AcceptedMethodsDto }) acceptedMethods: AcceptedMethodsDto;
  @ApiProperty({ type: SettlementAccountDto, nullable: true }) settlement: SettlementAccountDto | null;
  @ApiProperty() highValueThresholdMinor: number;
  @ApiProperty({ type: LoyaltyDto }) loyalty: LoyaltyDto;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional({ type: MerchantOwnerDto, nullable: true }) owner?: MerchantOwnerDto | null;

  static fromDomain(merchant: Merchant, owner?: User | null): MerchantResponseDto {
    return {
      id: merchant.id,
      applicationId: merchant.applicationId,
      tradingName: merchant.tradingName,
      legalName: merchant.legalName,
      businessType: merchant.businessType,
      merchantCategoryCode: merchant.merchantCategoryCode,
      currency: merchant.currency,
      contactName: merchant.contactName,
      contactEmail: merchant.contactEmail,
      contactPhone: merchant.contactPhone,
      status: merchant.status,
      acceptedMethods: { ...merchant.acceptedMethods, qr: false },
      settlement: merchant.settlement && {
        bankName: merchant.settlement.bankName,
        accountHolder: merchant.settlement.accountHolder,
        accountLast4: merchant.settlement.accountLast4,
      },
      highValueThresholdMinor: merchant.highValueThresholdMinor,
      loyalty: { ...merchant.loyalty },
      createdAt: merchant.createdAt,
      ...(owner !== undefined && {
        owner: owner && {
          id: owner.id,
          email: owner.email,
          fullName: owner.fullName,
          isActive: owner.isActive,
          mustChangePassword: owner.mustChangePassword,
        },
      }),
    };
  }
}

export class MerchantPageResponseDto extends PageMetaDto {
  @ApiProperty({ type: [MerchantResponseDto] }) items: MerchantResponseDto[];
}

// Shown once; the password is never stored or retrievable again.
export class TemporaryPasswordResponseDto {
  @ApiProperty() userId: string;
  @ApiProperty() email: string;
  @ApiProperty({ description: 'One-time password; must be changed at first sign-in' })
  temporaryPassword: string;
}
