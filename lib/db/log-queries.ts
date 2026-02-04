import { eq } from 'drizzle-orm';
import { db } from './client';
import { type Log, logs, type NewLog } from './schema';

/**
 * LogQueries - Log-related database operations
 *
 * Responsibilities:
 * - Add logs to sessions
 * - Retrieve logs by session ID
 */

/**
 * Add a new log entry
 */
export async function addLog(log: Omit<NewLog, 'id' | 'timestamp'>): Promise<Log> {
  const [newLog] = await db.insert(logs).values(log).returning();
  return newLog;
}

/**
 * Get all logs for a session
 */
export async function getLogsBySessionId(sessionId: string): Promise<Log[]> {
  return db.select().from(logs).where(eq(logs.sessionId, sessionId)).orderBy(logs.timestamp);
}
