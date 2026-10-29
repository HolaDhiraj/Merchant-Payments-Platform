import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { Role } from '../../../shared/domain/role.enum';
import { DuplicateEntityError } from '../../../shared/domain/domain-errors';
import { CreateUserUseCase } from '../../../modules/users/application/create-user.use-case';

// Creates one user per role for local development. Credentials come only from environment
// variables (see .env.example); nothing is hard-coded, so no credentials live in the repository.
const SEEDS: Array<{ role: Role; emailVar: string; passwordVar: string; fullName: string }> = [
  {
    role: Role.ADMIN,
    emailVar: 'SEED_ADMIN_EMAIL',
    passwordVar: 'SEED_ADMIN_PASSWORD',
    fullName: 'Local Admin',
  },
  {
    role: Role.REVIEWER,
    emailVar: 'SEED_REVIEWER_EMAIL',
    passwordVar: 'SEED_REVIEWER_PASSWORD',
    fullName: 'Local Reviewer',
  },
  {
    role: Role.SALES,
    emailVar: 'SEED_SALES_EMAIL',
    passwordVar: 'SEED_SALES_PASSWORD',
    fullName: 'Local Sales',
  },
];

async function seed(): Promise<void> {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const createUser = app.get(CreateUserUseCase);

  for (const entry of SEEDS) {
    const email = process.env[entry.emailVar];
    const password = process.env[entry.passwordVar];
    if (!email || !password || password === 'CHANGE_ME') {
      logger.warn(`Skipping ${entry.role}: set ${entry.emailVar} and ${entry.passwordVar}`);
      continue;
    }
    try {
      await createUser.execute(null, {
        email,
        password,
        role: entry.role,
        fullName: entry.fullName,
      });
      logger.log(`Created ${entry.role} user ${email}`);
    } catch (error) {
      if (error instanceof DuplicateEntityError) {
        logger.log(`${entry.role} user ${email} already exists`);
      } else {
        throw error;
      }
    }
  }

  await app.close();
}

seed().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
