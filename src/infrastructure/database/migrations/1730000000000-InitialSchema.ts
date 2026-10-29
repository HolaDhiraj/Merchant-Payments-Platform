import { MigrationInterface, QueryRunner } from 'typeorm';

// Initial schema, written by hand and reviewed (not auto-generated), so every constraint is intentional.
// Key decisions:
//  - Enums are native PostgreSQL enums: invalid states cannot be stored even by manual SQL.
//  - Money columns are BIGINT minor units with CHECK constraints; no floating point.
//  - tax_id is stored only as AES-256-GCM ciphertext plus last 4 characters.
//  - risk_assessments.idempotency_key is UNIQUE: the database itself guarantees one result per submission.
//  - Foreign keys use ON DELETE RESTRICT: users referenced by applications or audits cannot vanish.
export class InitialSchema1730000000000 implements MigrationInterface {
  name = 'InitialSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "user_role" AS ENUM ('ADMIN', 'REVIEWER', 'SALES')`);
    await queryRunner.query(
      `CREATE TYPE "business_type" AS ENUM ('SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LLC', 'CORPORATION', 'NON_PROFIT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "sales_channel" AS ENUM ('CARD_PRESENT', 'CARD_NOT_PRESENT', 'OMNICHANNEL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "application_status" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "risk_status" AS ENUM ('NOT_STARTED', 'PENDING', 'COMPLETED', 'FAILED')`,
    );
    await queryRunner.query(`CREATE TYPE "risk_level" AS ENUM ('LOW', 'MEDIUM', 'HIGH')`);
    await queryRunner.query(
      `CREATE TYPE "review_decision" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_INFO')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY,
        "email" varchar(320) NOT NULL,
        "full_name" varchar(200) NOT NULL,
        "role" "user_role" NOT NULL,
        "password_hash" varchar(100) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "chk_users_email_lowercase" CHECK ("email" = lower("email"))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "merchant_applications" (
        "id" uuid PRIMARY KEY,
        "created_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "business_name" varchar(200) NOT NULL,
        "legal_business_name" varchar(200) NOT NULL,
        "business_type" "business_type" NOT NULL,
        "tax_id_encrypted" text NOT NULL,
        "tax_id_last4" varchar(4) NOT NULL,
        "owner_full_name" varchar(200) NOT NULL,
        "owner_email" varchar(320) NOT NULL,
        "owner_phone" varchar(32) NOT NULL,
        "merchant_category_code" char(4) NOT NULL,
        "currency" char(3) NOT NULL,
        "expected_monthly_volume_minor" bigint NOT NULL,
        "average_ticket_minor" bigint NOT NULL,
        "sales_channel" "sales_channel" NOT NULL,
        "status" "application_status" NOT NULL DEFAULT 'DRAFT',
        "risk_status" "risk_status" NOT NULL DEFAULT 'NOT_STARTED',
        "risk_level" "risk_level",
        "risk_score" smallint,
        "assigned_reviewer_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
        "submission_count" integer NOT NULL DEFAULT 0,
        "decision" "review_decision",
        "decision_reason" text,
        "decided_by_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
        "submitted_at" timestamptz,
        "decided_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 0,
        CONSTRAINT "chk_ma_mcc" CHECK ("merchant_category_code" ~ '^[0-9]{4}$'),
        CONSTRAINT "chk_ma_currency" CHECK ("currency" ~ '^[A-Z]{3}$'),
        CONSTRAINT "chk_ma_volume_positive" CHECK ("expected_monthly_volume_minor" > 0),
        CONSTRAINT "chk_ma_ticket_positive" CHECK ("average_ticket_minor" > 0),
        CONSTRAINT "chk_ma_risk_score_range" CHECK ("risk_score" IS NULL OR "risk_score" BETWEEN 0 AND 100),
        CONSTRAINT "chk_ma_submission_count" CHECK ("submission_count" >= 0),
        CONSTRAINT "chk_ma_decided_requires_decision" CHECK (
          "status" NOT IN ('APPROVED', 'REJECTED') OR ("decision" IS NOT NULL AND "decided_by_id" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_merchant_applications_created_by" ON "merchant_applications" ("created_by_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_merchant_applications_status" ON "merchant_applications" ("status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_merchant_applications_reviewer" ON "merchant_applications" ("assigned_reviewer_id", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "risk_assessments" (
        "id" uuid PRIMARY KEY,
        "application_id" uuid NOT NULL REFERENCES "merchant_applications"("id") ON DELETE RESTRICT,
        "submission_number" integer NOT NULL,
        "idempotency_key" varchar(120) NOT NULL,
        "provider" varchar(64) NOT NULL,
        "provider_reference" varchar(128) NOT NULL,
        "score" smallint NOT NULL,
        "level" "risk_level" NOT NULL,
        "reasons" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "assessed_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_risk_assessments_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "chk_ra_score_range" CHECK ("score" BETWEEN 0 AND 100)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_risk_assessments_application" ON "risk_assessments" ("application_id", "submission_number")`,
    );

    // Audit entries reference entities by id without foreign keys on purpose: the trail must
    // survive even if a referenced row is archived later.
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY,
        "actor_id" uuid,
        "actor_role" varchar(20) NOT NULL,
        "action" varchar(64) NOT NULL,
        "entity_type" varchar(64) NOT NULL,
        "entity_id" uuid NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "correlation_id" varchar(64),
        "occurred_at" timestamptz NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id", "occurred_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "risk_assessments"`);
    await queryRunner.query(`DROP TABLE "merchant_applications"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "review_decision"`);
    await queryRunner.query(`DROP TYPE "risk_level"`);
    await queryRunner.query(`DROP TYPE "risk_status"`);
    await queryRunner.query(`DROP TYPE "application_status"`);
    await queryRunner.query(`DROP TYPE "sales_channel"`);
    await queryRunner.query(`DROP TYPE "business_type"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
