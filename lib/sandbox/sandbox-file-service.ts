import type { Sandbox } from '@vercel/sandbox';
import { addLog } from '@/lib/db/queries';

/**
 * SandboxFileService - Handles file operations in sandbox
 *
 * Responsibilities:
 * - Write files to sandbox
 * - Read files from sandbox
 * - Write plan files with directory creation
 * - Download and prepare Gist scripts
 */
export class SandboxFileService {
  /**
   * Write plan text to file in sandbox
   */
  async writePlanFile(
    sessionId: string,
    sandbox: Sandbox,
    planText: string,
    planFilePath: string
  ): Promise<void> {
    try {
      // Ensure parent directory exists
      const dirPath = planFilePath.substring(0, planFilePath.lastIndexOf('/'));
      if (dirPath) {
        await sandbox.runCommand('mkdir', ['-p', dirPath]);
      }

      // Write plan text as file
      await sandbox.writeFiles([
        {
          path: planFilePath,
          content: Buffer.from(planText, 'utf-8'),
        },
      ]);

      await addLog({
        sessionId,
        level: 'info',
        message: `Plan file created at ${planFilePath}`,
      });
    } catch (error) {
      await addLog({
        sessionId,
        level: 'error',
        message: `Failed to write plan file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Download script from Gist and prepare for execution
   */
  async downloadAndPrepareGist(
    sessionId: string,
    sandbox: Sandbox,
    gistUrl: string
  ): Promise<void> {
    await addLog({
      sessionId,
      level: 'info',
      message: 'Downloading script from Gist...',
    });

    const downloadResult = await sandbox.runCommand('curl', ['-fsSL', gistUrl, '-o', 'run.sh']);
    if (downloadResult.exitCode !== 0) {
      const stderr = await downloadResult.stderr();
      throw new Error(`Failed to download script: ${stderr}`);
    }

    await sandbox.runCommand('chmod', ['+x', 'run.sh']);

    await addLog({
      sessionId,
      level: 'info',
      message: 'Script downloaded, starting execution...',
    });
  }

  /**
   * Write files to sandbox
   */
  async writeFiles(
    sessionId: string,
    sandbox: Sandbox,
    files: { path: string; content: Buffer }[]
  ): Promise<void> {
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
  async readFile(sandbox: Sandbox, path: string): Promise<Buffer | null> {
    return sandbox.readFileToBuffer({ path });
  }
}
