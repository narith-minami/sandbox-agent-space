import { Sandbox, type Command } from '@vercel/sandbox';
import type { LogLevel, SessionStatus, SandboxConfig, VercelSandboxStatus } from '@/types/sandbox';
import { addLog, setSessionStatus, setSessionSandboxId, updateSession, getSession } from '@/lib/db/queries';
import { getSandboxRuntime, getSandboxTimeout, requireAuthentication, type SandboxRuntime } from './auth';
import { extractPrUrl, validatePrUrl } from './pr-detector';

export interface SandboxCreateOptions {
  env: Record<string, string>;
  command: string;
  runtime?: SandboxRuntime;
  snapshotId?: string;
}

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

// Store active sandbox references for log streaming and management
const activeSandboxes = new Map<string, { sandbox: Sandbox; command?: Command }>();

/**
 * SandboxManager - Manages sandbox execution using Vercel Sandbox SDK
 * 
 * This implementation uses the official Vercel Sandbox SDK to create and manage
 * isolated Linux microVMs for secure code execution.
 */
export class SandboxManager {
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
      let sandbox: Sandbox;

      if (options.snapshotId) {
        // Create from snapshot
        await addLog({
          sessionId,
          level: 'info',
          message: `Creating sandbox from snapshot: ${options.snapshotId}`,
        });

        sandbox = await Sandbox.create({
          runtime,
          timeout,
          source: {
            type: 'snapshot',
            snapshotId: options.snapshotId,
          },
        });
      } else if (options.env.REPO_URL) {
        // Create with Git source
        const repoUrl = options.env.REPO_URL;
        const githubToken = options.env.GITHUB_TOKEN;

        await addLog({
          sessionId,
          level: 'info',
          message: `Cloning repository: ${options.env.REPO_SLUG || repoUrl}`,
        });

        sandbox = await Sandbox.create({
          runtime,
          timeout,
          source: {
            type: 'git',
            url: repoUrl,
            username: 'x-access-token',
            password: githubToken,
            depth: 1, // Shallow clone for faster setup
          },
        });
      } else {
        // Create empty sandbox
        sandbox = await Sandbox.create({
          runtime,
          timeout,
        });
      }

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
      this.executeCommand(sessionId, sandbox, options).catch(error => {
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

      // Log environment variables (masked)
      const envKeys = Object.keys(options.env);
      await addLog({
        sessionId,
        level: 'debug',
        message: `Environment variables set: ${envKeys.join(', ')}`,
      });

      // Log the command (truncated for safety)
      const truncatedCmd = options.command.substring(0, 200) + (options.command.length > 200 ? '...' : '');
      await addLog({
        sessionId,
        level: 'info',
        message: `Command: ${truncatedCmd}`,
      });

      // Download and execute the script from Gist if GIST_URL is provided
      if (options.env.GIST_URL) {
        await addLog({
          sessionId,
          level: 'info',
          message: 'Downloading script from Gist...',
        });

        // Download the script
        const downloadResult = await sandbox.runCommand('curl', ['-fsSL', options.env.GIST_URL, '-o', 'run.sh']);
        if (downloadResult.exitCode !== 0) {
          const stderr = await downloadResult.stderr();
          throw new Error(`Failed to download script: ${stderr}`);
        }

        // Make it executable
        await sandbox.runCommand('chmod', ['+x', 'run.sh']);

        await addLog({
          sessionId,
          level: 'info',
          message: 'Script downloaded, starting execution...',
        });
      }

      // Run the main command with environment variables
      // Using detached mode to stream logs in real-time
      const command = await sandbox.runCommand({
        cmd: 'bash',
        args: ['-c', options.command],
        env: options.env,
        cwd: options.env.FRONT_DIR ? `/vercel/sandbox/${options.env.FRONT_DIR}` : '/vercel/sandbox',
        detached: true,
      });

      // Store command reference
      const sandboxRef = activeSandboxes.get(sessionId);
      if (sandboxRef) {
        sandboxRef.command = command;
      }

      // Stream logs in real-time
      try {
        let prUrlDetected = false; // Track if PR URL has been detected
        
        for await (const log of command.logs()) {
          const level: LogLevel = log.stream === 'stderr' ? 'stderr' : 'stdout';
          
          // Split by newlines and log each line separately
          const lines = log.data.split('\n').filter(line => line.trim());
          for (const line of lines) {
            // Log the message
            await addLog({
              sessionId,
              level,
              message: line,
            });
            
            // Check for PR URL if not already detected
            if (!prUrlDetected) {
              const prUrl = extractPrUrl(line);
              if (prUrl) {
                // Validate PR URL against repository
                const isValid = validatePrUrl(prUrl, options.env.REPO_SLUG);
                
                if (!isValid) {
                  await addLog({
                    sessionId,
                    level: 'info',
                    message: `⚠️ Detected PR URL does not match repository: ${prUrl}`,
                  });
                }
                
                // Update session with PR URL
                try {
                  await updateSession(sessionId, { prUrl });
                  await addLog({
                    sessionId,
                    level: 'info',
                    message: `✓ Pull request detected and saved: ${prUrl}`,
                  });
                  prUrlDetected = true; // Only save the first PR URL
                } catch (updateError) {
                  await addLog({
                    sessionId,
                    level: 'error',
                    message: `Failed to save PR URL: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`,
                  });
                }
              }
            }
          }
        }
      } catch (streamError) {
        // Log streaming might fail if sandbox stops
        console.error('Log streaming error:', streamError);
      }

      // Wait for command to complete and get result
      const result = await command.wait();

      if (result.exitCode === 0) {
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
          message: `Command exited with code: ${result.exitCode}`,
        });
      }

