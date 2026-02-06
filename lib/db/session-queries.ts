import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
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

const sessionSelectionWithoutEndedAt = {
  id: sessions.id,
  sandboxId: sessions.sandboxId,
  status: sessions.status,
  config: sessions.config,
  runtime: sessions.runtime,
  modelProvider: sessions.modelProvider,
  modelId: sessions.modelId,
  prUrl: sessions.prUrl,
  prStatus: sessions.prStatus,
  memo: sessions.memo,
  archived: sessions.archived,
  createdAt: sessions.createdAt,
  updatedAt: sessions.updatedAt,
};

let hasEndedAtColumnCache: boolean | null = null;

function mapLegacySessionRowToSession(
  row: Record<string, unknown> | null | undefined
): Session | undefined {
  if (!row) {
    return undefined;
  }

  return {
    id: String(row.id),
    sandboxId: (row.sandbox_id as string | null) ?? null,
    status: row.status as SessionStatus,
    config: row.config as SandboxConfig,
    runtime: row.runtime as SandboxRuntime,
    modelProvider: (row.model_provider as string | null) ?? null,
    modelId: (row.model_id as string | null) ?? null,
    prUrl: (row.pr_url as string | null) ?? null,
    prStatus: (row.pr_status as PrStatus | null) ?? null,
    memo: (row.memo as string | null) ?? null,
    archived: Boolean(row.archived),
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    endedAt: null,
  };
}

function isEndedAtMissingColumnError(error: unknown): boolean {
  if (!(error && typeof error === 'object')) {
    return false;
  }

  const maybeError = error as {
    code?: string;
    message?: string;
    cause?: { code?: string; message?: string };
  };

  const directMessage = maybeError.message ?? '';
  const causeMessage = maybeError.cause?.message ?? '';
  const directCode = maybeError.code;
  const causeCode = maybeError.cause?.code;

  const hasEndedAtHint =
    directMessage.includes('ended_at') ||
    directMessage.includes('column "ended_at" does not exist') ||
    causeMessage.includes('ended_at') ||
    causeMessage.includes('column "ended_at" does not exist');

  return hasEndedAtHint && (directCode === '42703' || causeCode === '42703');
}

/**
 * Detect whether sessions.ended_at exists in the current database schema.
 * Falls back to compatibility mode when migration is pending.
 */
async function hasEndedAtColumn(): Promise<boolean> {
  if (hasEndedAtColumnCache !== null) {
    return hasEndedAtColumnCache;
  }

  try {
    const result = await db.execute(sql`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'sessions'
        AND column_name = 'ended_at'
      LIMIT 1
    `);

    const rows =
      typeof result === 'object' && result !== null && 'rows' in result
        ? (result.rows as unknown[])
        : [];
    hasEndedAtColumnCache = rows.length > 0;
  } catch (error) {
    console.error(
      'Failed to detect "sessions.ended_at" column. Migration may be pending; using compatibility mode.',
      error
    );
    hasEndedAtColumnCache = false;
  }

  return hasEndedAtColumnCache;
}

/**
 * Test helper to clear schema detection cache.
 */
export function resetSessionSchemaCacheForTests(): void {
  hasEndedAtColumnCache = null;
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
  const insertValues = {
    config,
    status: 'pending' as const,
    runtime,
    prUrl: prUrl || null,
    memo: memo || null,
  };
  const endedAtAvailable = await hasEndedAtColumn();

  try {
    if (endedAtAvailable) {
      const [session] = await db.insert(sessions).values(insertValues).returning();
      return session;
    }
  } catch (error) {
    if (!isEndedAtMissingColumnError(error)) {
      throw error;
    }
    hasEndedAtColumnCache = false;
  }

  const result = await db.execute(sql`
    INSERT INTO "sessions" ("status", "config", "runtime", "pr_url", "memo")
    VALUES (
      ${insertValues.status},
      ${JSON.stringify(insertValues.config)}::jsonb,
      ${insertValues.runtime},
      ${insertValues.prUrl},
      ${insertValues.memo}
    )
    RETURNING
      "id",
      "sandbox_id",
      "status",
      "config",
      "runtime",
      "model_provider",
      "model_id",
      "pr_url",
      "pr_status",
      "memo",
      "archived",
      "created_at",
      "updated_at"
  `);

  const row =
    typeof result === 'object' && result !== null && 'rows' in result
      ? (result.rows[0] as Record<string, unknown> | undefined)
      : undefined;
  const session = mapLegacySessionRowToSession(row);
  if (!session) {
    throw new Error('Failed to create session in compatibility mode');
  }
  return session;
}

