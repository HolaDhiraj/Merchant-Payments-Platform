import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { Actor } from '../../../shared/domain/actor';
import { Role } from '../../../shared/domain/role.enum';
import { USER_REPOSITORY, UserRepository } from '../../../modules/users/domain/user.repository';
import { BusinessDetailsInput } from '../../../modules/merchant-applications/application/services/business-details.input';
import { AssignReviewerUseCase } from '../../../modules/merchant-applications/application/use-cases/assign-reviewer.use-case';
import { CreateMerchantApplicationUseCase } from '../../../modules/merchant-applications/application/use-cases/create-merchant-application.use-case';
import { GetMerchantApplicationUseCase } from '../../../modules/merchant-applications/application/use-cases/get-merchant-application.use-case';
import { ListMerchantApplicationsUseCase } from '../../../modules/merchant-applications/application/use-cases/list-merchant-applications.use-case';
import { RecordReviewDecisionUseCase } from '../../../modules/merchant-applications/application/use-cases/record-review-decision.use-case';
import { SubmitMerchantApplicationUseCase } from '../../../modules/merchant-applications/application/use-cases/submit-merchant-application.use-case';
import { UpdateMerchantApplicationUseCase } from '../../../modules/merchant-applications/application/use-cases/update-merchant-application.use-case';
import { BusinessType, SalesChannel } from '../../../modules/merchant-applications/domain/model/business-details';
import { MerchantApplication } from '../../../modules/merchant-applications/domain/model/merchant-application';
import { ReviewDecision } from '../../../modules/merchant-applications/domain/model/review-decision.enum';
import { RiskStatus } from '../../../modules/merchant-applications/domain/model/risk.enums';
import { seedDemoMerchants } from './seed-demo-merchants';

// Sample merchant applications for local development and demos.
// Everything goes through the real use cases: the sales user captures and submits, the background
// worker runs the (simulated) risk check, the admin assigns, and the reviewer decides. Statuses,
// risk results and the audit trail are therefore exactly what using the app would produce.
// Approved applications are then opened as merchants (see seed-demo-merchants.ts).
// Re-running is safe: merchants that already exist (by trading name) are skipped.
//
// Usage: set -a; . ./.env; set +a; npm run seed:demo   (run `npm run seed` first)

type Outcome =
  | { stage: 'draft' }
  | { stage: 'awaitingReviewer' }
  | { stage: 'inReview' }
  | { stage: 'approved'; reason?: string }
  | { stage: 'rejected'; reason: string }
  | { stage: 'infoRequested'; reason: string }
  | { stage: 'resubmittedThenApproved'; request: string; fix: Partial<BusinessDetailsInput['owner']> };

interface Sample {
  merchant: BusinessDetailsInput;
  outcome: Outcome;
}

