import { Sandbox } from '@vercel/sandbox';
import { getLogsBySessionId, getSession } from '@/lib/db/queries';
import type { LogLevel, SessionStatus, VercelSandboxStatus } from '@/types/sandbox';
import type { SandboxRuntime } from './auth';
import { LogStreamService } from './log-stream-service';
import { SandboxFileService } from './sandbox-file-service';
import { type SandboxCreateOptions, SandboxLifecycleManager } from './sandbox-lifecycle-manager';
import { SnapshotService } from './snapshot-service';
import { mapVercelStatus } from './status-mapper';

// Re-export for backward compatibility
export type { SandboxCreateOptions } from './sandbox-lifecycle-manager';

export interface SandboxStatus {
  status: SessionStatus;
  vercelStatus?: VercelSandboxStatus;
  exitCode?: number;
  timeout?: number;
}

export interface SandboxLogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
}

/**
 * SandboxManager - Manages sandbox execution using Vercel Sandbox SDK
 *
 * This implementation uses the official Vercel Sandbox SDK to create and manage
 * isolated Linux microVMs for secure code execution.
 *
 * Refactored to use specialized services:
 * - SandboxLifecycleManager: sandbox creation, execution, stopping
 * - LogStreamService: log streaming and PR detection
 * - SandboxFileService: file operations
 * - SnapshotService: snapshot management
 */
export class SandboxManager {
  private lifecycleManager: SandboxLifecycleManager;
  private fileService: SandboxFileService;
  private snapshotService: SnapshotService;

  constructor() {
    const logStreamService = new LogStreamService();
    this.fileService = new SandboxFileService();
    this.snapshotService = new SnapshotService();
    this.lifecycleManager = new SandboxLifecycleManager(logStreamService, this.fileService);
  }

  /**
   * Create and start a new sandbox using Vercel Sandbox SDK
   */
  async createSandbox(
    sessionId: string,
    options: SandboxCreateOptions
  ): Promise<{ sandboxId: string; runtime: SandboxRuntime }> {
    return this.lifecycleManager.createSandbox(sessionId, options);
  }

  /**
   * Get sandbox status from Vercel SDK
   */
  async getSandboxStatus(sandboxId: string): Promise<SandboxStatus> {
    try {
      const sandbox = await Sandbox.get({ sandboxId });

      return {
        status: mapVercelStatus(sandbox.status),
        vercelStatus: sandbox.status,
        timeout: sandbox.timeout,
      };
    } catch (error) {
      console.error('Failed to get sandbox status:', error);
      return {
        status: 'failed',
      };
    }
  }

  /**
   * Get sandbox by session ID from active sandboxes
   */
  async getSandboxBySession(sessionId: string): Promise<Sandbox | null> {
    return this.lifecycleManager.getSandboxBySession(sessionId);
  }

  /**
   * Stream logs from sandbox
   * This is a generator that yields log entries
   */
  async *streamLogs(sessionId: string): AsyncGenerator<SandboxLogEntry> {
    let lastLogId: string | null = null;
    const maxIterations = 600; // 10 minutes with 1s interval
    let iterations = 0;

    while (iterations < maxIterations) {
      const logs = await getLogsBySessionId(sessionId);
      const session = await getSession(sessionId);

      // Yield new logs
      for (const log of logs) {
        if (!lastLogId || log.id > lastLogId) {
          lastLogId = log.id;
          yield {
            timestamp: log.timestamp,
            level: log.level,
            message: log.message,
          };
        }
      }

      // Stop if session is completed or failed
      if (session?.status === 'completed' || session?.status === 'failed') {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      iterations++;
    }
  }

  /**
   * Stop a running sandbox
   */
  async stopSandbox(sandboxId: string): Promise<void> {
    return this.lifecycleManager.stopSandbox(sandboxId);
  }

  /**
   * Stop sandbox by session ID
   */
  async stopSandboxBySession(sessionId: string): Promise<void> {
    return this.lifecycleManager.stopSandboxBySession(sessionId);
  }

  /**
   * Extend sandbox timeout
   */
  async extendTimeout(sessionId: string, durationMs: number): Promise<void> {
    return this.lifecycleManager.extendTimeout(sessionId, durationMs);
  }

  /**
   * Create a snapshot of the current sandbox state
   */
  async createSnapshot(sessionId: string): Promise<{ snapshotId: string; expiresAt: Date }> {
    const sandbox = await this.lifecycleManager.getSandboxBySession(sessionId);
    if (!sandbox) {
      throw new Error('Sandbox not found or not running');
    }

    return this.snapshotService.createSnapshot(sessionId, sandbox, () => {
      this.lifecycleManager.removeActiveSandbox(sessionId);
    });
  }

  /**
   * List all sandboxes for the project
   */
  async listSandboxes(options?: { limit?: number; since?: Date; until?: Date }) {
    const result = await Sandbox.list({
      limit: options?.limit,
      since: options?.since,
      until: options?.until,
    });
    return result.json;
  }

  /**
   * Write files to sandbox
   */
  async writeFiles(sessionId: string, files: { path: string; content: Buffer }[]): Promise<void> {
    const sandbox = await this.lifecycleManager.getSandboxBySession(sessionId);
    if (!sandbox) {
      throw new Error('Sandbox not found or not running');
    }

    return this.fileService.writeFiles(sessionId, sandbox, files);
  }

  /**
   * Read file from sandbox
   */
  async readFile(sessionId: string, path: string): Promise<Buffer | null> {
    const sandbox = await this.lifecycleManager.getSandboxBySession(sessionId);
    if (!sandbox) {
      throw new Error('Sandbox not found or not running');
    }

    return this.fileService.readFile(sandbox, path);
  }

  /**
   * Run additional command in sandbox
   */
  async runCommand(
    sessionId: string,
    cmd: string,
    args?: string[],
    options?: { cwd?: string; env?: Record<string, string>; sudo?: boolean }
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const sandbox = await this.lifecycleManager.getSandboxBySession(sessionId);
    if (!sandbox) {
      throw new Error('Sandbox not found or not running');
    }

    const result = await sandbox.runCommand({
      cmd,
      args,
      cwd: options?.cwd,
      env: options?.env,
      sudo: options?.sudo,
    });

    return {
      exitCode: result.exitCode,
      stdout: await result.stdout(),
      stderr: await result.stderr(),
    };
  }
}

// Singleton instance
let sandboxManager: SandboxManager | null = null;

export function getSandboxManager(): SandboxManager {
  if (!sandboxManager) {
    sandboxManager = new SandboxManager();
  }
  return sandboxManager;
}
