import { MigrationInterface, QueryRunner } from 'typeorm';

// Tracks consecutive failed sign-ins so an account can be locked after too many.
//  - failed_login_attempts: reset to 0 by a successful sign-in or an admin unlock.
//  - locked_at: set when the threshold is reached; only an admin can clear it.
export class UserLoginLockout1730000000002 implements MigrationInterface {
  name = 'UserLoginLockout1730000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "failed_login_attempts" integer NOT NULL DEFAULT 0,
        ADD COLUMN "locked_at" timestamptz,
        ADD CONSTRAINT "chk_users_failed_login_attempts" CHECK ("failed_login_attempts" >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP CONSTRAINT "chk_users_failed_login_attempts",
        DROP COLUMN "locked_at",
        DROP COLUMN "failed_login_attempts"
    `);
  }
}
