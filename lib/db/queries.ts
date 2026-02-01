import { eq, desc } from 'drizzle-orm';
import { db } from './client';
import { sessions, logs, snapshots, type NewSession, type NewLog, type Session, type Log, type SnapshotRecord, type NewSnapshotRecord } from './schema';
import type { SandboxConfig, SessionStatus } from '@/types/sandbox';
import type { SandboxRuntime } from '@/lib/sandbox/auth';

// Session queries
export async function createSession(
  config: SandboxConfig, 
  runtime: SandboxRuntime = 'node24',
  prUrl?: string,
  memo?: string
): Promise<Session> {
  const [session] = await db.insert(sessions).values({
    config,
    status: 'pending',
    runtime,
    prUrl: prUrl || null,
    memo: memo || null,
  }).returning();
  return session;
}

export async function getSession(sessionId: string): Promise<Session | undefined> {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  return session;
}

export async function updateSession(
  sessionId: string,
  updates: Partial<Pick<Session, 'sandboxId' | 'status' | 'runtime' | 'prUrl'>>
): Promise<Session | undefined> {
  const [session] = await db
    .update(sessions)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId))
    .returning();
  return session;
}

export async function listSessions(page = 1, limit = 20): Promise<{ sessions: Session[]; total: number }> {
  const offset = (page - 1) * limit;
  
  const [sessionList, countResult] = await Promise.all([
    db.select().from(sessions).orderBy(desc(sessions.createdAt)).limit(limit).offset(offset),
    db.select().from(sessions),
  ]);
  
  return {
    sessions: sessionList,
    total: countResult.length,
  };
}

export async function getSessionWithLogs(sessionId: string): Promise<{ session: Session; logs: Log[] } | undefined> {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  
  if (!session) return undefined;
  
  const sessionLogs = await db
    .select()
    .from(logs)
    .where(eq(logs.sessionId, sessionId))
    .orderBy(logs.timestamp);
  
  return { session, logs: sessionLogs };
}

// Log queries
export async function addLog(log: Omit<NewLog, 'id' | 'timestamp'>): Promise<Log> {
  const [newLog] = await db.insert(logs).values(log).returning();
  return newLog;
}

export async function getLogsBySessionId(sessionId: string): Promise<Log[]> {
  return db
    .select()
    .from(logs)
    .where(eq(logs.sessionId, sessionId))
    .orderBy(logs.timestamp);
}

// Helper to update session status
export async function setSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  await updateSession(sessionId, { status });
}

export async function setSessionSandboxId(sessionId: string, sandboxId: string): Promise<void> {
  await updateSession(sessionId, { sandboxId });
}

// Snapshot queries
export async function createSnapshotRecord(data: {
  snapshotId: string;
  sessionId: string;
  sourceSandboxId: string;
  sizeBytes: number;
  expiresAt: Date;
}): Promise<SnapshotRecord> {
  const [record] = await db.insert(snapshots).values({
    snapshotId: data.snapshotId,
    sessionId: data.sessionId,
    sourceSandboxId: data.sourceSandboxId,
    sizeBytes: data.sizeBytes,
    status: 'created',
    expiresAt: data.expiresAt,
  }).returning();
  return record;
}

export async function getSnapshotRecord(snapshotId: string): Promise<SnapshotRecord | undefined> {
  const [record] = await db.select().from(snapshots).where(eq(snapshots.snapshotId, snapshotId));
  return record;
}

export async function getSnapshotsBySessionId(sessionId: string): Promise<SnapshotRecord[]> {
  return db
    .select()
    .from(snapshots)
    .where(eq(snapshots.sessionId, sessionId))
    .orderBy(desc(snapshots.createdAt));
}

export async function listSnapshotRecords(page = 1, limit = 20): Promise<{ snapshots: SnapshotRecord[]; total: number }> {
  const offset = (page - 1) * limit;
  
  const [snapshotList, countResult] = await Promise.all([
    db.select().from(snapshots).orderBy(desc(snapshots.createdAt)).limit(limit).offset(offset),
    db.select().from(snapshots),
  ]);
  
  return {
    snapshots: snapshotList,
    total: countResult.length,
  };
}

export async function updateSnapshotStatus(snapshotId: string, status: 'created' | 'deleted' | 'failed'): Promise<void> {
  await db
    .update(snapshots)
    .set({ status })
    .where(eq(snapshots.snapshotId, snapshotId));
}

export async function deleteSnapshotRecord(snapshotId: string): Promise<void> {
  await db.delete(snapshots).where(eq(snapshots.snapshotId, snapshotId));
}
