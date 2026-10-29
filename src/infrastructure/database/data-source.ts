import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './typeorm-options';

// DataSource used by the TypeORM CLI (migration:run / revert / show).
// Reads connection settings from the environment, e.g. `set -a; . ./.env; set +a`.
export default new DataSource(
  buildTypeOrmOptions({
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    name: process.env.DATABASE_NAME ?? '',
    user: process.env.DATABASE_USER ?? '',
    password: process.env.DATABASE_PASSWORD ?? '',
    ssl: process.env.DATABASE_SSL === 'true',
  }),
);
