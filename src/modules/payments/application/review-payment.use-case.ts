import { Inject, Injectable, Logger } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import { Clock, CLOCK } from '../../../shared/domain/clock';
import { EntityNotFoundError } from '../../../shared/domain/domain-errors';
import { UNIT_OF_WORK, UnitOfWork } from '../../../shared/application/unit-of-work';
import { AuditLogger } from '../../audit/application/audit-logger';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { CurrentMerchantReader } from '../../merchants/application/merchant-profile.use-cases';
import { PAYMENT_PROCESSOR, PaymentProcessor } from '../domain/payment-processor';
import { PaymentStatus, PaymentTransaction } from '../domain/payment-transaction';
import {
  PAYMENT_TRANSACTION_REPOSITORY,
  PaymentTransactionRepository,
} from '../domain/payment-transaction.repository';
import { PaymentSettlement } from './payment-settlement.service';

export interface ReviewPaymentCommand {
  approve: boolean;
  note?: string | null;
}

// A merchant reviewer (or admin) decides on a payment held by fraud screening:
// approve -> COMPLETED (counts as collected, points awarded);
// reject  -> VOIDED (authorization released, reserved points given back).
@Injectable()
export class ReviewPaymentUseCase {
  private readonly logger = new Logger(ReviewPaymentUseCase.name);

  constructor(
    private readonly currentMerchant: CurrentMerchantReader,
    private readonly settlement: PaymentSettlement,
    @Inject(PAYMENT_TRANSACTION_REPOSITORY) private readonly payments: PaymentTransactionRepository,
    @Inject(PAYMENT_PROCESSOR) private readonly processor: PaymentProcessor,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(actor: Actor, paymentId: string, command: ReviewPaymentCommand): Promise<PaymentTransaction> {
    const merchant = await this.currentMerchant.get(actor);
    const payment = await this.unitOfWork.run(async () => {
      const current = await this.payments.findById(merchant.id, paymentId);
      if (!current) throw new EntityNotFoundError('Payment', paymentId);
      const now = this.clock.now();
      if (command.approve) {
        current.approveReview(actor.userId, command.note ?? null, now);
        await this.settlement.completed(current, merchant);
      } else {
        current.rejectReview(actor.userId, command.note ?? null, now);
        await this.settlement.cancelled(current);
      }
      await this.payments.update(current);
      await this.audit.record({
        actor,
        action: AuditAction.PAYMENT_REVIEWED,
        entityType: 'Payment',
        entityId: current.id,
        metadata: {
          merchantId: merchant.id,
          reference: current.reference,
          outcome: current.status,
          fraudScore: current.fraud.score,
        },
      });
      return current;
    });

    // After commit: release the held funds. A failure here is logged for reconciliation;
    // the payment is already voided on our side and is never counted as collected.
    if (payment.status === PaymentStatus.VOIDED && payment.authorizationCode) {
      await this.processor.release(payment.authorizationCode).catch((error: Error) => {
        this.logger.error(`Could not release authorization for payment ${payment.id}: ${error.name}`);
      });
    }
    return payment;
  }
}
