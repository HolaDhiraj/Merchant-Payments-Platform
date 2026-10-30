import { INestApplicationContext, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Actor } from '../../../shared/domain/actor';
import { Role } from '../../../shared/domain/role.enum';
import { CategoryUseCases, ProductUseCases } from '../../../modules/catalog/application/catalog.use-cases';
import { ListMerchantApplicationsUseCase } from '../../../modules/merchant-applications/application/use-cases/list-merchant-applications.use-case';
import { OnboardApprovedApplicationUseCase } from '../../../modules/merchant-applications/application/use-cases/onboard-approved-application.use-case';
import { ApplicationStatus } from '../../../modules/merchant-applications/domain/model/application-status.enum';
import {
  UpdateMerchantSettingsCommand,
  UpdateMerchantSettingsUseCase,
} from '../../../modules/merchants/application/merchant-profile.use-cases';
import { IssueOwnerPasswordUseCase } from '../../../modules/merchants/application/platform-merchants.use-cases';
import { Merchant } from '../../../modules/merchants/domain/merchant';
import { MERCHANT_REPOSITORY, MerchantRepository } from '../../../modules/merchants/domain/merchant.repository';
import { PaymentMethod } from '../../../modules/merchants/domain/payment-method.enum';
import { CheckoutCommand, CheckoutUseCase } from '../../../modules/payments/application/checkout.use-case';
import { USER_REPOSITORY, UserRepository } from '../../../modules/users/domain/user.repository';

// Second phase of `npm run seed:demo`: turns approved demo applications into merchants and
// gives two of them a catalogue, customers and two weeks of sales, so the merchant portal
// has something to show. Sales go through the real checkout (pricing, fraud screening,
// processor, loyalty); only their timestamps are moved into the past afterwards.

interface CatalogueSeed {
  settings: UpdateMerchantSettingsCommand;
  categories: Array<{ name: string; discountPercent: number | null }>;
  products: Array<{ name: string; sku: string; priceMinor: number; category?: string; discountPercent?: number; description?: string }>;
  customers: Array<{ fullName: string; phone: string }>;
}

