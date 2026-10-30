import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { CheckoutUseCase } from './application/checkout.use-case';
import { PaymentQueries } from './application/payment-queries.use-cases';
import { PaymentSettlement } from './application/payment-settlement.service';
import { ReviewPaymentUseCase } from './application/review-payment.use-case';
import { INSTRUMENT_FINGERPRINTER, PAYMENT_PROCESSOR } from './domain/payment-processor';
import { PAYMENT_REPORTS, PAYMENT_TRANSACTION_REPOSITORY } from './domain/payment-transaction.repository';
import { HmacInstrumentFingerprinter } from './infrastructure/hmac-instrument-fingerprinter';
import { PaymentLineOrmEntity, PaymentTransactionOrmEntity } from './infrastructure/payment.orm-entities';
import { SimulatedPaymentProcessor } from './infrastructure/simulated-payment-processor';
import { TypeOrmPaymentReports } from './infrastructure/typeorm-payment-reports';
import { TypeOrmPaymentTransactionRepository } from './infrastructure/typeorm-payment-transaction.repository';
import { PaymentsController } from './presentation/payments.controller';
import { PlatformPaymentsController } from './presentation/platform-payments.controller';

// Taking payments at the merchant's till: checkout (cash, card, bank transfer), fraud screening,
// review of held payments, history and sales reports. Connecting a real acquirer means
// replacing only the PAYMENT_PROCESSOR binding.
@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentTransactionOrmEntity, PaymentLineOrmEntity]),
    AuditModule,
    MerchantsModule,
    CatalogModule,
    CustomersModule,
  ],
  controllers: [PaymentsController, PlatformPaymentsController],
  providers: [
    { provide: PAYMENT_TRANSACTION_REPOSITORY, useClass: TypeOrmPaymentTransactionRepository },
    { provide: PAYMENT_REPORTS, useClass: TypeOrmPaymentReports },
    { provide: PAYMENT_PROCESSOR, useClass: SimulatedPaymentProcessor },
    { provide: INSTRUMENT_FINGERPRINTER, useClass: HmacInstrumentFingerprinter },
    PaymentSettlement,
    CheckoutUseCase,
    ReviewPaymentUseCase,
    PaymentQueries,
  ],
})
export class PaymentsModule {}
