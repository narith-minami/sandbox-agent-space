import { describe, expect, it, vi } from 'vitest';
import type { SandboxRuntime } from '@/lib/sandbox/auth';
import {
  createMockLog,
  createMockSession,
  createMockSnapshot,
  setupMockDatabase,
} from '@/test/helpers';
import type { SandboxConfig, SessionStatus } from '@/types/sandbox';
import {
  addLog,
  archiveSession,
  createSession,
  createSnapshotRecord,
  deleteSnapshotRecord,
  getLogsBySessionId,
  getSession,
  getSessionWithLogs,
  getSnapshotRecord,
  getSnapshotsBySessionId,
  listSessions,
  listSnapshotRecords,
  setSessionSandboxId,
  setSessionStatus,
  updateSession,
  updateSnapshotStatus,
} from './queries';
import type { Log, Session, SnapshotRecord } from './schema';

// Mock the database client with shared utilities
vi.mock('./client', () => setupMockDatabase());

describe('createSession', () => {
  it('should create a session with minimal config', async () => {
    const mockSession = createMockSession();

    const { db } = await import('./client');
    vi.mocked(db.insert).mockImplementation(
      () =>
        ({
          values: () => ({
            returning: () => Promise.resolve([mockSession]),
          }),
        }) as unknown as ReturnType<typeof db.insert>
    );

    const config: SandboxConfig = {
      planSource: 'file',
      planFile: 'plan.md',
    } as SandboxConfig;

    const result = await createSession(config);
    expect(result).toEqual(mockSession);
  });

  it('should create a session with runtime override', async () => {
    const mockSession = createMockSession({ runtime: 'python3.13' as SandboxRuntime });

    const { db } = await import('./client');
    vi.mocked(db.insert).mockImplementation(
      () =>
        ({
          values: () => ({
            returning: () => Promise.resolve([mockSession]),
          }),
        }) as unknown as ReturnType<typeof db.insert>
    );

    const config: SandboxConfig = {
      planSource: 'file',
      planFile: 'plan.md',
    } as SandboxConfig;

    const result = await createSession(config, 'python3.13');
    expect(result.runtime).toBe('python3.13');
  });

  it('should create a session with prUrl and memo', async () => {
    const mockSession = createMockSession({
      prUrl: 'https://github.com/owner/repo/pull/1',
      memo: 'Test memo',
      sandboxId: null,
    });

    const { db } = await import('./client');
    vi.mocked(db.insert).mockImplementation(
      () =>
        ({
          values: () => ({
            returning: () => Promise.resolve([mockSession]),
          }),
        }) as unknown as ReturnType<typeof db.insert>
    );

    const config: SandboxConfig = {
      planSource: 'file',
      planFile: 'plan.md',
    } as SandboxConfig;

    const result = await createSession(
      config,
      'node24',
      'https://github.com/owner/repo/pull/1',
      'Test memo'
    );
    expect(result.prUrl).toBe('https://github.com/owner/repo/pull/1');
    expect(result.memo).toBe('Test memo');
  });
});

describe('getSession', () => {
  it('should return session when found', async () => {
    const mockSession = createMockSession({ status: 'running' as SessionStatus });

    const { db } = await import('./client');
    vi.mocked(db.select).mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => Promise.resolve([mockSession]),
          }),
        }) as unknown as ReturnType<typeof db.select>
    );

    const result = await getSession('550e8400-e29b-41d4-a716-446655440000');
    expect(result).toEqual(mockSession);
  });

  it('should return undefined when not found', async () => {
    const { db } = await import('./client');
    vi.mocked(db.select).mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => Promise.resolve([]),
          }),
        }) as unknown as ReturnType<typeof db.select>
    );

    const result = await getSession('550e8400-e29b-41d4-a716-446655440000');
    expect(result).toBeUndefined();
  });
});

