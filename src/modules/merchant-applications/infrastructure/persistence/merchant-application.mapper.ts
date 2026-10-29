import { Inject, Injectable } from '@nestjs/common';
import { FIELD_CIPHER, FieldCipher } from '../../../../shared/security/field-cipher';
import { MerchantApplication } from '../../domain/model/merchant-application';
import { TaxId } from '../../domain/model/tax-id';
import { MerchantApplicationOrmEntity } from './merchant-application.orm-entity';

// Translates between the domain aggregate and its table row.
// Field-level encryption happens here, at the persistence boundary, so the domain works with
// plain value objects and the database only ever sees ciphertext.
@Injectable()
export class MerchantApplicationMapper {
  constructor(@Inject(FIELD_CIPHER) private readonly cipher: FieldCipher) {}

  toDomain(row: MerchantApplicationOrmEntity): MerchantApplication {
    return MerchantApplication.restore({
      id: row.id,
      createdById: row.createdById,
      details: {
        businessName: row.businessName,
        legalBusinessName: row.legalBusinessName,
        businessType: row.businessType,
        taxId: TaxId.of(this.cipher.decrypt(row.taxIdEncrypted)),
        owner: { fullName: row.ownerFullName, email: row.ownerEmail, phone: row.ownerPhone },
        processing: {
          merchantCategoryCode: row.merchantCategoryCode,
          currency: row.currency,
          expectedMonthlyVolumeMinor: row.expectedMonthlyVolumeMinor,
          averageTicketMinor: row.averageTicketMinor,
          salesChannel: row.salesChannel,
        },
      },
      status: row.status,
      riskStatus: row.riskStatus,
      riskLevel: row.riskLevel,
      riskScore: row.riskScore,
      assignedReviewerId: row.assignedReviewerId,
      submissionCount: row.submissionCount,
      decision: row.decision,
      decisionReason: row.decisionReason,
      decidedById: row.decidedById,
      submittedAt: row.submittedAt,
      decidedAt: row.decidedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  }

  toRow(application: MerchantApplication): MerchantApplicationOrmEntity {
    const { details } = application;
    const row = new MerchantApplicationOrmEntity();
    row.id = application.id;
    row.createdById = application.createdById;
    row.businessName = details.businessName;
    row.legalBusinessName = details.legalBusinessName;
    row.businessType = details.businessType;
    row.taxIdEncrypted = this.cipher.encrypt(details.taxId.reveal());
    row.taxIdLast4 = details.taxId.lastFour();
    row.ownerFullName = details.owner.fullName;
    row.ownerEmail = details.owner.email;
    row.ownerPhone = details.owner.phone;
    row.merchantCategoryCode = details.processing.merchantCategoryCode;
    row.currency = details.processing.currency;
    row.expectedMonthlyVolumeMinor = details.processing.expectedMonthlyVolumeMinor;
    row.averageTicketMinor = details.processing.averageTicketMinor;
    row.salesChannel = details.processing.salesChannel;
    row.status = application.status;
    row.riskStatus = application.riskStatus;
    row.riskLevel = application.riskLevel;
    row.riskScore = application.riskScore;
    row.assignedReviewerId = application.assignedReviewerId;
    row.submissionCount = application.submissionCount;
    row.decision = application.decision;
    row.decisionReason = application.decisionReason;
    row.decidedById = application.decidedById;
    row.submittedAt = application.submittedAt;
    row.decidedAt = application.decidedAt;
    row.createdAt = application.createdAt;
    row.updatedAt = application.updatedAt;
    row.version = application.version;
    return row;
  }
}