const CATALOGUES: Record<string, CatalogueSeed> = {
  'Harbor Street Bakery': {
    // Small tickets: 1 point per 10.00 spent, worth 0.50.
    settings: { loyalty: { earnUnitMinor: 1_000, pointValueMinor: 50 } },
    categories: [
      { name: 'Bread', discountPercent: null },
      { name: 'Pastries', discountPercent: 10 },
      { name: 'Cakes', discountPercent: null },
      { name: 'Drinks', discountPercent: null },
    ],
    products: [
      { name: 'Sourdough loaf', sku: 'BRD-SOUR', priceMinor: 850, category: 'Bread', description: '48-hour fermented, 800 g.' },
      { name: 'Baguette', sku: 'BRD-BAG', priceMinor: 400, category: 'Bread' },
      { name: 'Croissant', sku: 'PST-CRO', priceMinor: 375, category: 'Pastries' },
      { name: 'Pain au chocolat', sku: 'PST-PAC', priceMinor: 425, category: 'Pastries', discountPercent: 15 },
      { name: 'Cinnamon roll', sku: 'PST-CIN', priceMinor: 450, category: 'Pastries' },
      { name: 'Carrot cake slice', sku: 'CAK-CAR', priceMinor: 550, category: 'Cakes' },
      { name: 'Celebration cake', sku: 'CAK-CEL', priceMinor: 4200, category: 'Cakes', discountPercent: 20, description: 'Whole cake, serves 10.' },
      { name: 'Cappuccino', sku: 'DRK-CAP', priceMinor: 420, category: 'Drinks' },
      { name: 'Fresh orange juice', sku: 'DRK-OJ', priceMinor: 500, category: 'Drinks' },
      { name: 'Day-old bread bag', sku: 'BRD-DAYOLD', priceMinor: 600, category: 'Bread', discountPercent: 50 },
    ],
    customers: [
      { fullName: 'Emma Clarke', phone: '+14155550111' },
      { fullName: 'Noah Bennett', phone: '+14155550122' },
      { fullName: 'Olivia Turner', phone: '+14155550133' },
      { fullName: 'Liam Foster', phone: '+14155550144' },
      { fullName: 'Ava Morales', phone: '+14155550155' },
      { fullName: 'Mason Reid', phone: '+14155550166' },
    ],
  },
  'Himalayan Trek Outfitters': {
    // NPR amounts are larger: screen from NPR 100,000; 1 point per NPR 1,000, worth NPR 10.
    settings: {
      highValueThresholdMinor: 10_000_000,
      loyalty: { earnUnitMinor: 100_000, pointValueMinor: 1_000 },
      settlementAccount: { bankName: 'Nabil Bank', accountHolder: 'Himalayan Trek Outfitters', accountNumber: '01234567890123' },
    },
    categories: [
      { name: 'Gear', discountPercent: 5 },
      { name: 'Clothing', discountPercent: null },
      { name: 'Rentals', discountPercent: null },
    ],
    products: [
      { name: 'Down jacket', sku: 'CLO-DOWN', priceMinor: 1_850_000, category: 'Clothing', description: '800-fill, rated to -15°C.' },
      { name: 'Merino socks', sku: 'CLO-SOCK', priceMinor: 125_000, category: 'Clothing' },
      { name: 'Trekking poles (pair)', sku: 'GER-POLE', priceMinor: 320_000, category: 'Gear' },
      { name: 'Headlamp', sku: 'GER-LAMP', priceMinor: 210_000, category: 'Gear' },
      { name: 'Water purifier', sku: 'GER-PURE', priceMinor: 160_000, category: 'Gear' },
      { name: 'Duffel bag 90 L', sku: 'GER-DUFF', priceMinor: 480_000, category: 'Gear', discountPercent: 10 },
      { name: 'Sleeping bag rental (per day)', sku: 'RNT-SLEEP', priceMinor: 45_000, category: 'Rentals' },
      { name: 'Annapurna trekking map', sku: 'GER-MAP', priceMinor: 65_000 },
    ],
    customers: [
      { fullName: 'Pemba Sherpa', phone: '+9779841111111' },
      { fullName: 'Sarah Lindqvist', phone: '+4670111222333' },
      { fullName: 'Bikash Thapa', phone: '+9779802222222' },
      { fullName: 'Hannah Weber', phone: '+4915112345678' },
      { fullName: 'Anjali Karki', phone: '+9779813333333' },
    ],
  },
};

const CARDS = ['4242424242424242', '5555555555554444', '4000056655665556', '5200828282828210', '6011111111111117'];
const DECLINED_CARD = '4000000000000002';
const DAYS = 14;

const logger = new Logger('SeedDemo');

