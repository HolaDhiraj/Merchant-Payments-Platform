import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantsModule } from '../merchants/merchants.module';
import { CustomerUseCases, LoyaltyAccounts } from './application/customer.use-cases';
import { CUSTOMER_REPOSITORY } from './domain/customer.repository';
import { CustomerOrmEntity, LoyaltyEntryOrmEntity } from './infrastructure/customer.orm-entities';
import { TypeOrmCustomerRepository } from './infrastructure/typeorm-customer.repository';
import { CustomersController } from './presentation/customers.controller';
import { PlatformCustomersController } from './presentation/platform-customers.controller';

// Each merchant's customers (found by phone) and their loyalty points.
// Exports LoyaltyAccounts so checkout can register customers and move points.
@Module({
  imports: [TypeOrmModule.forFeature([CustomerOrmEntity, LoyaltyEntryOrmEntity]), MerchantsModule],
  controllers: [CustomersController, PlatformCustomersController],
  providers: [
    { provide: CUSTOMER_REPOSITORY, useClass: TypeOrmCustomerRepository },
    CustomerUseCases,
    LoyaltyAccounts,
  ],
  exports: [LoyaltyAccounts],
})
export class CustomersModule {}
