import { type Command, Sandbox } from '@vercel/sandbox';
import {
  addLog,
  getSession,
  setSessionSandboxId,
  setSessionStatus,
  updateSession,
} from '@/lib/db/queries';
import type { SandboxRuntime } from './auth';
import { getSandboxRuntime, getSandboxTimeout, requireAuthentication } from './auth';
import { LogStreamService } from './log-stream-service';
import { SandboxFileService } from './sandbox-file-service';

export interface SandboxCreateOptions {
  env: Record<string, string | undefined>;
  command: string;
  runtime?: SandboxRuntime;
  snapshotId?: string;
  planText?: string;
  planFilePath?: string;
}

// Store active sandbox references for log streaming and management
const activeSandboxes = new Map<string, { sandbox: Sandbox; command?: Command }>();

// Helper function to filter out undefined values from environment
function filterEnv(env: Record<string, string | undefined>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * SandboxLifecycleManager - Manages sandbox lifecycle operations
 *
 * Responsibilities:
 * - Create sandboxes (from snapshot, git, or empty)
 * - Execute commands in sandboxes
 * - Stop sandboxes
 * - Clean up sandbox resources
 * - Manage active sandbox references
 */
export class SandboxLifecycleManager {
  private logStreamService: LogStreamService;
  private fileService: SandboxFileService;

  constructor(logStreamService?: LogStreamService, fileService?: SandboxFileService) {
    this.logStreamService = logStreamService || new LogStreamService();
    this.fileService = fileService || new SandboxFileService();
  }

  /**
   * Create and start a new sandbox using Vercel Sandbox SDK
   */
  async createSandbox(
    sessionId: string,
    options: SandboxCreateOptions
  ): Promise<{ sandboxId: string; runtime: SandboxRuntime }> {
    // Ensure authentication is configured
    requireAuthentication();

    const runtime = options.runtime || getSandboxRuntime();
    const timeout = getSandboxTimeout();

    await addLog({
      sessionId,
      level: 'info',
      message: `Starting Vercel Sandbox creation with runtime: ${runtime}...`,
    });

    try {
      // Create sandbox with Vercel SDK
      const sandbox = await this.createSandboxInstance(sessionId, options, runtime, timeout);
      const sandboxId = sandbox.sandboxId;

      // Update session with sandbox ID and runtime
      await setSessionSandboxId(sessionId, sandboxId);
      await updateSession(sessionId, { status: 'running' });

      await addLog({
        sessionId,
        level: 'info',
        message: `Sandbox created successfully with ID: ${sandboxId}`,
      });

      await addLog({
        sessionId,
        level: 'debug',
        message: `Sandbox status: ${sandbox.status}, timeout: ${sandbox.timeout}ms`,
      });

      // Store sandbox reference for later use
      activeSandboxes.set(sessionId, { sandbox });

      // Execute command in background (non-blocking)
      this.executeCommand(sessionId, sandbox, options).catch((error) => {
        console.error('Background execution failed:', error);
      });

      return { sandboxId, runtime };
    } catch (error) {
      await setSessionStatus(sessionId, 'failed');
      await addLog({
        sessionId,
        level: 'error',
        message: `Sandbox creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw error;
    }
  }

  /**
   * Create sandbox instance based on options
   */
  private async createSandboxInstance(
    sessionId: string,
    options: SandboxCreateOptions,
    runtime: SandboxRuntime,
    timeout: number
  ): Promise<Sandbox> {
    if (options.snapshotId) {
      // Create from snapshot
      await addLog({
        sessionId,
        level: 'info',
        message: `Creating sandbox from snapshot: ${options.snapshotId}`,
      });

      return Sandbox.create({
        runtime,
        timeout,
        source: {
          type: 'snapshot',
          snapshotId: options.snapshotId,
        },
      });
    }

    if (options.env.REPO_URL) {
      // Create with Git source
      const repoUrl = options.env.REPO_URL;
      const githubToken = options.env.GITHUB_TOKEN;
      const baseBranch = options.env.BASE_BRANCH || 'main';

      await addLog({
        sessionId,
        level: 'info',
        message: `Cloning repository: ${options.env.REPO_SLUG || repoUrl} (branch: ${baseBranch})`,
      });

      return Sandbox.create({
        runtime,
        timeout,
        source: {
          type: 'git',
          url: repoUrl,
          username: 'x-access-token',
          password: githubToken,
          depth: 1, // Shallow clone for faster setup
          revision: baseBranch,
        },
      });
    }

    // Create empty sandbox
    return Sandbox.create({
      runtime,
      timeout,
    });
  }

  /**
   * Execute command in sandbox using Vercel SDK
   */
  private async executeCommand(
    sessionId: string,
    sandbox: Sandbox,
    options: SandboxCreateOptions
  ): Promise<void> {
    try {
      await addLog({
        sessionId,
        level: 'info',
        message: `Executing command in sandbox ${sandbox.sandboxId}`,
      });

      // Write plan text to file if provided
      if (options.planText && options.planFilePath) {
        await this.fileService.writePlanFile(
          sessionId,
          sandbox,
          options.planText,
          options.planFilePath
        );
      }

      // Log environment variables (masked)
      const envKeys = Object.keys(options.env);
      await addLog({
        sessionId,
        level: 'debug',
        message: `Environment variables set: ${envKeys.join(', ')}`,
      });

      // Log the command (truncated for safety)
      const truncatedCmd =
        options.command.substring(0, 200) + (options.command.length > 200 ? '...' : '');
      await addLog({
        sessionId,
        level: 'info',
        message: `Command: ${truncatedCmd}`,
      });

      // Download and execute the script from Gist if GIST_URL is provided
      if (options.env.GIST_URL) {
        await this.fileService.downloadAndPrepareGist(sessionId, sandbox, options.env.GIST_URL);
        // integrated-review-workflow.sh 等は .env.local を参照するため、ホストの API キーで作成
        await this.fileService.prepareEnvFile(sessionId, sandbox, options.env);
      }

      // Run the main command with environment variables
      const command = await sandbox.runCommand({
        cmd: 'bash',
        args: ['-c', options.command],
        env: filterEnv(options.env),
        cwd: options.env.FRONT_DIR ? `/vercel/sandbox/${options.env.FRONT_DIR}` : '/vercel/sandbox',
        detached: true,
      });

      // Store command reference
      const sandboxRef = activeSandboxes.get(sessionId);
      if (sandboxRef) {
        sandboxRef.command = command;
      }

      // Stream logs in real-time
      await this.logStreamService.streamLogsAndDetectPrUrl(
        sessionId,
        command,
        options.env.REPO_SLUG
      );

      // Wait for command to complete and get result
      const result = await command.wait();
      await this.handleCommandResult(sessionId, sandbox, result.exitCode);
    } catch (error) {
      await this.handleExecutionError(sessionId, sandbox, error);
    }
  }

  /**
   * Handle command execution result
   */
  private async handleCommandResult(
    sessionId: string,
    sandbox: Sandbox,
    exitCode: number
  ): Promise<void> {
    if (exitCode === 0) {
      await setSessionStatus(sessionId, 'completed');
      await addLog({
        sessionId,
        level: 'info',
        message: 'Sandbox execution completed successfully.',
      });
    } else {
      await setSessionStatus(sessionId, 'failed');
      await addLog({
        sessionId,
        level: 'error',
        message: `Command exited with code: ${exitCode}`,
      });
    }

    await this.cleanupSandbox(sessionId, sandbox, 'Sandbox stopped and resources released.');
  }

  /**
   * Handle execution error
   */
  private async handleExecutionError(
    sessionId: string,
    sandbox: Sandbox,
    error: unknown
  ): Promise<void> {
    await setSessionStatus(sessionId, 'failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await addLog({
      sessionId,
      level: 'error',
      message: `Execution failed: ${errorMessage}`,
    });

    await this.cleanupSandbox(sessionId, sandbox, null);
  }

  /**
   * Clean up sandbox resources
   */
  private async cleanupSandbox(
    sessionId: string,
    sandbox: Sandbox,
    logMessage: string | null
  ): Promise<void> {
    try {
      await sandbox.stop();
      if (logMessage) {
        await addLog({
          sessionId,
          level: 'info',
          message: logMessage,
        });
      }
    } catch {
      // Ignore stop errors
    }
    activeSandboxes.delete(sessionId);
  }

  /**
   * Stop a running sandbox
   */
  async stopSandbox(sandboxId: string): Promise<void> {
    try {
      const sandbox = await Sandbox.get({ sandboxId });
      await sandbox.stop();
    } catch (error) {
      console.error(`Failed to stop sandbox ${sandboxId}:`, error);
      throw error;
    }
  }

  /**
   * Stop sandbox by session ID
   */
  async stopSandboxBySession(sessionId: string): Promise<void> {
    const sandboxRef = activeSandboxes.get(sessionId);
    if (sandboxRef) {
      try {
        await sandboxRef.sandbox.stop();
        activeSandboxes.delete(sessionId);
        await setSessionStatus(sessionId, 'completed');
        await addLog({
          sessionId,
          level: 'info',
          message: 'Sandbox stopped by user request.',
        });
      } catch (error) {
        console.error(`Failed to stop sandbox for session ${sessionId}:`, error);
        throw error;
      }
    } else {
      // Try to stop via database sandboxId
      const session = await getSession(sessionId);
      if (session?.sandboxId) {
        await this.stopSandbox(session.sandboxId);
        await setSessionStatus(sessionId, 'completed');
      }
    }
  }

  /**
   * Get sandbox by session ID from active sandboxes
   */
  async getSandboxBySession(sessionId: string): Promise<Sandbox | null> {
    const sandboxRef = activeSandboxes.get(sessionId);
    if (sandboxRef) {
      return sandboxRef.sandbox;
    }

    // Try to get from database and reconnect
    const session = await getSession(sessionId);
    if (session?.sandboxId) {
      try {
        const sandbox = await Sandbox.get({ sandboxId: session.sandboxId });
        if (sandbox.status === 'running') {
          activeSandboxes.set(sessionId, { sandbox });
          return sandbox;
        }
      } catch {
        // Sandbox no longer exists or is stopped
      }
    }

    return null;
  }

  /**
   * Extend sandbox timeout
   */
  async extendTimeout(sessionId: string, durationMs: number): Promise<void> {
    const sandbox = await this.getSandboxBySession(sessionId);
    if (sandbox) {
      await sandbox.extendTimeout(durationMs);
      await addLog({
        sessionId,
        level: 'info',
        message: `Sandbox timeout extended by ${durationMs / 1000} seconds.`,
      });
    } else {
      throw new Error('Sandbox not found or not running');
    }
  }

  /**
   * Remove sandbox from active sandboxes (for cleanup after snapshot)
   */
  removeActiveSandbox(sessionId: string): void {
    activeSandboxes.delete(sessionId);
  }
}
