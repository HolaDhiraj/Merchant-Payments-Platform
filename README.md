# Merchant-Payments-Platform
Merchant onboarding and risk-review backend built with NestJS 11, TypeScript, PostgreSQL (TypeORM), Redis + BullMQ, JWT. Sales users capture merchant applications, a background worker runs a (simulated) third-party KYB / risk check, and the assigned reviewer approves, rejects or requests more information. Every significant action is audited.
