import type { Sandbox } from '@vercel/sandbox';
import { describe, expect, it, vi } from 'vitest';
import {
  createMockAuthModule,
  createMockQueries,
  createMockSandbox,
  createMockSandboxModule,
} from '@/test/helpers';
import { getSandboxManager, SandboxManager } from './manager';

// Mock dependencies with shared utilities
vi.mock('@/lib/db/queries', () => createMockQueries());
vi.mock('@vercel/sandbox', () => createMockSandboxModule());
vi.mock('./auth', () => createMockAuthModule());

describe('getSandboxManager', () => {
  it('should return singleton instance', () => {
    const manager1 = getSandboxManager();
    const manager2 = getSandboxManager();
    expect(manager1).toBe(manager2);
  });

  it('should create new instance when none exists', () => {
    const manager = getSandboxManager();
    expect(manager).toBeInstanceOf(SandboxManager);
  });
});

describe('SandboxManager', () => {
  describe('createSandbox', () => {
    it('should create sandbox from snapshot', async () => {
      const manager = new SandboxManager();
      const mockSandbox = createMockSandbox({ sandboxId: 'sandbox-123' });

      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox as never);

      const result = await manager.createSandbox('session-123', {
        env: {},
        command: 'echo test',
        snapshotId: 'snap-456',
      });

      expect(result.sandboxId).toBe('sandbox-123');
      expect(Sandbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: expect.objectContaining({ type: 'snapshot' }),
        })
      );
    });

    it('should create sandbox from git repo', async () => {
      const manager = new SandboxManager();
      const mockSandbox = createMockSandbox({ sandboxId: 'sandbox-123' });

      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox as never);

      const result = await manager.createSandbox('session-123', {
        env: {
          REPO_URL: 'https://github.com/owner/repo',
          GITHUB_TOKEN: 'token123',
          BASE_BRANCH: 'main',
        },
        command: 'echo test',
      });

      expect(result.sandboxId).toBe('sandbox-123');
      expect(Sandbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: expect.objectContaining({ type: 'git' }),
        })
      );
    });

    it('should create empty sandbox when no source provided', async () => {
      const manager = new SandboxManager();
      const mockSandbox = createMockSandbox({ sandboxId: 'sandbox-123' });

      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox as never);

      const result = await manager.createSandbox('session-123', {
        env: {},
        command: 'echo test',
      });

      expect(result.sandboxId).toBe('sandbox-123');
      expect(Sandbox.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ source: expect.anything() })
      );
    });

    it('should throw error when sandbox creation fails', async () => {
      const manager = new SandboxManager();

      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.create).mockRejectedValue(new Error('Creation failed'));

      await expect(
        manager.createSandbox('session-123', {
          env: {},
          command: 'echo test',
        })
      ).rejects.toThrow('Creation failed');
    });
  });

  describe('getSandboxStatus', () => {
    it('should return mapped status', async () => {
      const manager = new SandboxManager();
      const mockSandbox = createMockSandbox({ sandboxId: 'sandbox-123', status: 'running' });

      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.get).mockResolvedValue(mockSandbox as never);

      const result = await manager.getSandboxStatus('sandbox-123');
      expect(result.status).toBe('running');
      expect(result.vercelStatus).toBe('running');
    });

    it('should return failed status on error', async () => {
      const manager = new SandboxManager();
      const error = new Error('Get failed');

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.get).mockRejectedValue(error);

      const result = await manager.getSandboxStatus('sandbox-123');
      expect(result.status).toBe('failed');
      expect(errorSpy).toHaveBeenCalledWith('Failed to get sandbox status:', error);
      errorSpy.mockRestore();
    });

    it('should return failed status when not found', async () => {
      const manager = new SandboxManager();

      const error = new Error('Not found');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.get).mockRejectedValue(error);

      const result = await manager.getSandboxStatus('sandbox-123');
      expect(result.status).toBe('failed');
      expect(errorSpy).toHaveBeenCalledWith('Failed to get sandbox status:', error);
      errorSpy.mockRestore();
    });
  });

  describe('stopSandbox', () => {
    it('should stop sandbox successfully', async () => {
      const manager = new SandboxManager();
      const mockStop = vi.fn().mockResolvedValue(undefined);
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
        stop: mockStop,
      };

      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.get).mockResolvedValue(mockSandbox as never);

      await manager.stopSandbox('sandbox-123');
      expect(mockStop).toHaveBeenCalled();
    });

    it('should throw error when stop fails', async () => {
      const manager = new SandboxManager();
      const error = new Error('Stop failed');
      const mockStop = vi.fn().mockRejectedValue(error);
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
        stop: mockStop,
      };

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.get).mockResolvedValue(mockSandbox as never);

      await expect(manager.stopSandbox('sandbox-123')).rejects.toThrow('Stop failed');
      expect(errorSpy).toHaveBeenCalledWith('Failed to stop sandbox sandbox-123:', error);
      errorSpy.mockRestore();
    });
  });

  describe('listSandboxes', () => {
    it('should return sandbox list', async () => {
      const manager = new SandboxManager();
      const mockResponse = {
        json: {
          sandboxes: [
            { id: 'sandbox-1', status: 'running' },
            { id: 'sandbox-2', status: 'stopped' },
          ],
        },
      };

      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.list).mockResolvedValue(mockResponse as never);

      const result = await manager.listSandboxes();
      expect(result.sandboxes).toHaveLength(2);
    });
  });

  describe('extendTimeout', () => {
    it('should extend timeout when sandbox found', async () => {
      const manager = new SandboxManager();
      const mockExtend = vi.fn().mockResolvedValue(undefined);

      // Create mock sandbox for initial creation
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
        timeout: 600000,
        extendTimeout: mockExtend,
      };

      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox as never);

      // First create sandbox to add to activeSandboxes
      await manager.createSandbox('session-123', {
        env: {},
        command: 'echo test',
      });

      await manager.extendTimeout('session-123', 300000);
      expect(mockExtend).toHaveBeenCalledWith(300000);
    });

    it('should throw error when sandbox not found', async () => {
      const manager = new SandboxManager();

      await expect(manager.extendTimeout('session-123', 300000)).rejects.toThrow(
        'Sandbox not found or not running'
      );
    });
  });

  describe('createSnapshot', () => {
    it('should create snapshot and stop sandbox', async () => {
      const manager = new SandboxManager();
      const mockSnapshot = {
        snapshotId: 'snap-123',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      const mockSnapshotFn = vi.fn().mockResolvedValue(mockSnapshot);
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
        snapshot: mockSnapshotFn,
        stop: vi.fn().mockResolvedValue(undefined),
      };

      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox as never);

      // Create sandbox first
      await manager.createSandbox('session-123', {
        env: {},
        command: 'echo test',
      });

      const result = await manager.createSnapshot('session-123');
      expect(result.snapshotId).toBe('snap-123');
      expect(mockSnapshotFn).toHaveBeenCalled();
    });

    it('should throw error when sandbox not found', async () => {
      const manager = new SandboxManager();

      await expect(manager.createSnapshot('session-123')).rejects.toThrow(
        'Sandbox not found or not running'
      );
    });
  });

  describe('getSandboxBySession', () => {
    it('should reconnect to sandbox when session has sandboxId', async () => {
      const manager = new SandboxManager();
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
      };

      const { getSession } = await import('@/lib/db/queries');
      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(getSession).mockResolvedValue({
        id: 'session-123',
        sandboxId: 'sandbox-123',
        status: 'running',
        runtime: 'node24',
        config: {
          planSource: 'file',
          planFile: 'plan.md',
          planText: '',
          gistUrl: 'https://gist.githubusercontent.com/user/id/raw',
          repoUrl: 'https://github.com/owner/repo',
          repoSlug: 'owner/repo',
          baseBranch: 'main',
          frontDir: '',
          opencodeAuthJsonB64: '',
          runtime: 'node24',
          enableCodeReview: false,
        },
        memo: null,
        prUrl: null,
        prStatus: null,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(Sandbox.get).mockResolvedValue(mockSandbox as never);

      const result = await manager.getSandboxBySession('session-123');
      expect(result).toBe(mockSandbox);
    });
  });

  describe('stopSandboxBySession', () => {
    it('should stop sandbox using active sandbox reference', async () => {
      const manager = new SandboxManager();
      const mockStop = vi.fn().mockResolvedValue(undefined);
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
        timeout: 600000,
        stop: mockStop,
      };

      const { setSessionStatus, addLog } = await import('@/lib/db/queries');
      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox as never);

      await manager.createSandbox('session-123', {
        env: {},
        command: 'echo test',
      });

      await manager.stopSandboxBySession('session-123');

      expect(mockStop).toHaveBeenCalled();
      expect(setSessionStatus).toHaveBeenCalledWith('session-123', 'completed');
      expect(addLog).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
          message: 'Sandbox stopped by user request.',
        })
      );
    });
  });

  describe('streamLogs', () => {
    it('should yield new logs and stop when session completes', async () => {
      const manager = new SandboxManager();
      const logs = [
        {
          id: 'log-1',
          sessionId: 'session-123',
          timestamp: new Date('2024-01-01T00:00:00.000Z'),
          level: 'stdout' as const,
          message: 'hello',
        },
      ];

      const { getLogsBySessionId, getSession } = await import('@/lib/db/queries');
      vi.mocked(getLogsBySessionId).mockResolvedValue(logs);
      vi.mocked(getSession).mockResolvedValue({
        id: 'session-123',
        sandboxId: 'sandbox-123',
        status: 'completed',
        runtime: 'node24',
        config: {
          planSource: 'file',
          planFile: 'plan.md',
          planText: '',
          gistUrl: 'https://gist.githubusercontent.com/user/id/raw',
          repoUrl: 'https://github.com/owner/repo',
          repoSlug: 'owner/repo',
          baseBranch: 'main',
          frontDir: '',
          opencodeAuthJsonB64: '',
          runtime: 'node24',
          enableCodeReview: false,
        },
        memo: null,
        prUrl: null,
        prStatus: null,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const entries: string[] = [];
      for await (const entry of manager.streamLogs('session-123')) {
        entries.push(entry.message);
      }

      expect(entries).toEqual(['hello']);
    });
  });

  describe('file and command helpers', () => {
    it('should write files to sandbox', async () => {
      const manager = new SandboxManager();
      const mockWriteFiles = vi.fn().mockResolvedValue(undefined);
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
        writeFiles: mockWriteFiles,
      } as Partial<Sandbox> as Sandbox;

      // Spy on the lifecycleManager's method (using bracket notation for private member)
      // biome-ignore lint/complexity/useLiteralKeys: accessing private member
      vi.spyOn(manager['lifecycleManager'], 'getSandboxBySession').mockResolvedValue(mockSandbox);

      await manager.writeFiles('session-123', [
        { path: '/tmp/test.txt', content: Buffer.from('ok') },
      ]);

      expect(mockWriteFiles).toHaveBeenCalled();
    });

    it('should read file from sandbox', async () => {
      const manager = new SandboxManager();
      const mockReadFileToBuffer = vi.fn().mockResolvedValue(Buffer.from('data'));
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
        readFileToBuffer: mockReadFileToBuffer,
      } as Partial<Sandbox> as Sandbox;

      // Spy on the lifecycleManager's method (using bracket notation for private member)
      // biome-ignore lint/complexity/useLiteralKeys: accessing private member
      vi.spyOn(manager['lifecycleManager'], 'getSandboxBySession').mockResolvedValue(mockSandbox);

      const result = await manager.readFile('session-123', '/tmp/test.txt');
      expect(result).toEqual(Buffer.from('data'));
    });

    it('should run command and return outputs', async () => {
      const manager = new SandboxManager();
      const mockCommandResult = {
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue('ok'),
        stderr: vi.fn().mockResolvedValue(''),
      };
      const mockRunCommand = vi.fn().mockResolvedValue(mockCommandResult);
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
        runCommand: mockRunCommand,
      } as Partial<Sandbox> as Sandbox;

      // Spy on the lifecycleManager's method (using bracket notation for private member)
      // biome-ignore lint/complexity/useLiteralKeys: accessing private member
      vi.spyOn(manager['lifecycleManager'], 'getSandboxBySession').mockResolvedValue(mockSandbox);

      const result = await manager.runCommand('session-123', 'echo', ['test']);

      expect(result).toEqual({ exitCode: 0, stdout: 'ok', stderr: '' });
      expect(mockRunCommand).toHaveBeenCalledWith({
        cmd: 'echo',
        args: ['test'],
        cwd: undefined,
        env: undefined,
        sudo: undefined,
      });
    });
  });
});
