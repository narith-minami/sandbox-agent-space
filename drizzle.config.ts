import { config as dotenvConfig } from 'dotenv';
import type { Config } from 'drizzle-kit';

dotenvConfig({ path: '.env.local' });
dotenvConfig();

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
} satisfies Config;
