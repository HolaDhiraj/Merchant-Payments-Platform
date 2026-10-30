import { MigrationInterface, QueryRunner } from 'typeorm';

// Merchant portal: approved applications become merchants with their own users, catalogue,
// customers and payments. Key decisions:
//  - Every merchant-owned row carries merchant_id, and uniqueness is per merchant (tenant isolation).
//  - Users: merchant roles always have a merchant_id, platform roles never do (CHECK).
//  - Payments store no card number, CVV, bank account number or PIN: only brand, last 4 digits and
//    a keyed fingerprint (HMAC) used by fraud velocity rules. The settlement account is encrypted.
//  - (merchant_id, idempotency_key) is UNIQUE, so a retried checkout can never charge twice.
//  - Money is BIGINT minor units with CHECK constraints; discounts are whole percentages 0-100.
export class MerchantPortal1730000000003 implements MigrationInterface {
  name = 'MerchantPortal1730000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const role of ['MERCHANT_ADMIN', 'MERCHANT_SALES', 'MERCHANT_REVIEWER']) {
      await queryRunner.query(`ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS '${role}'`);
    }
    await queryRunner.query(`CREATE TYPE "merchant_status" AS ENUM ('ACTIVE', 'SUSPENDED')`);
    await queryRunner.query(
      `CREATE TYPE "payment_method" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'QR')`,
    );
    await queryRunner.query(
      `CREATE TYPE "payment_status" AS ENUM ('PROCESSING', 'COMPLETED', 'PENDING_REVIEW', 'DECLINED', 'VOIDED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "loyalty_entry_type" AS ENUM ('EARN', 'REDEEM', 'RESTORE')`,
    );
    await queryRunner.query(`CREATE TYPE "fraud_decision" AS ENUM ('ALLOW', 'REVIEW', 'BLOCK')`);

    await queryRunner.query(`
      CREATE TABLE "merchants" (
        "id" uuid PRIMARY KEY,
        "application_id" uuid NOT NULL REFERENCES "merchant_applications"("id") ON DELETE RESTRICT,
        "trading_name" varchar(200) NOT NULL,
        "legal_name" varchar(200) NOT NULL,
        "business_type" "business_type" NOT NULL,
        "merchant_category_code" char(4) NOT NULL,
        "currency" char(3) NOT NULL,
        "contact_name" varchar(200) NOT NULL,
        "contact_email" varchar(320) NOT NULL,
        "contact_phone" varchar(32) NOT NULL,
        "status" "merchant_status" NOT NULL DEFAULT 'ACTIVE',
        "accept_cash" boolean NOT NULL DEFAULT true,
        "accept_card" boolean NOT NULL DEFAULT true,
        "accept_bank_transfer" boolean NOT NULL DEFAULT true,
        "settlement_bank_name" varchar(120),
        "settlement_account_holder" varchar(200),
        "settlement_account_encrypted" text,
        "settlement_account_last4" varchar(4),
        "high_value_threshold_minor" bigint NOT NULL,
        "loyalty_enabled" boolean NOT NULL DEFAULT true,
        "loyalty_earn_unit_minor" bigint NOT NULL,
        "loyalty_point_value_minor" bigint NOT NULL,
        "loyalty_max_redeem_percent" smallint NOT NULL DEFAULT 50,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_merchants_application" UNIQUE ("application_id"),
        CONSTRAINT "chk_merchants_threshold" CHECK ("high_value_threshold_minor" > 0),
        CONSTRAINT "chk_merchants_loyalty" CHECK (
          "loyalty_earn_unit_minor" > 0 AND "loyalty_point_value_minor" > 0
          AND "loyalty_max_redeem_percent" BETWEEN 0 AND 100
        ),
        CONSTRAINT "chk_merchants_settlement" CHECK (
          ("settlement_account_encrypted" IS NULL) = ("settlement_account_last4" IS NULL)
        )
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "merchant_id" uuid REFERENCES "merchants"("id") ON DELETE RESTRICT,
        ADD COLUMN "must_change_password" boolean NOT NULL DEFAULT false,
        ADD CONSTRAINT "chk_users_merchant_scope" CHECK (
          ("role"::text LIKE 'MERCHANT\\_%') = ("merchant_id" IS NOT NULL)
        )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_users_merchant" ON "users" ("merchant_id") WHERE "merchant_id" IS NOT NULL`,
    );
    // The owner is created right after the merchant, in the same transaction.
    await queryRunner.query(
      `ALTER TABLE "merchants" ADD COLUMN "owner_user_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT`,
    );

    await queryRunner.query(`
      CREATE TABLE "product_categories" (
        "id" uuid PRIMARY KEY,
        "merchant_id" uuid NOT NULL REFERENCES "merchants"("id") ON DELETE RESTRICT,
        "name" varchar(80) NOT NULL,
        "discount_percent" smallint,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_categories_discount" CHECK ("discount_percent" BETWEEN 0 AND 100)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_categories_name" ON "product_categories" ("merchant_id", lower("name"))`,
    );

    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid PRIMARY KEY,
        "merchant_id" uuid NOT NULL REFERENCES "merchants"("id") ON DELETE RESTRICT,
        "category_id" uuid REFERENCES "product_categories"("id") ON DELETE SET NULL,
        "name" varchar(120) NOT NULL,
        "sku" varchar(40) NOT NULL,
        "description" varchar(1000),
        "price_minor" bigint NOT NULL,
        "discount_percent" smallint,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_products_price" CHECK ("price_minor" > 0),
        CONSTRAINT "chk_products_discount" CHECK ("discount_percent" BETWEEN 0 AND 100)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_products_sku" ON "products" ("merchant_id", lower("sku"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_products_category" ON "products" ("category_id")`);

    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid PRIMARY KEY,
        "merchant_id" uuid NOT NULL REFERENCES "merchants"("id") ON DELETE RESTRICT,
        "full_name" varchar(200) NOT NULL,
        "phone" varchar(32) NOT NULL,
        "email" varchar(320),
        "points_balance" integer NOT NULL DEFAULT 0,
        "total_spent_minor" bigint NOT NULL DEFAULT 0,
        "visit_count" integer NOT NULL DEFAULT 0,
        "last_purchase_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_customers_phone" UNIQUE ("merchant_id", "phone"),
        CONSTRAINT "chk_customers_points" CHECK ("points_balance" >= 0),
        CONSTRAINT "chk_customers_totals" CHECK ("total_spent_minor" >= 0 AND "visit_count" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payment_transactions" (
        "id" uuid PRIMARY KEY,
        "merchant_id" uuid NOT NULL REFERENCES "merchants"("id") ON DELETE RESTRICT,
        "reference" varchar(32) NOT NULL,
        "idempotency_key" varchar(100) NOT NULL,
        "request_fingerprint" char(64) NOT NULL,
        "cashier_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "customer_id" uuid REFERENCES "customers"("id") ON DELETE RESTRICT,
        "method" "payment_method" NOT NULL,
        "status" "payment_status" NOT NULL,
        "currency" char(3) NOT NULL,
        "subtotal_minor" bigint NOT NULL,
        "discount_minor" bigint NOT NULL,
        "points_redeemed" integer NOT NULL DEFAULT 0,
        "points_discount_minor" bigint NOT NULL DEFAULT 0,
        "total_minor" bigint NOT NULL,
        "amount_tendered_minor" bigint,
        "change_minor" bigint,
        "points_earned" integer NOT NULL DEFAULT 0,
        "instrument_brand" varchar(30),
        "instrument_last4" varchar(4),
        "instrument_fingerprint" char(64),
        "authorization_code" varchar(40),
        "decline_reason" varchar(200),
        "fraud_score" smallint NOT NULL,
        "fraud_reasons" jsonb NOT NULL DEFAULT '[]',
        "fraud_decision" "fraud_decision" NOT NULL,
        "reviewed_by_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
        "reviewed_at" timestamptz,
        "review_note" varchar(500),
        "completed_at" timestamptz,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_payments_idempotency" UNIQUE ("merchant_id", "idempotency_key"),
        CONSTRAINT "uq_payments_reference" UNIQUE ("merchant_id", "reference"),
        CONSTRAINT "chk_payments_amounts" CHECK (
          "subtotal_minor" > 0 AND "discount_minor" >= 0 AND "points_discount_minor" >= 0
          AND "total_minor" > 0
          AND "total_minor" = "subtotal_minor" - "discount_minor" - "points_discount_minor"
        ),
        CONSTRAINT "chk_payments_points" CHECK ("points_redeemed" >= 0 AND "points_earned" >= 0),
        CONSTRAINT "chk_payments_cash" CHECK (
          "method" <> 'CASH' OR ("customer_id" IS NOT NULL AND "amount_tendered_minor" >= "total_minor")
        ),
        CONSTRAINT "chk_payments_fraud_score" CHECK ("fraud_score" BETWEEN 0 AND 100)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_payments_merchant_created" ON "payment_transactions" ("merchant_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payments_instrument" ON "payment_transactions" ("merchant_id", "instrument_fingerprint", "created_at") WHERE "instrument_fingerprint" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payments_customer" ON "payment_transactions" ("customer_id", "created_at") WHERE "customer_id" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "payment_transaction_items" (
        "id" uuid PRIMARY KEY,
        "transaction_id" uuid NOT NULL REFERENCES "payment_transactions"("id") ON DELETE CASCADE,
        "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
        "name" varchar(120) NOT NULL,
        "sku" varchar(40) NOT NULL,
        "unit_price_minor" bigint NOT NULL,
        "discount_percent" smallint NOT NULL DEFAULT 0,
        "quantity" integer NOT NULL,
        "line_total_minor" bigint NOT NULL,
        CONSTRAINT "chk_items_values" CHECK (
          "unit_price_minor" > 0 AND "quantity" > 0 AND "line_total_minor" >= 0
          AND "discount_percent" BETWEEN 0 AND 100
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_items_transaction" ON "payment_transaction_items" ("transaction_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "loyalty_ledger" (
        "id" uuid PRIMARY KEY,
        "merchant_id" uuid NOT NULL REFERENCES "merchants"("id") ON DELETE RESTRICT,
        "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
        "transaction_id" uuid REFERENCES "payment_transactions"("id") ON DELETE RESTRICT,
        "type" "loyalty_entry_type" NOT NULL,
        "points" integer NOT NULL,
        "balance_after" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_loyalty_points" CHECK ("points" <> 0 AND "balance_after" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_loyalty_customer" ON "loyalty_ledger" ("customer_id", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "loyalty_ledger"`);
    await queryRunner.query(`DROP TABLE "payment_transaction_items"`);
    await queryRunner.query(`DROP TABLE "payment_transactions"`);
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TABLE "product_categories"`);
    await queryRunner.query(`UPDATE "merchants" SET "owner_user_id" = NULL`);
    await queryRunner.query(`DELETE FROM "users" WHERE "merchant_id" IS NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP CONSTRAINT "chk_users_merchant_scope",
        DROP COLUMN "must_change_password",
        DROP COLUMN "merchant_id"
    `);
    await queryRunner.query(`DROP TABLE "merchants"`);
    await queryRunner.query(`DROP TYPE "fraud_decision"`);
    await queryRunner.query(`DROP TYPE "loyalty_entry_type"`);
    await queryRunner.query(`DROP TYPE "payment_status"`);
    await queryRunner.query(`DROP TYPE "payment_method"`);
    await queryRunner.query(`DROP TYPE "merchant_status"`);
    // PostgreSQL cannot drop enum values; the extra user_role values stay but are unused.
  }
}
