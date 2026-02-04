import type { Command } from '@vercel/sandbox';
import { addLog, updateSession } from '@/lib/db/queries';
import type { LogLevel } from '@/types/sandbox';
import { extractPrUrl, validatePrUrl } from './pr-detector';

/**
 * LogStreamService - Handles log streaming and PR URL detection
 *
 * Responsibilities:
 * - Stream command logs to database
 * - Detect and validate PR URLs from log output
 * - Save detected PR URLs to session
 */
export class LogStreamService {
  /**
   * Stream logs from command and detect PR URLs
   */
  async streamLogsAndDetectPrUrl(
    sessionId: string,
    command: Command,
    repoSlug?: string
  ): Promise<void> {
    let prUrlDetected = false;

    try {
      for await (const log of command.logs()) {
        const level: LogLevel = log.stream === 'stderr' ? 'stderr' : 'stdout';

        // Split by newlines and log each line separately
        const lines = log.data.split('\n').filter((line) => line.trim());
        for (const line of lines) {
          await addLog({
            sessionId,
            level,
            message: line,
          });

          // Check for PR URL if not already detected
          if (!prUrlDetected) {
            const prUrl = extractPrUrl(line);
            if (prUrl && prUrl !== null) {
              await this.handlePrUrlDetection(sessionId, prUrl, repoSlug);
              prUrlDetected = true;
            }
          }
        }
      }
    } catch (streamError) {
      // Log streaming might fail if sandbox stops
      console.error('Log streaming error:', streamError);
    }
  }

  /**
   * Handle PR URL detection and save to session
   */
  private async handlePrUrlDetection(
    sessionId: string,
    prUrl: string,
    repoSlug?: string
  ): Promise<void> {
    const isValid = repoSlug ? validatePrUrl(prUrl, repoSlug) : true;

    if (!isValid) {
      await addLog({
        sessionId,
        level: 'info',
        message: `⚠️ Detected PR URL does not match repository: ${prUrl}`,
      });
    }

    try {
      await updateSession(sessionId, { prUrl });
      await addLog({
        sessionId,
        level: 'info',
        message: `✓ Pull request detected and saved: ${prUrl}`,
      });
    } catch (updateError) {
      await addLog({
        sessionId,
        level: 'error',
        message: `Failed to save PR URL: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`,
      });
    }
  }
}