/**
 * Get a session by ID
 */
export async function getSession(sessionId: string): Promise<Session | undefined> {
  const endedAtAvailable = await hasEndedAtColumn();

  if (endedAtAvailable) {
    try {
      const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
      return session;
    } catch (error) {
      if (!isEndedAtMissingColumnError(error)) {
        throw error;
      }
      hasEndedAtColumnCache = false;
    }
  }

  const [legacySession] = await db
    .select(sessionSelectionWithoutEndedAt)
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  return legacySession ? ({ ...legacySession, endedAt: null } as Session) : undefined;
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
  const now = new Date();
  const finalUpdates: Record<string, unknown> = { ...updates, updatedAt: now };
  let endedAtAvailable = await hasEndedAtColumn();

  // Set endedAt when session completes or fails (only if not already set)
  if (endedAtAvailable && (updates.status === 'completed' || updates.status === 'failed')) {
    try {
      const [existingSession] = await db
        .select({ endedAt: sessions.endedAt })
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1);

      // Only set endedAt if the session exists and it's not already set
      if (existingSession && !existingSession.endedAt) {
        finalUpdates.endedAt = now;
      }
    } catch (error) {
      if (isEndedAtMissingColumnError(error)) {
        endedAtAvailable = false;
        hasEndedAtColumnCache = false;
        delete finalUpdates.endedAt;
      } else {
        throw error;
      }
    }
  }

  try {
    if (endedAtAvailable) {
      const [session] = await db
        .update(sessions)
        .set(finalUpdates)
        .where(eq(sessions.id, sessionId))
        .returning();
      return session;
    }

    const [legacySession] = await db
      .update(sessions)
      .set(finalUpdates)
      .where(eq(sessions.id, sessionId))
      .returning(sessionSelectionWithoutEndedAt);
    return legacySession ? ({ ...legacySession, endedAt: null } as Session) : undefined;
  } catch (error) {
    if (!endedAtAvailable || !isEndedAtMissingColumnError(error)) {
      throw error;
    }

    hasEndedAtColumnCache = false;
    delete finalUpdates.endedAt;

    const [legacySession] = await db
      .update(sessions)
      .set(finalUpdates)
      .where(eq(sessions.id, sessionId))
      .returning(sessionSelectionWithoutEndedAt);
    return legacySession ? ({ ...legacySession, endedAt: null } as Session) : undefined;
  }
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
  let endedAtAvailable = await hasEndedAtColumn();

  if (endedAtAvailable) {
    try {
      const [sessionList, countResult] = await Promise.all([
        db
          .select()
          .from(sessions)
          .where(whereClause)
          .orderBy(desc(sessions.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ id: sessions.id }).from(sessions).where(whereClause),
      ]);

      return {
        sessions: sessionList,
        total: countResult.length,
      };
    } catch (error) {
      if (!isEndedAtMissingColumnError(error)) {
        throw error;
      }
      endedAtAvailable = false;
      hasEndedAtColumnCache = false;
      console.error(
        'Detected stale schema cache for "sessions.ended_at". Falling back to compatibility query.',
        error
      );
    }
  }

  const [legacySessionList, countResult] = await Promise.all([
    db
      .select(sessionSelectionWithoutEndedAt)
      .from(sessions)
      .where(whereClause)
      .orderBy(desc(sessions.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ id: sessions.id }).from(sessions).where(whereClause),
  ]);

  return {
    sessions: legacySessionList.map((session) => ({ ...session, endedAt: null }) as Session),
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