// Small deterministic generator, so every run produces the same history.
function random(seed: number) {
  let state = seed;
  return {
    next(): number {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    },
    int(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick<T>(items: T[]): T {
      return items[this.int(0, items.length - 1)];
    },
  };
}

export interface OwnerSignIn {
  merchant: string;
  email: string;
  temporaryPassword: string;
}

export async function seedDemoMerchants(app: INestApplicationContext, admin: Actor): Promise<OwnerSignIn[]> {
  const merchants = app.get<MerchantRepository>(MERCHANT_REPOSITORY);
  const users = app.get<UserRepository>(USER_REPOSITORY);
  const approved = await app
    .get(ListMerchantApplicationsUseCase)
    .execute(admin, { status: ApplicationStatus.APPROVED, page: { page: 1, pageSize: 100 } });

  const signIns: OwnerSignIn[] = [];
  for (const application of approved.items) {
    let merchant = await merchants.findByApplicationId(application.id);
    if (!merchant) {
      const credentials = await app.get(OnboardApprovedApplicationUseCase).execute(admin, application.id);
      merchant = (await merchants.findById(credentials.merchantId))!;
      signIns.push({ merchant: merchant.tradingName, email: credentials.ownerEmail, temporaryPassword: credentials.temporaryPassword });
      logger.log(`${merchant.tradingName}: merchant account opened`);
    } else {
      // Owners who never signed in get a fresh one-time password, so the output is always usable.
      const owner = merchant.ownerUserId ? await users.findById(merchant.ownerUserId) : null;
      if (owner?.mustChangePassword) {
        const { temporaryPassword } = await app.get(IssueOwnerPasswordUseCase).execute(admin, merchant.id);
        signIns.push({ merchant: merchant.tradingName, email: owner.email, temporaryPassword });
      }
    }

    const catalogue = CATALOGUES[merchant.tradingName];
    if (catalogue && merchant.ownerUserId) {
      await seedPortal(app, merchant, { userId: merchant.ownerUserId, role: Role.MERCHANT_ADMIN, merchantId: merchant.id }, catalogue);
    }
  }
  return signIns;
}

async function seedPortal(app: INestApplicationContext, merchant: Merchant, owner: Actor, seed: CatalogueSeed): Promise<void> {
  const products = app.get(ProductUseCases);
  if ((await products.search(owner, {}, { page: 1, pageSize: 1 })).totalItems > 0) {
    logger.log(`${merchant.tradingName}: catalogue already present, skipped`);
    return;
  }
  const configured = await app.get(UpdateMerchantSettingsUseCase).execute(owner, seed.settings);

  const categoryIds = new Map<string, string>();
  for (const category of seed.categories) {
    const created = await app.get(CategoryUseCases).create(owner, category);
    categoryIds.set(category.name, created.id);
  }
  const productIds: string[] = [];
  for (const product of seed.products) {
    const created = await products.create(owner, {
      name: product.name,
      sku: product.sku,
      description: product.description ?? null,
      priceMinor: product.priceMinor,
      discountPercent: product.discountPercent ?? null,
      categoryId: product.category ? categoryIds.get(product.category)! : null,
      isActive: true,
    });
    productIds.push(created.product.id);
  }

  const counts = await seedSales(app, configured, owner, seed, productIds);
  logger.log(
    `${merchant.tradingName}: ${seed.products.length} products, ${seed.customers.length} customers, ${counts.total} payments (${counts.held} held, ${counts.declined} declined)`,
  );
}

async function seedSales(
  app: INestApplicationContext,
  merchant: Merchant,
  owner: Actor,
  seed: CatalogueSeed,
  productIds: string[],
): Promise<{ total: number; held: number; declined: number }> {
  const checkout = app.get(CheckoutUseCase);
  const dataSource = app.get(DataSource);
  const rng = random(merchant.tradingName.length * 7_919);
  const counts = { total: 0, held: 0, declined: 0 };
  const balances = new Map<string, number>();
  const now = Date.now();

  const record = async (command: CheckoutCommand, daysAgo: number, hour: number): Promise<void> => {
    const key = `seed-${merchant.id.slice(0, 8)}-${counts.total}`;
    const { payment } = await checkout.execute(owner, command, key);
    counts.total += 1;
    if (payment.status === 'PENDING_REVIEW') counts.held += 1;
    if (payment.status === 'DECLINED') counts.declined += 1;
    const phone = command.customer?.phone;
    if (phone && payment.status !== 'DECLINED') {
      balances.set(phone, (balances.get(phone) ?? 0) + payment.pointsEarned - payment.pointsRedeemed);
    }
    // Move the sale into the past, which also takes it out of the fraud rules' 10-minute window.
    const at = new Date(now - daysAgo * 86_400_000);
    at.setHours(hour, rng.int(0, 59), counts.total % 60, 0);
    if (at.getTime() > now - 15 * 60_000) at.setTime(now - (15 + counts.total) * 60_000);
    await dataSource.query(
      `UPDATE payment_transactions
         SET created_at = $2, updated_at = $2,
             completed_at = CASE WHEN completed_at IS NULL THEN NULL ELSE $2::timestamptz END
       WHERE id = $1`,
      [payment.id, at],
    );
    await dataSource.query(`UPDATE loyalty_ledger SET created_at = $2 WHERE transaction_id = $1`, [payment.id, at]);
  };

  // Oldest first, so points build up the way they would in real life.
  for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
    const salesToday = rng.int(2, 6);
    for (let sale = 0; sale < salesToday; sale++) {
      const items = Array.from({ length: rng.int(1, 3) }, () => ({ productId: rng.pick(productIds), quantity: rng.int(1, 3) }));
      const roll = rng.next();
      const method = roll < 0.45 ? PaymentMethod.CASH : roll < 0.8 ? PaymentMethod.CARD : PaymentMethod.BANK_TRANSFER;
      const customer = method === PaymentMethod.CASH || rng.next() < 0.6 ? rng.pick(seed.customers) : null;
      const command: CheckoutCommand = { items, method, customer: customer && { phone: customer.phone, fullName: customer.fullName } };

      const afterDiscount = await basketTotal(app, owner, items);
      // Returning customers sometimes spend points, within the merchant's cap.
      const balance = customer ? (balances.get(customer.phone) ?? 0) : 0;
      const cap = Math.floor((afterDiscount * merchant.loyalty.maxRedeemPercent) / 100 / merchant.loyalty.pointValueMinor);
      const redeem = Math.min(balance, cap, rng.int(1, 4));
      if (redeem > 0 && rng.next() < 0.4) command.pointsToRedeem = redeem;
      const toPay = afterDiscount - (command.pointsToRedeem ?? 0) * merchant.loyalty.pointValueMinor;

      if (method === PaymentMethod.CASH) {
        // Customers hand over the next round amount.
        const unit = merchant.currency === 'NPR' ? 50_000 : 500;
        command.cashTenderedMinor = Math.ceil(toPay / unit) * unit;
      }
      if (method === PaymentMethod.CARD) {
        command.card = {
          number: rng.pick(CARDS),
          expiryMonth: rng.int(1, 12),
          expiryYear: 2029,
          cvv: '123',
          holderName: customer?.fullName ?? 'Walk-in Customer',
        };
      }
      if (method === PaymentMethod.BANK_TRANSFER) {
        command.bankTransfer = { accountNumber: `01${rng.int(10_000_000, 99_999_999)}`, pin: '0000' };
      }
      await record(command, daysAgo, rng.int(9, 19));
    }
  }

  // A few stories worth seeing in the portal: a big sale held for review, a declined card, a wrong PIN.
  const cheapest = seed.products.reduce((min, product, index) => (product.priceMinor < seed.products[min].priceMinor ? index : min), 0);
  const priciest = seed.products.reduce((max, product, index) => (product.priceMinor > seed.products[max].priceMinor ? index : max), 0);
  const unitPrice = await basketTotal(app, owner, [{ productId: productIds[priciest], quantity: 1 }]);
  const regular = seed.customers[0];
  await record(
    {
      items: [{ productId: productIds[priciest], quantity: Math.ceil((merchant.highValueThresholdMinor * 1.2) / unitPrice) }],
      method: PaymentMethod.CARD,
      customer: { phone: regular.phone, fullName: regular.fullName },
      card: { number: CARDS[1], expiryMonth: 8, expiryYear: 2030, cvv: '123', holderName: regular.fullName },
    },
    0,
    11,
  );
  await record(
    {
      items: [{ productId: productIds[cheapest], quantity: 1 }],
      method: PaymentMethod.CARD,
      card: { number: DECLINED_CARD, expiryMonth: 4, expiryYear: 2029, cvv: '123', holderName: 'Walk-in Customer' },
    },
    1,
    15,
  );
  await record(
    {
      items: [{ productId: productIds[cheapest], quantity: 2 }],
      method: PaymentMethod.BANK_TRANSFER,
      bankTransfer: { accountNumber: '0198765432', pin: '1234' },
    },
    2,
    13,
  );

  // Last purchase dates follow the moved timestamps.
  await dataSource.query(
    `UPDATE customers c SET last_purchase_at = (
       SELECT max(completed_at) FROM payment_transactions p WHERE p.customer_id = c.id AND p.status = 'COMPLETED')
     WHERE c.merchant_id = $1`,
    [merchant.id],
  );
  return counts;
}

// What a basket costs after discounts, priced by the same rules as checkout.
async function basketTotal(
  app: INestApplicationContext,
  owner: Actor,
  items: Array<{ productId: string; quantity: number }>,
): Promise<number> {
  const products = app.get(ProductUseCases);
  let total = 0;
  for (const item of items) {
    total += (await products.get(owner, item.productId)).price.finalPriceMinor * item.quantity;
  }
  return total;
}
