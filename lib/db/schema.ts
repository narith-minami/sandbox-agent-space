import { bigint, boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { SandboxRuntime } from '@/lib/sandbox/auth';
import type { LogLevel, PrStatus, SandboxConfig, SessionStatus } from '@/types/sandbox';

// Sessions table
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sandboxId: text('sandbox_id'),
  status: text('status').$type<SessionStatus>().notNull().default('pending'),
  config: jsonb('config').$type<SandboxConfig>().notNull(),
  runtime: text('runtime').$type<SandboxRuntime>().notNull().default('node24'),
  modelProvider: text('model_provider').default('anthropic'),
  modelId: text('model_id').default('claude-sonnet-4-5'),
  prUrl: text('pr_url'), // Pull Request URL
  prStatus: text('pr_status').$type<PrStatus>(), // Pull Request status
  memo: text('memo'), // Optional memo/notes
  archived: boolean('archived').default(false).notNull(), // Archive flag
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }), // Session end time (when completed/failed)
});

// Logs table
export const logs = pgTable('logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .references(() => sessions.id, { onDelete: 'cascade' })
    .notNull(),
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

// Environment presets table - user-defined environment options
export const environmentPresets = pgTable('environment_presets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userLogin: text('user_login').notNull(),
  name: text('name').notNull(),
  gistUrl: text('gist_url').notNull(),
  snapshotId: text('snapshot_id'),
  workdir: text('workdir').notNull(),
  notes: text('notes'), // Optional notes/memo
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// User settings table - per-user defaults
export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userLogin: text('user_login').notNull(),
  opencodeAuthJsonB64: text('opencode_auth_json_b64'),
  enableCodeReview: boolean('enable_code_review').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Infer types from schema
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;
export type SnapshotRecord = typeof snapshots.$inferSelect;
export type NewSnapshotRecord = typeof snapshots.$inferInsert;
export type EnvironmentPreset = typeof environmentPresets.$inferSelect;
export type NewEnvironmentPreset = typeof environmentPresets.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
