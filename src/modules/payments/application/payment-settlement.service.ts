import { Injectable } from '@nestjs/common';
import { LoyaltyAccounts } from '../../customers/application/customer.use-cases';
import { pointsEarned } from '../../customers/domain/loyalty';
import { Merchant } from '../../merchants/domain/merchant';
import { PaymentStatus, PaymentTransaction } from '../domain/payment-transaction';

// What happens to the customer's account once a payment's outcome is final.
// Always called inside the unit of work that changes the payment's status.
@Injectable()
export class PaymentSettlement {
  constructor(private readonly loyalty: LoyaltyAccounts) {}

  // Completed: count the visit and spend, and award points on the amount actually paid.
  async completed(payment: PaymentTransaction, merchant: Merchant): Promise<void> {
    if (payment.status !== PaymentStatus.COMPLETED || !payment.customerId) return;
    const customer = await this.loyalty.find(payment.merchantId, payment.customerId);
    if (!customer) return;
    const points = pointsEarned(merchant.loyalty, payment.totalMinor);
    await this.loyalty.earn(customer, points, payment.id);
    await this.loyalty.recordPurchase(customer, payment.totalMinor);
    payment.awardPoints(points);
  }

  // Declined or voided: give back any points that were reserved for this payment.
  async cancelled(payment: PaymentTransaction): Promise<void> {
    if (!payment.customerId || payment.pointsRedeemed === 0) return;
    const customer = await this.loyalty.find(payment.merchantId, payment.customerId);
    if (customer) await this.loyalty.restore(customer, payment.pointsRedeemed, payment.id);
  }
}
