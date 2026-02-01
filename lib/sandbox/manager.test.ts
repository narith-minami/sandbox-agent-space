import { describe, expect, it, vi } from 'vitest';
import {
  getSandboxManager,
  SandboxManager,
} from './manager';

// Mock dependencies
vi.mock('@/lib/db/queries', () => ({
  addLog: vi.fn().mockResolvedValue({}),
  getSession: vi.fn().mockResolvedValue({}),
  setSessionSandboxId: vi.fn().mockResolvedValue({}),
  setSessionStatus: vi.fn().mockResolvedValue({}),
  updateSession: vi.fn().mockResolvedValue({}),
}));

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
  },
  Command: vi.fn(),
}));

vi.mock('./auth', () => ({
  getSandboxRuntime: vi.fn().mockReturnValue('node24'),
  getSandboxTimeout: vi.fn().mockReturnValue(600000),
  requireAuthentication: vi.fn(),
}));

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
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
        timeout: 600000,
      };

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
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
        timeout: 600000,
      };

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
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
        timeout: 600000,
      };

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
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
        timeout: 600000,
      };

      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.get).mockResolvedValue(mockSandbox as never);

      const result = await manager.getSandboxStatus('sandbox-123');
      expect(result.status).toBe('running');
      expect(result.vercelStatus).toBe('running');
    });

    it('should return failed status on error', async () => {
      const manager = new SandboxManager();

      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.get).mockRejectedValue(new Error('Not found'));

      const result = await manager.getSandboxStatus('sandbox-123');
      expect(result.status).toBe('failed');
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
      const mockStop = vi.fn().mockRejectedValue(new Error('Stop failed'));
      const mockSandbox = {
        sandboxId: 'sandbox-123',
        status: 'running',
        stop: mockStop,
      };

      const { Sandbox } = await import('@vercel/sandbox');
      vi.mocked(Sandbox.get).mockResolvedValue(mockSandbox as never);

      await expect(manager.stopSandbox('sandbox-123')).rejects.toThrow('Stop failed');
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
});