// Money is in minor units. Risk levels follow from the simulated provider's rules
// (high-risk MCC, volume >= 1,000,000.00, ticket >= 5,000.00, card-not-present, sole proprietor).
const SAMPLES: Sample[] = [
  {
    merchant: {
      businessName: 'Harbor Street Bakery',
      legalBusinessName: 'Harbor Street Bakery LLC',
      businessType: BusinessType.LLC,
      taxId: '84-2917365',
      owner: { fullName: 'Maria Lopez', email: 'maria@harborstreetbakery.example', phone: '+14155550142' },
      processing: {
        merchantCategoryCode: '5462',
        currency: 'USD',
        expectedMonthlyVolumeMinor: 4_800_000,
        averageTicketMinor: 1_850,
        salesChannel: SalesChannel.CARD_PRESENT,
      },
    },
    outcome: { stage: 'approved' },
  },
  {
    merchant: {
      businessName: 'Corner Coffee Roasters',
      legalBusinessName: 'Corner Coffee Roasters LLC',
      businessType: BusinessType.LLC,
      taxId: '47-1830294',
      owner: { fullName: 'James Okafor', email: 'james@cornercoffee.example', phone: '+12065550178' },
      processing: {
        merchantCategoryCode: '5814',
        currency: 'USD',
        expectedMonthlyVolumeMinor: 2_500_000,
        averageTicketMinor: 750,
        salesChannel: SalesChannel.OMNICHANNEL,
      },
    },
    outcome: { stage: 'approved' },
  },
  {
    merchant: {
      businessName: 'Himalayan Trek Outfitters',
      legalBusinessName: 'Himalayan Trek Outfitters Partnership',
      businessType: BusinessType.PARTNERSHIP,
      taxId: 'NP604518732',
      owner: { fullName: 'Pasang Sherpa', email: 'pasang@himalayantrek.example', phone: '+9779851023456' },
      processing: {
        merchantCategoryCode: '5941',
        currency: 'NPR',
        expectedMonthlyVolumeMinor: 350_000_000,
        averageTicketMinor: 1_250_000,
        salesChannel: SalesChannel.OMNICHANNEL,
      },
    },
    outcome: { stage: 'approved', reason: 'High seasonal volume is consistent with trekking season; two years of statements reviewed.' },
  },
  {
    merchant: {
      businessName: 'Lakeside Yoga Studio',
      legalBusinessName: 'Anita Gurung',
      businessType: BusinessType.SOLE_PROPRIETORSHIP,
      taxId: 'NP301984456',
      owner: { fullName: 'Anita Gurung', email: 'anita@lakesideyoga.example', phone: '+9779806123456' },
      processing: {
        merchantCategoryCode: '7997',
        currency: 'USD',
        expectedMonthlyVolumeMinor: 950_000,
        averageTicketMinor: 2_500,
        salesChannel: SalesChannel.OMNICHANNEL,
      },
    },
    outcome: {
      stage: 'resubmittedThenApproved',
      request: 'The owner phone number does not answer. Please confirm a working contact number.',
      fix: { phone: '+9779806654321' },
    },
  },
  {
    merchant: {
      businessName: 'Kathmandu Momo House',
      legalBusinessName: 'Ramesh Shrestha',
      businessType: BusinessType.SOLE_PROPRIETORSHIP,
      taxId: 'NP609872341',
      owner: { fullName: 'Ramesh Shrestha', email: 'ramesh@momohouse.example', phone: '+9779841234567' },
      processing: {
        merchantCategoryCode: '5812',
        currency: 'NPR',
        expectedMonthlyVolumeMinor: 90_000_000,
        averageTicketMinor: 65_000,
        salesChannel: SalesChannel.CARD_PRESENT,
      },
    },
    outcome: {
      stage: 'infoRequested',
      reason: 'Please upload the food safety licence issued by the metropolitan city office.',
    },
  },
  {
    merchant: {
      businessName: 'Brightside Dental Clinic',
      legalBusinessName: 'Brightside Dental Group Inc.',
      businessType: BusinessType.CORPORATION,
      taxId: '91-4402871',
      owner: { fullName: 'Dr. Priya Raman', email: 'priya@brightsidedental.example', phone: '+16175550193' },
      processing: {
        merchantCategoryCode: '8021',
        currency: 'USD',
        expectedMonthlyVolumeMinor: 12_000_000,
        averageTicketMinor: 24_000,
        salesChannel: SalesChannel.CARD_PRESENT,
      },
    },
    outcome: { stage: 'inReview' },
  },
  {
    merchant: {
      businessName: 'QuickRemit Transfers',
      legalBusinessName: 'QuickRemit Financial Services Inc.',
      businessType: BusinessType.CORPORATION,
      taxId: '36-7712093',
      owner: { fullName: 'Daniel Mensah', email: 'daniel@quickremit.example', phone: '+13125550167' },
      processing: {
        merchantCategoryCode: '4829',
        currency: 'USD',
        expectedMonthlyVolumeMinor: 80_000_000,
        averageTicketMinor: 30_000,
        salesChannel: SalesChannel.OMNICHANNEL,
      },
    },
    outcome: { stage: 'inReview' },
  },
  {
    merchant: {
      businessName: 'Midnight Vape Lounge',
      legalBusinessName: 'Kevin Doyle',
      businessType: BusinessType.SOLE_PROPRIETORSHIP,
      taxId: '58-3390124',
      owner: { fullName: 'Kevin Doyle', email: 'kevin@midnightvape.example', phone: '+17025550111' },
      processing: {
        merchantCategoryCode: '5993',
        currency: 'USD',
        expectedMonthlyVolumeMinor: 3_000_000,
        averageTicketMinor: 3_500,
        salesChannel: SalesChannel.CARD_PRESENT,
      },
    },
    outcome: { stage: 'inReview' },
  },
  {
    merchant: {
      businessName: 'NovaBet Sports',
      legalBusinessName: 'NovaBet Gaming Ltd.',
      businessType: BusinessType.CORPORATION,
      taxId: '27-9054418',
      owner: { fullName: 'Victor Hale', email: 'victor@novabet.example', phone: '+17255550188' },
      processing: {
        merchantCategoryCode: '7995',
        currency: 'USD',
        expectedMonthlyVolumeMinor: 250_000_000,
        averageTicketMinor: 8_000,
        salesChannel: SalesChannel.CARD_NOT_PRESENT,
      },
    },
    outcome: {
      stage: 'rejected',
      reason: 'Online gambling is outside our risk appetite and no gaming licence was provided.',
    },
  },
  {
    merchant: {
      businessName: 'Luxe Timepieces',
      legalBusinessName: 'Luxe Timepieces LLC',
      businessType: BusinessType.LLC,
      taxId: '65-2208813',
      owner: { fullName: 'Sofia Laurent', email: 'sofia@luxetimepieces.example', phone: '+13055550124' },
      processing: {
        merchantCategoryCode: '5944',
        currency: 'USD',
        expectedMonthlyVolumeMinor: 45_000_000,
        averageTicketMinor: 750_000,
        salesChannel: SalesChannel.CARD_NOT_PRESENT,
      },
    },
    outcome: {
      stage: 'rejected',
      reason: 'High-ticket luxury goods sold online with no chargeback history or fulfilment evidence.',
    },
  },
  {
    merchant: {
      businessName: 'Pixel Forge Digital',
      legalBusinessName: 'Pixel Forge Digital LLC',
      businessType: BusinessType.LLC,
      taxId: '82-6617390',
      owner: { fullName: 'Aiko Tanaka', email: 'aiko@pixelforge.example', phone: '+15035550156' },
      processing: {
        merchantCategoryCode: '5734',
        currency: 'USD',
        expectedMonthlyVolumeMinor: 6_000_000,
        averageTicketMinor: 4_900,
        salesChannel: SalesChannel.CARD_NOT_PRESENT,
      },
    },
    outcome: { stage: 'awaitingReviewer' },
  },
  {
    merchant: {
      businessName: 'Green Valley Organic Grocers',
      legalBusinessName: 'Green Valley Organics Inc.',
      businessType: BusinessType.CORPORATION,
      taxId: '19-5523847',
      owner: { fullName: 'Hannah Becker', email: 'hannah@greenvalley.example', phone: '+15415550139' },
      processing: {
        merchantCategoryCode: '5411',
        currency: 'USD',
        expectedMonthlyVolumeMinor: 180_000_000,
        averageTicketMinor: 4_200,
        salesChannel: SalesChannel.CARD_PRESENT,
      },
    },
    outcome: { stage: 'awaitingReviewer' },
  },
  {
    merchant: {
      businessName: 'Everest Crafts Collective',
      legalBusinessName: 'Everest Crafts Collective',
      businessType: BusinessType.NON_PROFIT,
      taxId: 'NP702236619',
      owner: { fullName: 'Sita Tamang', email: 'sita@everestcrafts.example', phone: '+9779812345678' },
      processing: {
        merchantCategoryCode: '5970',
        currency: 'NPR',
        expectedMonthlyVolumeMinor: 40_000_000,
        averageTicketMinor: 120_000,
        salesChannel: SalesChannel.OMNICHANNEL,
      },
    },
    outcome: { stage: 'draft' },
  },
  {
    merchant: {
      businessName: 'Riverbend Auto Repair',
      legalBusinessName: 'Riverbend Auto Partners',
      businessType: BusinessType.PARTNERSHIP,
      taxId: '73-1186452',
      owner: { fullName: 'Tom Walsh', email: 'tom@riverbendauto.example', phone: '+16125550172' },
      processing: {
        merchantCategoryCode: '7538',
        currency: 'USD',
        expectedMonthlyVolumeMinor: 7_000_000,
        averageTicketMinor: 38_000,
        salesChannel: SalesChannel.CARD_PRESENT,
      },
    },
    outcome: { stage: 'draft' },
  },
];

