import { desc, eq } from 'drizzle-orm';
import { db } from './client';
import { type SnapshotRecord, snapshots } from './schema';

/**
 * SnapshotQueries - Snapshot-related database operations
 *
 * Responsibilities:
 * - Create snapshot records
 * - Retrieve snapshots by ID or session
 * - List snapshots with pagination
 * - Update snapshot status
 * - Delete snapshot records
 */

/**
 * Create a new snapshot record
 */
export async function createSnapshotRecord(data: {
  snapshotId: string;
  sessionId: string;
  sourceSandboxId: string;
  sizeBytes: number;
  expiresAt: Date;
}): Promise<SnapshotRecord> {
  const [record] = await db
    .insert(snapshots)
    .values({
      snapshotId: data.snapshotId,
      sessionId: data.sessionId,
      sourceSandboxId: data.sourceSandboxId,
      sizeBytes: data.sizeBytes,
      status: 'created',
      expiresAt: data.expiresAt,
    })
    .returning();
  return record;
}

/**
 * Get a snapshot record by ID
 */
export async function getSnapshotRecord(snapshotId: string): Promise<SnapshotRecord | undefined> {
  const [record] = await db.select().from(snapshots).where(eq(snapshots.snapshotId, snapshotId));
  return record;
}

/**
 * Get all snapshots for a session
 */
export async function getSnapshotsBySessionId(sessionId: string): Promise<SnapshotRecord[]> {
  return db
    .select()
    .from(snapshots)
    .where(eq(snapshots.sessionId, sessionId))
    .orderBy(desc(snapshots.createdAt));
}

/**
 * List all snapshot records with pagination
 */
export async function listSnapshotRecords(
  page = 1,
  limit = 20
): Promise<{ snapshots: SnapshotRecord[]; total: number }> {
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

/**
 * Update snapshot status
 */
export async function updateSnapshotStatus(
  snapshotId: string,
  status: 'created' | 'deleted' | 'failed'
): Promise<void> {
  await db.update(snapshots).set({ status }).where(eq(snapshots.snapshotId, snapshotId));
}

/**
 * Delete a snapshot record
 */
export async function deleteSnapshotRecord(snapshotId: string): Promise<void> {
  await db.delete(snapshots).where(eq(snapshots.snapshotId, snapshotId));
}
