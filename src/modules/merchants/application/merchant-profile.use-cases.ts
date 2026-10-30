import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import { Clock, CLOCK } from '../../../shared/domain/clock';
import { EntityNotFoundError } from '../../../shared/domain/domain-errors';
import { merchantIdOf } from '../../../shared/application/merchant-scope';
import { UNIT_OF_WORK, UnitOfWork } from '../../../shared/application/unit-of-work';
import { FIELD_CIPHER, FieldCipher } from '../../../shared/security/field-cipher';
import { AuditLogger } from '../../audit/application/audit-logger';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { Merchant, MerchantSettingsChanges } from '../domain/merchant';
import { MERCHANT_REPOSITORY, MerchantRepository } from '../domain/merchant.repository';

// Loads the caller's own merchant. Shared by every merchant-portal use case.
@Injectable()
export class CurrentMerchantReader {
  constructor(@Inject(MERCHANT_REPOSITORY) private readonly merchants: MerchantRepository) {}

  async get(actor: Actor): Promise<Merchant> {
    const merchantId = merchantIdOf(actor);
    const merchant = await this.merchants.findById(merchantId);
    if (!merchant) throw new EntityNotFoundError('Merchant', merchantId);
    return merchant;
  }
}

export interface UpdateMerchantSettingsCommand extends MerchantSettingsChanges {
  // undefined leaves the account unchanged, null removes it.
  settlementAccount?: { bankName: string; accountHolder: string; accountNumber: string } | null;
}

// The merchant admin configures payment acceptance, payout account, loyalty and fraud threshold.
@Injectable()
export class UpdateMerchantSettingsUseCase {
  constructor(
    private readonly currentMerchant: CurrentMerchantReader,
    @Inject(MERCHANT_REPOSITORY) private readonly merchants: MerchantRepository,
    @Inject(FIELD_CIPHER) private readonly cipher: FieldCipher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  execute(actor: Actor, command: UpdateMerchantSettingsCommand): Promise<Merchant> {
    return this.unitOfWork.run(async () => {
      const merchant = await this.currentMerchant.get(actor);
      const now = this.clock.now();
      const { settlementAccount, ...settings } = command;
      merchant.updateSettings(settings, now);

      if (settlementAccount === null) {
        merchant.changeSettlementAccount(null, now);
      } else if (settlementAccount) {
        const accountNumber = settlementAccount.accountNumber.replace(/[\s-]/g, '');
        merchant.changeSettlementAccount(
          {
            bankName: settlementAccount.bankName.trim(),
            accountHolder: settlementAccount.accountHolder.trim(),
            accountNumberEncrypted: this.cipher.encrypt(accountNumber),
            accountLast4: accountNumber.slice(-4),
          },
          now,
        );
      }

      await this.merchants.update(merchant);
      await this.audit.record({
        actor,
        action: AuditAction.MERCHANT_SETTINGS_UPDATED,
        entityType: 'Merchant',
        entityId: merchant.id,
        // Which areas changed, never the values (the account number in particular).
        metadata: {
          changed: Object.keys(command).filter(
            (key) => command[key as keyof UpdateMerchantSettingsCommand] !== undefined,
          ),
        },
      });
      return merchant;
    });
  }
}