describe('updateSession', () => {
  it('should update session sandboxId', async () => {
    const mockSession = createMockSession({
      sandboxId: 'sandbox-123',
      status: 'running' as SessionStatus,
    });

    const { db } = await import('./client');
    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([mockSession]),
            }),
          }),
        }) as unknown as ReturnType<typeof db.update>
    );

    const result = await updateSession('550e8400-e29b-41d4-a716-446655440000', {
      sandboxId: 'sandbox-123',
    });
    expect(result).toEqual(mockSession);
  });

  it('should update session status', async () => {
    const mockSession = createMockSession({ status: 'completed' as SessionStatus });

    const { db } = await import('./client');
    // Mock the select query for checking endedAt
    vi.mocked(db.select).mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ endedAt: null }]),
            }),
          }),
        }) as unknown as ReturnType<typeof db.select>
    );
    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([mockSession]),
            }),
          }),
        }) as unknown as ReturnType<typeof db.update>
    );

    const result = await updateSession('550e8400-e29b-41d4-a716-446655440000', {
      status: 'completed',
    });
    expect(result?.status).toBe('completed');
  });

  it('should update session archived status', async () => {
    const mockSession = createMockSession({
      status: 'completed' as SessionStatus,
      archived: true,
    });

    const { db } = await import('./client');
    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([mockSession]),
            }),
          }),
        }) as unknown as ReturnType<typeof db.update>
    );

    const result = await updateSession('550e8400-e29b-41d4-a716-446655440000', {
      archived: true,
    });
    expect(result?.archived).toBe(true);
  });

  it('should return undefined when session not found', async () => {
    const { db } = await import('./client');
    // Mock the select query for checking endedAt
    vi.mocked(db.select).mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }) as unknown as ReturnType<typeof db.select>
    );
    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([]),
            }),
          }),
        }) as unknown as ReturnType<typeof db.update>
    );

    const result = await updateSession('550e8400-e29b-41d4-a716-446655440000', {
      status: 'completed',
    });
    expect(result).toBeUndefined();
  });
});

describe('listSessions', () => {
  it('should return paginated sessions', async () => {
    const mockSessions: Session[] = [
      createMockSession({
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'running' as SessionStatus,
      }),
      createMockSession({
        id: '550e8400-e29b-41d4-a716-446655440001',
        runtime: 'python3.13' as SandboxRuntime,
        status: 'completed' as SessionStatus,
      }),
    ];

    const { db } = await import('./client');
    let selectCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        // First call for session list
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  offset: () => Promise.resolve(mockSessions),
                }),
              }),
            }),
          }),
        } as unknown as ReturnType<typeof db.select>;
      }
      // Second call for count
      return {
        from: () => ({
          where: () => Promise.resolve(mockSessions),
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    const result = await listSessions(1, 20);
    expect(result.sessions).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should filter by status', async () => {
    const mockSessions: Session[] = [
      createMockSession({
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'running' as SessionStatus,
      }),
    ];

    const { db } = await import('./client');
    let selectCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCount++;
      const base = {
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: () => Promise.resolve(mockSessions),
              }),
            }),
          }),
        }),
      };

      if (selectCount === 1) {
        return base as unknown as ReturnType<typeof db.select>;
      }
      return {
        from: () => ({
          where: () => Promise.resolve(mockSessions),
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    const result = await listSessions(1, 20, { status: ['running'] });
    expect(result.sessions).toHaveLength(1);
  });

  it('should filter by archived status', async () => {
    const mockSessions: Session[] = [
      createMockSession({
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'completed' as SessionStatus,
        archived: true,
      }),
    ];

    const { db } = await import('./client');
    let selectCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCount++;
      const base = {
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: () => Promise.resolve(mockSessions),
              }),
            }),
          }),
        }),
      };

      if (selectCount === 1) {
        return base as unknown as ReturnType<typeof db.select>;
      }
      return {
        from: () => ({
          where: () => Promise.resolve(mockSessions),
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    const result = await listSessions(1, 20, { archived: true });
    expect(result.sessions[0].archived).toBe(true);
  });
});

describe('getSessionWithLogs', () => {
  it('should return session with logs', async () => {
    const mockSession = createMockSession({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'running' as SessionStatus,
    });

    const mockLogs: Log[] = [
      createMockLog({
        id: '550e8400-e29b-41d4-a716-446655440001',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        level: 'info',
        message: 'Session started',
      }),
      createMockLog({
        id: '550e8400-e29b-41d4-a716-446655440002',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        level: 'error',
        message: 'An error occurred',
      }),
    ];

    const { db } = await import('./client');
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call for session
        return {
          from: () => ({
            where: () => Promise.resolve([mockSession]),
          }),
        } as unknown as ReturnType<typeof db.select>;
      }
      // Second call for logs
      return {
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve(mockLogs),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    const result = await getSessionWithLogs('550e8400-e29b-41d4-a716-446655440000');
    expect(result?.session).toEqual(mockSession);
    expect(result?.logs).toHaveLength(2);
  });

  it('should return undefined when session not found', async () => {
    const { db } = await import('./client');
    vi.mocked(db.select).mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => Promise.resolve([]),
          }),
        }) as unknown as ReturnType<typeof db.select>
    );

    const result = await getSessionWithLogs('550e8400-e29b-41d4-a716-446655440000');
    expect(result).toBeUndefined();
  });
});