      // Clean up: stop sandbox after execution
      try {
        await sandbox.stop();
        await addLog({
          sessionId,
          level: 'info',
          message: 'Sandbox stopped and resources released.',
        });
      } catch (stopError) {
        console.error('Failed to stop sandbox:', stopError);
      }

      // Remove from active sandboxes
      activeSandboxes.delete(sessionId);

    } catch (error) {
      await setSessionStatus(sessionId, 'failed');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await addLog({
        sessionId,
        level: 'error',
        message: `Execution failed: ${errorMessage}`,
      });

      // Clean up on error
      try {
        await sandbox.stop();
      } catch {
        // Ignore stop errors
      }
      activeSandboxes.delete(sessionId);
    }
  }

  /**
   * Get sandbox status from Vercel SDK
   */
  async getSandboxStatus(sandboxId: string): Promise<SandboxStatus> {
    try {
      const sandbox = await Sandbox.get({ sandboxId });
      
      // Map Vercel status to our session status
      let status: SessionStatus;
      switch (sandbox.status) {
        case 'pending':
          status = 'pending';
          break;
        case 'running':
          status = 'running';
          break;
        case 'stopping':
          status = 'stopping';
          break;
        case 'stopped':
          status = 'completed';
          break;
        case 'failed':
          status = 'failed';
          break;
        default:
          status = 'pending';
      }

      return {
        status,
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
   * Stream logs from sandbox
   * This is a generator that yields log entries
   */
  async *streamLogs(sessionId: string): AsyncGenerator<SandboxLogEntry> {
    const { getLogsBySessionId, getSession } = await import('@/lib/db/queries');

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

      await new Promise(resolve => setTimeout(resolve, 1000));
      iterations++;
    }
  }

  /**
   * Stop a running sandbox
   */
  async stopSandbox(sandboxId: string): Promise<void> {
    try {
      const sandbox = await Sandbox.get({ sandboxId });
      await sandbox.stop();
      console.log(`Sandbox ${sandboxId} stopped successfully`);
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
   * Create a snapshot of the current sandbox state
   */
  async createSnapshot(sessionId: string): Promise<{ snapshotId: string; expiresAt: Date }> {
    const sandbox = await this.getSandboxBySession(sessionId);
    if (!sandbox) {
      throw new Error('Sandbox not found or not running');
    }

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
    activeSandboxes.delete(sessionId);
    await setSessionStatus(sessionId, 'completed');

    return {
      snapshotId: snapshot.snapshotId,
      expiresAt: snapshot.expiresAt,
    };
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
  async writeFiles(
    sessionId: string,
    files: { path: string; content: Buffer }[]
  ): Promise<void> {
    const sandbox = await this.getSandboxBySession(sessionId);
    if (!sandbox) {
      throw new Error('Sandbox not found or not running');
    }

    await sandbox.writeFiles(files);
    await addLog({
      sessionId,
      level: 'info',
      message: `Wrote ${files.length} file(s) to sandbox.`,
    });
  }

  /**
   * Read file from sandbox
   */
  async readFile(sessionId: string, path: string): Promise<Buffer | null> {
    const sandbox = await this.getSandboxBySession(sessionId);
    if (!sandbox) {
      throw new Error('Sandbox not found or not running');
    }

    return sandbox.readFileToBuffer({ path });
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
    const sandbox = await this.getSandboxBySession(sessionId);
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
