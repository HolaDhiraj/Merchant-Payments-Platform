import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { MERCHANT_ONBOARDING } from '../merchant-applications/domain/ports/merchant-onboarding';
import { UsersModule } from '../users/users.module';
import { MerchantOnboardingService } from './application/merchant-onboarding.service';
import {
  CurrentMerchantReader,
  UpdateMerchantSettingsUseCase,
} from './application/merchant-profile.use-cases';
import {
  AddMerchantUserUseCase,
  ListMerchantUsersUseCase,
  MerchantTeamMemberReader,
  ResetMerchantUserPasswordUseCase,
  SetMerchantUserActiveUseCase,
} from './application/merchant-team.use-cases';
import {
  GetMerchantUseCase,
  IssueOwnerPasswordUseCase,
  ListMerchantsUseCase,
} from './application/platform-merchants.use-cases';
import { MERCHANT_REPOSITORY } from './domain/merchant.repository';
import { MerchantOrmEntity } from './infrastructure/merchant.orm-entity';
import { TypeOrmMerchantRepository } from './infrastructure/typeorm-merchant.repository';
import { MerchantByIdPipe } from './presentation/merchant-by-id.pipe';
import { MerchantPortalController } from './presentation/merchant-portal.controller';
import { MerchantTeamController } from './presentation/merchant-team.controller';
import { MerchantsController } from './presentation/merchants.controller';
import { PlatformMerchantTeamController } from './presentation/platform-merchant-team.controller';

// Merchants: onboarding of approved applications, the merchant profile and settings,
// and each merchant's own team. Exposes the current-merchant reader to the portal modules, and
// MerchantByIdPipe to their read-only platform oversight routes (/merchants/:merchantId/...).
@Module({
  imports: [TypeOrmModule.forFeature([MerchantOrmEntity]), AuditModule, UsersModule],
  controllers: [
    MerchantsController,
    PlatformMerchantTeamController,
    MerchantPortalController,
    MerchantTeamController,
  ],
  providers: [
    { provide: MERCHANT_REPOSITORY, useClass: TypeOrmMerchantRepository },
    { provide: MERCHANT_ONBOARDING, useClass: MerchantOnboardingService },
    CurrentMerchantReader,
    UpdateMerchantSettingsUseCase,
    ListMerchantsUseCase,
    GetMerchantUseCase,
    IssueOwnerPasswordUseCase,
    MerchantTeamMemberReader,
    ListMerchantUsersUseCase,
    AddMerchantUserUseCase,
    SetMerchantUserActiveUseCase,
    ResetMerchantUserPasswordUseCase,
    MerchantByIdPipe,
  ],
  exports: [MERCHANT_ONBOARDING, MERCHANT_REPOSITORY, CurrentMerchantReader, MerchantByIdPipe],
})
export class MerchantsModule {}
