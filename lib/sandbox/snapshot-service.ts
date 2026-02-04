import type { Sandbox } from '@vercel/sandbox';
import { addLog, setSessionStatus } from '@/lib/db/queries';

/**
 * SnapshotService - Handles snapshot creation and management
 *
 * Responsibilities:
 * - Create snapshots of sandbox state
 * - Log snapshot operations
 */
export class SnapshotService {
  /**
   * Create a snapshot of the current sandbox state
   */
  async createSnapshot(
    sessionId: string,
    sandbox: Sandbox,
    onComplete?: () => void
  ): Promise<{ snapshotId: string; expiresAt: Date }> {
    await addLog({
      sessionId,
      level: 'info',
      message: 'Creating snapshot of current sandbox state...',
    });

    const snapshot = await sandbox.snapshot();

    await addLog({
      sessionId,
      level: 'info',
      message: `Snapshot created: ${snapshot.snapshotId} (expires: ${snapshot.expiresAt.toISOString()})`,
    });

    // Note: sandbox is automatically stopped after snapshot
    if (onComplete) {
      onComplete();
    }
    await setSessionStatus(sessionId, 'completed');

    return {
      snapshotId: snapshot.snapshotId,
      expiresAt: snapshot.expiresAt,
    };
  }
}
