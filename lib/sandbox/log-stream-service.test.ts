import type { Command } from '@vercel/sandbox';
import { describe, expect, it, vi } from 'vitest';
import { LogStreamService } from './log-stream-service';

// Mock dependencies
vi.mock('@/lib/db/queries', () => ({
  addLog: vi.fn().mockResolvedValue({}),
  updateSession: vi.fn().mockResolvedValue({}),
}));

vi.mock('./pr-detector', () => ({
  extractPrUrl: vi.fn(),
  validatePrUrl: vi.fn(),
}));

describe('LogStreamService', () => {
  describe('streamLogsAndDetectPrUrl', () => {
    it('should stream logs to database', async () => {
      const service = new LogStreamService();
      const { addLog } = await import('@/lib/db/queries');

      const mockCommand = {
        async *logs() {
          yield { stream: 'stdout', data: 'Line 1\nLine 2' };
        },
      } as unknown as Command;

      await service.streamLogsAndDetectPrUrl('session-123', mockCommand);

      expect(addLog).toHaveBeenCalledWith({
        sessionId: 'session-123',
        level: 'stdout',
        message: 'Line 1',
      });
      expect(addLog).toHaveBeenCalledWith({
        sessionId: 'session-123',
        level: 'stdout',
        message: 'Line 2',
      });
    });

    it('should handle stderr logs', async () => {
      const service = new LogStreamService();
      const { addLog } = await import('@/lib/db/queries');

      const mockCommand = {
        async *logs() {
          yield { stream: 'stderr', data: 'Error message' };
        },
      } as unknown as Command;

      await service.streamLogsAndDetectPrUrl('session-123', mockCommand);

      expect(addLog).toHaveBeenCalledWith({
        sessionId: 'session-123',
        level: 'stderr',
        message: 'Error message',
      });
    });

    it('should detect and save PR URL', async () => {
      const service = new LogStreamService();
      const { addLog, updateSession } = await import('@/lib/db/queries');
      const { extractPrUrl } = await import('./pr-detector');

      vi.mocked(extractPrUrl)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce('https://github.com/owner/repo/pull/1');

      const mockCommand = {
        async *logs() {
          yield {
            stream: 'stdout',
            data: 'Some output\nPR created: https://github.com/owner/repo/pull/1',
          };
        },
      } as unknown as Command;

      await service.streamLogsAndDetectPrUrl('session-123', mockCommand, 'owner/repo');

      expect(updateSession).toHaveBeenCalledWith('session-123', {
        prUrl: 'https://github.com/owner/repo/pull/1',
      });
      expect(addLog).toHaveBeenCalledWith({
        sessionId: 'session-123',
        level: 'info',
        message: '✓ Pull request detected and saved: https://github.com/owner/repo/pull/1',
      });
    });

    it('should validate PR URL against repo slug', async () => {
      const service = new LogStreamService();
      const { addLog, updateSession } = await import('@/lib/db/queries');
      const { extractPrUrl, validatePrUrl } = await import('./pr-detector');

      vi.mocked(extractPrUrl).mockReturnValueOnce('https://github.com/wrong/repo/pull/1');
      vi.mocked(validatePrUrl).mockReturnValue(false);

      const mockCommand = {
        async *logs() {
          yield { stream: 'stdout', data: 'PR: https://github.com/wrong/repo/pull/1' };
        },
      } as unknown as Command;

      await service.streamLogsAndDetectPrUrl('session-123', mockCommand, 'owner/repo');

      expect(validatePrUrl).toHaveBeenCalledWith(
        'https://github.com/wrong/repo/pull/1',
        'owner/repo'
      );
      expect(addLog).toHaveBeenCalledWith({
        sessionId: 'session-123',
        level: 'info',
        message:
          '⚠️ Detected PR URL does not match repository: https://github.com/wrong/repo/pull/1',
      });
      expect(updateSession).toHaveBeenCalled(); // Still saves it
    });

    it('should handle PR URL detection only once', async () => {
      const service = new LogStreamService();
      const { updateSession } = await import('@/lib/db/queries');
      const { extractPrUrl } = await import('./pr-detector');

      vi.mocked(extractPrUrl)
        .mockReturnValueOnce('https://github.com/owner/repo/pull/1')
        .mockReturnValueOnce('https://github.com/owner/repo/pull/2');

      const mockCommand = {
        async *logs() {
          yield { stream: 'stdout', data: 'PR 1\nPR 2' };
        },
      } as unknown as Command;

      await service.streamLogsAndDetectPrUrl('session-123', mockCommand);

      // Should only update once with first PR URL
      expect(updateSession).toHaveBeenCalledTimes(1);
      expect(updateSession).toHaveBeenCalledWith('session-123', {
        prUrl: 'https://github.com/owner/repo/pull/1',
      });
    });

    it('should handle update errors gracefully', async () => {
      const service = new LogStreamService();
      const { addLog, updateSession } = await import('@/lib/db/queries');
      const { extractPrUrl } = await import('./pr-detector');

      vi.mocked(extractPrUrl).mockReturnValueOnce('https://github.com/owner/repo/pull/1');
      vi.mocked(updateSession).mockRejectedValueOnce(new Error('Database error'));

      const mockCommand = {
        async *logs() {
          yield { stream: 'stdout', data: 'PR: https://github.com/owner/repo/pull/1' };
        },
      } as unknown as Command;

      await service.streamLogsAndDetectPrUrl('session-123', mockCommand);

      expect(addLog).toHaveBeenCalledWith({
        sessionId: 'session-123',
        level: 'error',
        message: 'Failed to save PR URL: Database error',
      });
    });

    it('should handle streaming errors gracefully', async () => {
      const service = new LogStreamService();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('Stream error');
      const mockCommand = {
        async *logs() {
          yield { stream: 'stdout', data: 'Starting...' };
          throw error;
        },
      } as unknown as Command;

      await service.streamLogsAndDetectPrUrl('session-123', mockCommand);

      expect(consoleSpy).toHaveBeenCalledWith('Log streaming error:', error);
      consoleSpy.mockRestore();
    });

    it('should skip empty lines', async () => {
      const service = new LogStreamService();
      const { addLog } = await import('@/lib/db/queries');

      const mockCommand = {
        async *logs() {
          yield { stream: 'stdout', data: 'Line 1\n\n  \nLine 2' };
        },
      } as unknown as Command;

      await service.streamLogsAndDetectPrUrl('session-123', mockCommand);

      // Should only log non-empty lines
      expect(addLog).toHaveBeenCalledTimes(2);
    });
  });
});
