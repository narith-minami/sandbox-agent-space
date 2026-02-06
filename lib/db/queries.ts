import { eq } from 'drizzle-orm';
import { db } from './client';
import { type Log, logs, type Session } from './schema';
import { getSession } from './session-queries';

export * from './log-queries';
export * from './preset-queries';
// Re-export types
export type { ListSessionsFilters } from './session-queries';
// Re-export all query functions for backward compatibility
export * from './session-queries';
export * from './snapshot-queries';
export * from './user-settings-queries';

/**
 * Get a session with all its logs
 * This is a composite query that joins session and log data
 */
export async function getSessionWithLogs(
  sessionId: string
): Promise<{ session: Session; logs: Log[] } | undefined> {
  const session = await getSession(sessionId);

  if (!session) return undefined;

  const sessionLogs = await db
    .select()
    .from(logs)
    .where(eq(logs.sessionId, sessionId))
    .orderBy(logs.timestamp);

  return { session, logs: sessionLogs };
}
