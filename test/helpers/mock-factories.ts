import type { Log, Session, SnapshotRecord } from '@/lib/db/schema';
import type { SandboxRuntime } from '@/lib/sandbox/auth';
import type { LogLevel, SandboxConfig, SessionStatus } from '@/types/sandbox';

/**
 * Creates a mock Session object with all required fields.
 * Useful for testing database queries and session-related logic.
 *
 * @param overrides - Partial Session object to override default values
 * @returns Complete Session object with defaults + overrides
 *
 * @example
 * ```ts
 * const session = createMockSession({ status: 'running' });
 * const pendingSession = createMockSession({ status: 'pending', sandboxId: null });
 * ```
 */
export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    config: { planSource: 'file', planFile: 'plan.md' } as SandboxConfig,
    runtime: 'node24' as SandboxRuntime,
    status: 'pending' as SessionStatus,
    sandboxId: null,
    prUrl: null,
    prStatus: null,
    memo: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    archived: false,
    ...overrides,
  };
}

/**
 * Creates a mock Log object with all required fields.
 * Useful for testing log-related queries and components.
 *
 * @param overrides - Partial Log object to override default values
 * @returns Complete Log object with defaults + overrides
 *
 * @example
 * ```ts
 * const log = createMockLog({ level: 'error', message: 'Something went wrong' });
 * const infoLog = createMockLog({ sessionId: 'abc-123' });
 * ```
 */
export function createMockLog(overrides: Partial<Log> = {}): Log {
  return {
    id: '650e8400-e29b-41d4-a716-446655440000',
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: new Date('2024-01-01T00:00:00.000Z'),
    level: 'info' as LogLevel,
    message: 'Test log message',
    ...overrides,
  };
}

/**
 * Creates a mock SnapshotRecord object with all required fields.
 * Useful for testing snapshot-related queries and logic.
 *
 * @param overrides - Partial SnapshotRecord object to override default values
 * @returns Complete SnapshotRecord object with defaults + overrides
 *
 * @example
 * ```ts
 * const snapshot = createMockSnapshot({ status: 'created' });
 * const deletedSnapshot = createMockSnapshot({ status: 'deleted' });
 * ```
 */
export function createMockSnapshot(overrides: Partial<SnapshotRecord> = {}): SnapshotRecord {
  return {
    id: '750e8400-e29b-41d4-a716-446655440000',
    snapshotId: 'snap-123456789',
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    sourceSandboxId: 'sandbox-123',
    status: 'created',
    sizeBytes: 1024000,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    expiresAt: new Date('2024-01-08T00:00:00.000Z'),
    ...overrides,
  };
}

/**
 * Creates a mock SandboxConfig object for testing.
 * Provides default values for all required fields.
 *
 * @param overrides - Partial SandboxConfig to override defaults
 * @returns Complete SandboxConfig object
 *
 * @example
 * ```ts
 * const config = createMockSandboxConfig({ repoUrl: 'https://github.com/owner/repo' });
 * ```
 */
export function createMockSandboxConfig(overrides: Partial<SandboxConfig> = {}): SandboxConfig {
  return {
    planSource: 'file',
    planFile: 'plan.md',
    planText: '',
    repoUrl: 'https://github.com/owner/repo',
    repoSlug: 'owner/repo',
    baseBranch: 'main',
    gistUrl: '',
    frontDir: '',
    githubToken: '',
    opencodeAuthJsonB64: '',
    enableCodeReview: false,
    ...overrides,
  } as SandboxConfig;
}

/**
 * Creates multiple mock sessions with sequential IDs.
 * Useful for testing list queries and pagination.
 *
 * @param count - Number of sessions to create
 * @param baseOverrides - Base overrides to apply to all sessions
 * @returns Array of mock sessions
 *
 * @example
 * ```ts
 * const sessions = createMockSessions(5, { status: 'completed' });
 * const runningSessions = createMockSessions(3, { status: 'running' });
 * ```
 */
export function createMockSessions(count: number, baseOverrides: Partial<Session> = {}): Session[] {
  return Array.from({ length: count }, (_, index) =>
    createMockSession({
      ...baseOverrides,
      id: `550e8400-e29b-41d4-a716-44665544000${index}`,
      createdAt: new Date(`2024-01-0${index + 1}T00:00:00.000Z`),
    })
  );
}

/**
 * Creates multiple mock logs with sequential IDs.
 * Useful for testing log queries and components.
 *
 * @param count - Number of logs to create
 * @param baseOverrides - Base overrides to apply to all logs
 * @returns Array of mock logs
 *
 * @example
 * ```ts
 * const logs = createMockLogs(10, { sessionId: 'abc-123' });
 * const errorLogs = createMockLogs(5, { level: 'error' });
 * ```
 */
export function createMockLogs(count: number, baseOverrides: Partial<Log> = {}): Log[] {
  return Array.from({ length: count }, (_, index) =>
    createMockLog({
      ...baseOverrides,
      id: `650e8400-e29b-41d4-a716-44665544000${index}`,
      timestamp: new Date(`2024-01-01T00:0${index}:00.000Z`),
      message: `Test log message ${index + 1}`,
    })
  );
}

/**
 * Creates multiple mock snapshots with sequential IDs.
 * Useful for testing snapshot queries and list operations.
 *
 * @param count - Number of snapshots to create
 * @param baseOverrides - Base overrides to apply to all snapshots
 * @returns Array of mock snapshots
 *
 * @example
 * ```ts
 * const snapshots = createMockSnapshots(3);
 * const deletedSnapshots = createMockSnapshots(2, { status: 'deleted' });
 * ```
 */
export function createMockSnapshots(
  count: number,
  baseOverrides: Partial<SnapshotRecord> = {}
): SnapshotRecord[] {
  return Array.from({ length: count }, (_, index) =>
    createMockSnapshot({
      ...baseOverrides,
      id: `750e8400-e29b-41d4-a716-44665544000${index}`,
      snapshotId: `snap-12345678${index}`,
      createdAt: new Date(`2024-01-0${index + 1}T00:00:00.000Z`),
    })
  );
}