describe('addLog', () => {
  it('should create a log entry', async () => {
    const mockLog = createMockLog({
      id: '550e8400-e29b-41d4-a716-446655440000',
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      level: 'info',
      message: 'Test message',
    });

    const { db } = await import('./client');
    vi.mocked(db.insert).mockImplementation(
      () =>
        ({
          values: () => ({
            returning: () => Promise.resolve([mockLog]),
          }),
        }) as unknown as ReturnType<typeof db.insert>
    );

    const result = await addLog({
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      level: 'info',
      message: 'Test message',
    });
    expect(result).toEqual(mockLog);
  });
});

describe('getLogsBySessionId', () => {
  it('should return logs for session', async () => {
    const mockLogs: Log[] = [
      createMockLog({
        id: '550e8400-e29b-41d4-a716-446655440000',
        sessionId: '550e8400-e29b-41d4-a716-446655440001',
        level: 'info',
        message: 'Message 1',
      }),
      createMockLog({
        id: '550e8400-e29b-41d4-a716-446655440002',
        sessionId: '550e8400-e29b-41d4-a716-446655440001',
        level: 'error',
        message: 'Message 2',
      }),
    ];

    const { db } = await import('./client');
    vi.mocked(db.select).mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockLogs),
            }),
          }),
        }) as unknown as ReturnType<typeof db.select>
    );

    const result = await getLogsBySessionId('550e8400-e29b-41d4-a716-446655440001');
    expect(result).toHaveLength(2);
  });

  it('should return empty array when no logs', async () => {
    const { db } = await import('./client');
    vi.mocked(db.select).mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([]),
            }),
          }),
        }) as unknown as ReturnType<typeof db.select>
    );

    const result = await getLogsBySessionId('550e8400-e29b-41d4-a716-446655440001');
    expect(result).toHaveLength(0);
  });
});

describe('setSessionStatus', () => {
  it('should call updateSession with status', async () => {
    const { db } = await import('./client');
    // Mock the select query for checking endedAt
    vi.mocked(db.select).mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ endedAt: null }]),
            }),
          }),
        }) as unknown as ReturnType<typeof db.select>
    );
    const updateMock = vi.fn().mockResolvedValue([]);
    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: updateMock,
            }),
          }),
        }) as unknown as ReturnType<typeof db.update>
    );

    await setSessionStatus('550e8400-e29b-41d4-a716-446655440000', 'completed');
    expect(db.update).toHaveBeenCalled();
  });
});

describe('setSessionSandboxId', () => {
  it('should call updateSession with sandboxId', async () => {
    const { db } = await import('./client');
    const updateMock = vi.fn().mockResolvedValue([]);
    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: updateMock,
            }),
          }),
        }) as unknown as ReturnType<typeof db.update>
    );

    await setSessionSandboxId('550e8400-e29b-41d4-a716-446655440000', 'sandbox-123');
    expect(db.update).toHaveBeenCalled();
  });
});

describe('archiveSession', () => {
  it('should archive a session', async () => {
    const mockSession = createMockSession({
      status: 'completed' as SessionStatus,
      archived: true,
    });

    const { db } = await import('./client');
    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([mockSession]),
            }),
          }),
        }) as unknown as ReturnType<typeof db.update>
    );

    const result = await archiveSession('550e8400-e29b-41d4-a716-446655440000', true);
    expect(result?.archived).toBe(true);
  });

  it('should unarchive a session', async () => {
    const mockSession = createMockSession({
      status: 'completed' as SessionStatus,
      archived: false,
    });

    const { db } = await import('./client');
    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([mockSession]),
            }),
          }),
        }) as unknown as ReturnType<typeof db.update>
    );

    const result = await archiveSession('550e8400-e29b-41d4-a716-446655440000', false);
    expect(result?.archived).toBe(false);
  });
});

describe('createSnapshotRecord', () => {
  it('should create snapshot record', async () => {
    const mockSnapshot = createMockSnapshot({
      id: '550e8400-e29b-41d4-a716-446655440000',
      snapshotId: 'snap-123',
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      sourceSandboxId: 'sandbox-123',
      sizeBytes: 1024000,
      status: 'created',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const { db } = await import('./client');
    vi.mocked(db.insert).mockImplementation(
      () =>
        ({
          values: () => ({
            returning: () => Promise.resolve([mockSnapshot]),
          }),
        }) as unknown as ReturnType<typeof db.insert>
    );

    const result = await createSnapshotRecord({
      snapshotId: 'snap-123',
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      sourceSandboxId: 'sandbox-123',
      sizeBytes: 1024000,
      expiresAt: new Date(Date.now() + 86400000),
    });
    expect(result.snapshotId).toBe('snap-123');
    expect(result.status).toBe('created');
  });
});

describe('getSnapshotRecord', () => {
  it('should return snapshot when found', async () => {
    const mockSnapshot = createMockSnapshot({
      id: '550e8400-e29b-41d4-a716-446655440000',
      snapshotId: 'snap-123',
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      sourceSandboxId: 'sandbox-123',
      sizeBytes: 1024000,
      status: 'created',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const { db } = await import('./client');
    vi.mocked(db.select).mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => Promise.resolve([mockSnapshot]),
          }),
        }) as unknown as ReturnType<typeof db.select>
    );

    const result = await getSnapshotRecord('snap-123');
    expect(result).toEqual(mockSnapshot);
  });

  it('should return undefined when not found', async () => {
    const { db } = await import('./client');
    vi.mocked(db.select).mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => Promise.resolve([]),
          }),
        }) as unknown as ReturnType<typeof db.select>
    );

    const result = await getSnapshotRecord('snap-123');
    expect(result).toBeUndefined();
  });
});

