/**
 * Test Helpers - Shared utilities for testing
 *
 * This module exports all test helper utilities including:
 * - Mock factories for database entities (Session, Log, Snapshot)
 * - Database mock utilities for Drizzle ORM
 * - Sandbox mock utilities for @vercel/sandbox
 *
 * @example
 * ```ts
 * import { createMockSession, createMockDatabase } from '@/test/helpers';
 *
 * const session = createMockSession({ status: 'running' });
 * const db = createMockDatabase();
 * ```
 */

// Database mocks
export {
  createMockDatabase,
  createMockDelete,
  createMockInsert,
  createMockQueries,
  createMockSelect,
  createMockUpdate,
  resetDatabaseMocks,
  setupMockDatabase,
} from './mock-database';
// Mock factories
export {
  createMockLog,
  createMockLogs,
  createMockSandboxConfig,
  createMockSession,
  createMockSessions,
  createMockSnapshot,
  createMockSnapshots,
} from './mock-factories';

// Sandbox mocks
export {
  createMockAuthModule,
  createMockCommand,
  createMockEnvironment,
  createMockFetchResponse,
  createMockGitSource,
  createMockSandbox,
  createMockSandboxModule,
  createMockSandboxResponse,
  createMockSnapshotSource,
  setupSandboxMocks,
} from './mock-sandbox';
