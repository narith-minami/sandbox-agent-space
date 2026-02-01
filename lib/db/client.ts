import { type NeonQueryFunction, neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Lazy initialization for database connection
let _sql: NeonQueryFunction<false, false> | null = null;
let _db: NeonHttpDatabase<typeof schema> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _sql = neon(connectionString);
  }
  return _sql;
}

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getSql(), { schema });
  }
  return _db;
}

// For backward compatibility
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get: (_target, prop) => {
    const database = getDb();
    return (database as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Export types
export type Database = NeonHttpDatabase<typeof schema>;
