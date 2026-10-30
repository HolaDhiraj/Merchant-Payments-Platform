import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageMetaDto } from '../../../../shared/presentation/dto/page-response.dto';
import { ApplicationStatus } from '../../domain/model/application-status.enum';
import { BusinessType, SalesChannel } from '../../domain/model/business-details';
import { MerchantApplication } from '../../domain/model/merchant-application';
import { ReviewDecision } from '../../domain/model/review-decision.enum';
import { RiskLevel, RiskStatus } from '../../domain/model/risk.enums';

class OwnerContactResponseDto {
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiProperty() phone: string;
}

class ProcessingProfileResponseDto {
  @ApiProperty() merchantCategoryCode: string;
  @ApiProperty() currency: string;
  @ApiProperty() expectedMonthlyVolumeMinor: number;
  @ApiProperty() averageTicketMinor: number;
  @ApiProperty({ enum: SalesChannel }) salesChannel: SalesChannel;
}

// API representation of an application. The tax id is always masked (e.g. "*****6789").
export class MerchantApplicationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() businessName: string;
  @ApiProperty() legalBusinessName: string;
  @ApiProperty({ enum: BusinessType }) businessType: BusinessType;
  @ApiProperty({ example: '*****6789' }) taxIdMasked: string;
  @ApiProperty({ type: OwnerContactResponseDto }) owner: OwnerContactResponseDto;
  @ApiProperty({ type: ProcessingProfileResponseDto }) processing: ProcessingProfileResponseDto;
  @ApiProperty({ enum: ApplicationStatus }) status: ApplicationStatus;
  @ApiProperty({ enum: RiskStatus }) riskStatus: RiskStatus;
  @ApiPropertyOptional({ enum: RiskLevel, nullable: true }) riskLevel: RiskLevel | null;
  @ApiPropertyOptional({ nullable: true }) riskScore: number | null;
  @ApiPropertyOptional({ nullable: true }) assignedReviewerId: string | null;
  @ApiProperty() createdById: string;
  @ApiProperty() submissionCount: number;
  @ApiPropertyOptional({ enum: ReviewDecision, nullable: true }) decision: ReviewDecision | null;
  @ApiPropertyOptional({ nullable: true }) decisionReason: string | null;
  @ApiPropertyOptional({ nullable: true }) decidedById: string | null;
  @ApiPropertyOptional({ nullable: true }) submittedAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) decidedAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty() version: number;

  static fromDomain(application: MerchantApplication): MerchantApplicationResponseDto {
    const { details } = application;
    return {
      id: application.id,
      businessName: details.businessName,
      legalBusinessName: details.legalBusinessName,
      businessType: details.businessType,
      taxIdMasked: details.taxId.masked(),
      owner: { ...details.owner },
      processing: { ...details.processing },
      status: application.status,
      riskStatus: application.riskStatus,
      riskLevel: application.riskLevel,
      riskScore: application.riskScore,
      assignedReviewerId: application.assignedReviewerId,
      createdById: application.createdById,
      submissionCount: application.submissionCount,
      decision: application.decision,
      decisionReason: application.decisionReason,
      decidedById: application.decidedById,
      submittedAt: application.submittedAt,
      decidedAt: application.decidedAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      version: application.version,
    };
  }
}

export class MerchantApplicationPageResponseDto extends PageMetaDto {
  @ApiProperty({ type: [MerchantApplicationResponseDto] })
  items: MerchantApplicationResponseDto[];
}

export class RiskAssessmentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() applicationId: string;
  @ApiProperty() submissionNumber: number;
  @ApiProperty() provider: string;
  @ApiProperty() providerReference: string;
  @ApiProperty() score: number;
  @ApiProperty({ enum: RiskLevel }) level: RiskLevel;
  @ApiProperty({ type: [String] }) reasons: string[];
  @ApiProperty() assessedAt: Date;
}

// One-time owner sign-in for a newly onboarded merchant. Shown once, never retrievable again.
export class OnboardingCredentialsDto {
  @ApiProperty() merchantId: string;
  @ApiProperty() ownerUserId: string;
  @ApiProperty() ownerEmail: string;
  @ApiProperty({ description: 'Must be changed at first sign-in' }) temporaryPassword: string;
}

export class DecisionResponseDto extends MerchantApplicationResponseDto {
  @ApiProperty({ type: OnboardingCredentialsDto, nullable: true })
  onboarding: OnboardingCredentialsDto | null;
}