describe('getSnapshotsBySessionId', () => {
  it('should return snapshots for session', async () => {
    const mockSnapshots: SnapshotRecord[] = [
      createMockSnapshot({
        id: '550e8400-e29b-41d4-a716-446655440000',
        snapshotId: 'snap-1',
        sessionId: '550e8400-e29b-41d4-a716-446655440001',
        sourceSandboxId: 'sandbox-123',
        sizeBytes: 1024000,
        status: 'created',
        expiresAt: new Date(Date.now() + 86400000),
      }),
      createMockSnapshot({
        id: '550e8400-e29b-41d4-a716-446655440002',
        snapshotId: 'snap-2',
        sessionId: '550e8400-e29b-41d4-a716-446655440001',
        sourceSandboxId: 'sandbox-123',
        sizeBytes: 2048000,
        status: 'deleted',
        expiresAt: new Date(Date.now() + 86400000),
      }),
    ];

    const { db } = await import('./client');
    vi.mocked(db.select).mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockSnapshots),
            }),
          }),
        }) as unknown as ReturnType<typeof db.select>
    );

    const result = await getSnapshotsBySessionId('550e8400-e29b-41d4-a716-446655440001');
    expect(result).toHaveLength(2);
    expect(result[0].snapshotId).toBe('snap-1');
    expect(result[1].snapshotId).toBe('snap-2');
  });
});

describe('listSnapshotRecords', () => {
  it('should return paginated snapshots', async () => {
    const mockSnapshots: SnapshotRecord[] = [
      createMockSnapshot({
        id: '550e8400-e29b-41d4-a716-446655440000',
        snapshotId: 'snap-1',
        sessionId: '550e8400-e29b-41d4-a716-446655440001',
        sourceSandboxId: 'sandbox-123',
        sizeBytes: 1024000,
        status: 'created',
        expiresAt: new Date(Date.now() + 86400000),
      }),
      createMockSnapshot({
        id: '550e8400-e29b-41d4-a716-446655440002',
        snapshotId: 'snap-2',
        sessionId: '550e8400-e29b-41d4-a716-446655440003',
        sourceSandboxId: 'sandbox-456',
        sizeBytes: 2048000,
        status: 'created',
        expiresAt: new Date(Date.now() + 86400000),
      }),
    ];

    const { db } = await import('./client');
    let selectCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) {
        return {
          from: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: () => Promise.resolve(mockSnapshots),
              }),
            }),
          }),
        } as unknown as ReturnType<typeof db.select>;
      }
      return {
        from: () => Promise.resolve(mockSnapshots),
      } as unknown as ReturnType<typeof db.select>;
    });

    const result = await listSnapshotRecords(1, 20);
    expect(result.snapshots).toHaveLength(2);
    expect(result.total).toBe(2);
  });
});

describe('updateSnapshotStatus', () => {
  it('should update snapshot status to deleted', async () => {
    const { db } = await import('./client');
    const updateMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: () => ({
            where: updateMock,
          }),
        }) as unknown as ReturnType<typeof db.update>
    );

    await updateSnapshotStatus('snap-123', 'deleted');
    expect(db.update).toHaveBeenCalled();
  });

  it('should update snapshot status to failed', async () => {
    const { db } = await import('./client');
    const updateMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: () => ({
            where: updateMock,
          }),
        }) as unknown as ReturnType<typeof db.update>
    );

    await updateSnapshotStatus('snap-123', 'failed');
    expect(db.update).toHaveBeenCalled();
  });
});

describe('deleteSnapshotRecord', () => {
  it('should delete snapshot record', async () => {
    const { db } = await import('./client');
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockImplementation(
      () =>
        ({
          where: deleteMock,
        }) as unknown as ReturnType<typeof db.delete>
    );

    await deleteSnapshotRecord('snap-123');
    expect(db.delete).toHaveBeenCalled();
  });
});