const RISK_CHECK_TIMEOUT_MS = 60_000;
const logger = new Logger('SeedDemo');

async function seedDemoApplications(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    await run(app);
  } finally {
    await app.close();
  }
}

async function run(app: INestApplicationContext): Promise<void> {
  const sales = await actorFor(app, 'SEED_SALES_EMAIL', Role.SALES);
  const admin = await actorFor(app, 'SEED_ADMIN_EMAIL', Role.ADMIN);
  const reviewer = await actorFor(app, 'SEED_REVIEWER_EMAIL', Role.REVIEWER);

  const create = app.get(CreateMerchantApplicationUseCase);
  const update = app.get(UpdateMerchantApplicationUseCase);
  const submit = app.get(SubmitMerchantApplicationUseCase);
  const assign = app.get(AssignReviewerUseCase);
  const decide = app.get(RecordReviewDecisionUseCase);
  const get = app.get(GetMerchantApplicationUseCase);

  // Waits for the background worker to finish the risk check started by a submission.
  const riskChecked = async (id: string): Promise<MerchantApplication> => {
    const deadline = Date.now() + RISK_CHECK_TIMEOUT_MS;
    for (;;) {
      const application = await get.execute(admin, id);
      if (application.riskStatus === RiskStatus.COMPLETED) return application;
      if (application.riskStatus === RiskStatus.FAILED) {
        throw new Error(`Risk check failed for ${application.details.businessName}`);
      }
      if (Date.now() > deadline) {
        throw new Error('Risk check did not finish in time; is the outbox relay enabled?');
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  };

  const existing = await existingNames(app, admin);
  const pending = SAMPLES.filter((sample) => !existing.has(sample.merchant.businessName));
  for (const name of SAMPLES.filter((s) => existing.has(s.merchant.businessName)).map((s) => s.merchant.businessName)) {
    logger.log(`${name} already exists, skipped`);
  }

  // Create and submit everything first, so the risk checks run in parallel in the worker.
  const created: Array<{ sample: Sample; id: string }> = [];
  for (const sample of pending) {
    const application = await create.execute(sales, sample.merchant);
    if (sample.outcome.stage !== 'draft') {
      await submit.execute(sales, application.id);
    }
    created.push({ sample, id: application.id });
  }

  for (const { sample, id } of created) {
    const { outcome } = sample;
    const name = sample.merchant.businessName;
    if (outcome.stage === 'draft') {
      logger.log(`${name}: draft`);
      continue;
    }

    const checked = await riskChecked(id);
    const risk = `${checked.riskLevel} risk, score ${checked.riskScore}`;
    if (outcome.stage === 'awaitingReviewer') {
      logger.log(`${name}: in review, no reviewer yet (${risk})`);
      continue;
    }

    await assign.execute(admin, id, reviewer.userId);
    switch (outcome.stage) {
      case 'inReview':
        break;
      case 'approved':
        await decide.execute(reviewer, id, { decision: ReviewDecision.APPROVE, reason: outcome.reason });
        break;
      case 'rejected':
        await decide.execute(reviewer, id, { decision: ReviewDecision.REJECT, reason: outcome.reason });
        break;
      case 'infoRequested':
        await decide.execute(reviewer, id, { decision: ReviewDecision.REQUEST_INFO, reason: outcome.reason });
        break;
      case 'resubmittedThenApproved':
        await decide.execute(reviewer, id, { decision: ReviewDecision.REQUEST_INFO, reason: outcome.request });
        await update.execute(sales, id, { owner: outcome.fix });
        await submit.execute(sales, id);
        await riskChecked(id);
        await decide.execute(reviewer, id, { decision: ReviewDecision.APPROVE });
        break;
    }
    const final = await get.execute(admin, id);
    logger.log(`${name}: ${final.status} (${risk})`);
  }

  logger.log(`Applications: ${created.length} created, ${existing.size} already present`);

  // Approved applications become merchants with a catalogue and sales history.
  const signIns = await seedDemoMerchants(app, admin);
  if (signIns.length > 0) {
    logger.log('Merchant owner sign-ins (temporary passwords, changed at first sign-in):');
    // eslint-disable-next-line no-console
    console.table(signIns);
  }
}

async function actorFor(app: INestApplicationContext, emailVar: string, role: Role): Promise<Actor> {
  const email = process.env[emailVar];
  if (!email) throw new Error(`Set ${emailVar} (run with: set -a; . ./.env; set +a)`);
  const user = await app.get<UserRepository>(USER_REPOSITORY).findByEmail(email);
  if (!user) throw new Error(`${email} does not exist yet; run \`npm run seed\` first`);
  if (!user.isActive) throw new Error(`${email} is deactivated; reactivate it on the Team page first`);
  if (user.role !== role) throw new Error(`${email} must have the ${role} role`);
  return { userId: user.id, role };
}

async function existingNames(app: INestApplicationContext, admin: Actor): Promise<Set<string>> {
  const list = app.get(ListMerchantApplicationsUseCase);
  const names = new Set<string>();
  for (let page = 1; ; page++) {
    const result = await list.execute(admin, { page: { page, pageSize: 100 } });
    result.items.forEach((application) => names.add(application.details.businessName));
    if (page >= result.totalPages) return names;
  }
}

seedDemoApplications().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
