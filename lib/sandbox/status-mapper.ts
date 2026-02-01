import type { SessionStatus, VercelSandboxStatus } from '@/types/sandbox';

/**
 * Map Vercel sandbox status to internal session status
 */
const STATUS_MAP: Record<VercelSandboxStatus, SessionStatus> = {
  pending: 'pending',
  running: 'running',
  stopping: 'stopping',
  stopped: 'completed',
  failed: 'failed',
  snapshotting: 'running',
};

/**
 * Convert Vercel status to our internal status
 */
export function mapVercelStatus(vercelStatus: VercelSandboxStatus): SessionStatus {
  return STATUS_MAP[vercelStatus] ?? 'pending';
}

/**
 * Check if a session status represents a terminal state
 */
export function isTerminalStatus(status: SessionStatus): boolean {
  return status === 'completed' || status === 'failed';
}
