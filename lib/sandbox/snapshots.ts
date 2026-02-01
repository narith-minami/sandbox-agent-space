import { Snapshot } from '@vercel/sandbox';
import type { SnapshotSummary } from '@/types/sandbox';

/**
 * Snapshot utilities for Vercel Sandbox SDK
 * Snapshots capture the filesystem, installed packages, and environment configuration,
 * letting you skip setup steps and start new sandboxes faster.
 *
 * Note: Snapshots expire after 7 days.
 */

/**
 * Get a snapshot by ID
 */
export async function getSnapshot(snapshotId: string): Promise<{
  snapshotId: string;
  sourceSandboxId: string;
  status: 'created' | 'deleted' | 'failed';
  sizeBytes: number;
  createdAt: Date;
  expiresAt: Date;
} | null> {
  try {
    const snapshot = await Snapshot.get({ snapshotId });
    return {
      snapshotId: snapshot.snapshotId,
      sourceSandboxId: snapshot.sourceSandboxId,
      status: snapshot.status,
      sizeBytes: snapshot.sizeBytes,
      createdAt: snapshot.createdAt,
      expiresAt: snapshot.expiresAt,
    };
  } catch (error) {
    console.error(`Failed to get snapshot ${snapshotId}:`, error);
    return null;
  }
}

/**
 * List all snapshots for the project
 */
export async function listSnapshots(options?: {
  limit?: number;
  since?: Date;
  until?: Date;
}): Promise<{ snapshots: SnapshotSummary[]; hasMore: boolean }> {
  try {
    const result = await Snapshot.list({
      limit: options?.limit,
      since: options?.since,
      until: options?.until,
    });

    // Map SDK response to our types
    // SDK returns timestamps as numbers, we convert to Date
    const snapshots: SnapshotSummary[] = result.json.snapshots.map((s) => ({
      snapshotId: s.id, // SDK uses 'id' field
      sourceSandboxId: s.sourceSandboxId,
      status: s.status,
      sizeBytes: s.sizeBytes,
      createdAt: new Date(s.createdAt),
      expiresAt: new Date(s.expiresAt),
    }));

    return {
      snapshots,
      hasMore: !!result.json.pagination?.next,
    };
  } catch (error) {
    console.error('Failed to list snapshots:', error);
    return { snapshots: [], hasMore: false };
  }
}

/**
 * Delete a snapshot
 */
export async function deleteSnapshot(snapshotId: string): Promise<boolean> {
  try {
    const snapshot = await Snapshot.get({ snapshotId });
    await snapshot.delete();
    return true;
  } catch (error) {
    console.error(`Failed to delete snapshot ${snapshotId}:`, error);
    return false;
  }
}

function isSnapshotExpired(snapshot: { status: string; expiresAt: Date }): boolean {
  if (snapshot.status !== 'created') return true;
  if (snapshot.expiresAt < new Date()) return true;
  return false;
}

/**
 * Check if a snapshot is valid (not expired and not deleted)
 */
export async function isSnapshotValid(snapshotId: string): Promise<boolean> {
  const snapshot = await getSnapshot(snapshotId);
  if (!snapshot) return false;
  return !isSnapshotExpired(snapshot);
}

/**
 * Get snapshot expiration info
 */
export function getSnapshotExpirationInfo(expiresAt: Date): {
  isExpired: boolean;
  daysRemaining: number;
  hoursRemaining: number;
} {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();

  if (diff <= 0) {
    return {
      isExpired: true,
      daysRemaining: 0,
      hoursRemaining: 0,
    };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  return {
    isExpired: false,
    daysRemaining: days,
    hoursRemaining: hours % 24,
  };
}

/**
 * Format snapshot size for display
 */
export function formatSnapshotSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  if (sizeBytes < 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
