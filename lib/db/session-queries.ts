import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import type { SandboxRuntime } from '@/lib/sandbox/auth';
import type { PrStatus, SandboxConfig, SessionStatus } from '@/types/sandbox';
import { db } from './client';
import { type Session, sessions } from './schema';

/**
 * SessionQueries - Session-related database operations
 *
 * Responsibilities:
 * - Create, read, update sessions
 * - List sessions with pagination and filters
 * - Archive/unarchive sessions
 * - Helper methods for status and sandbox ID updates
 */

export interface ListSessionsFilters {
  status?: SessionStatus[];
  prStatus?: PrStatus[];
  archived?: boolean;
}

/**
 * Create a new session
 */
export async function createSession(
  config: SandboxConfig,
  runtime: SandboxRuntime = 'node24',
  prUrl?: string,
  memo?: string
): Promise<Session> {
  const [session] = await db
    .insert(sessions)
    .values({
      config,
      status: 'pending',
      runtime,
      prUrl: prUrl || null,
      memo: memo || null,
    })
    .returning();
  return session;
}

/**
 * Get a session by ID
 */
export async function getSession(sessionId: string): Promise<Session | undefined> {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  return session;
}

/**
 * Update a session
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<
    Pick<Session, 'sandboxId' | 'status' | 'runtime' | 'prUrl' | 'prStatus' | 'archived'>
  >
): Promise<Session | undefined> {
  const [session] = await db
    .update(sessions)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId))
    .returning();
  return session;
}

/**
 * Build WHERE clause for listing sessions with filters
 */
function buildListSessionsWhereClause(filters?: ListSessionsFilters) {
  const conditions = [];

  // Handle archived filter - treat NULL as false (not archived)
  const archivedValue = filters?.archived ?? false;
  if (archivedValue) {
    conditions.push(eq(sessions.archived, true));
  } else {
    conditions.push(or(eq(sessions.archived, false), isNull(sessions.archived)));
  }

  if (filters?.status && filters.status.length > 0) {
    conditions.push(inArray(sessions.status, filters.status));
  }

  if (filters?.prStatus && filters.prStatus.length > 0) {
    conditions.push(inArray(sessions.prStatus, filters.prStatus));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * List sessions with pagination and filters
 */
export async function listSessions(
  page = 1,
  limit = 20,
  filters?: ListSessionsFilters
): Promise<{ sessions: Session[]; total: number }> {
  const offset = (page - 1) * limit;
  const whereClause = buildListSessionsWhereClause(filters);

  const [sessionList, countResult] = await Promise.all([
    db
      .select()
      .from(sessions)
      .where(whereClause)
      .orderBy(desc(sessions.createdAt))
      .limit(limit)
      .offset(offset),
    db.select().from(sessions).where(whereClause),
  ]);

  return {
    sessions: sessionList,
    total: countResult.length,
  };
}

/**
 * Helper to update session status
 */
export async function setSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  await updateSession(sessionId, { status });
}

/**
 * Helper to update session sandbox ID
 */
export async function setSessionSandboxId(sessionId: string, sandboxId: string): Promise<void> {
  await updateSession(sessionId, { sandboxId });
}

/**
 * Archive or unarchive a session
 */
export async function archiveSession(
  sessionId: string,
  archived: boolean
): Promise<Session | undefined> {
  return updateSession(sessionId, { archived });
}
