import { pgTable, text, timestamp, uuid, jsonb, bigint } from 'drizzle-orm/pg-core';
import type { SandboxConfig, SessionStatus, LogLevel } from '@/types/sandbox';
import type { SandboxRuntime } from '@/lib/sandbox/auth';

// Sessions table
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sandboxId: text('sandbox_id'),
  status: text('status').$type<SessionStatus>().notNull().default('pending'),
  config: jsonb('config').$type<SandboxConfig>().notNull(),
  runtime: text('runtime').$type<SandboxRuntime>().notNull().default('node24'),
  prUrl: text('pr_url'), // Pull Request URL
  memo: text('memo'), // Optional memo/notes
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Logs table
export const logs = pgTable('logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  level: text('level').$type<LogLevel>().notNull().default('info'),
  message: text('message').notNull(),
});

// Snapshots table - tracks snapshots created from sessions
export const snapshots = pgTable('snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  snapshotId: text('snapshot_id').notNull().unique(), // Vercel snapshot ID
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  sourceSandboxId: text('source_sandbox_id').notNull(),
  status: text('status').$type<'created' | 'deleted' | 'failed'>().notNull().default('created'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// Infer types from schema
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;
export type SnapshotRecord = typeof snapshots.$inferSelect;
export type NewSnapshotRecord = typeof snapshots.$inferInsert;
