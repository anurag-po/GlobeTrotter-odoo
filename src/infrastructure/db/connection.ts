import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { config } from '../../config/index.js';
import type { Database } from './schema.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
});
