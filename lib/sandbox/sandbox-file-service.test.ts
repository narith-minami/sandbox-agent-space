import type { Sandbox } from '@vercel/sandbox';
import { describe, expect, it, vi } from 'vitest';
import { SandboxFileService } from './sandbox-file-service';

// Mock dependencies
vi.mock('@/lib/db/queries', () => ({
  addLog: vi.fn().mockResolvedValue({}),
}));

describe('SandboxFileService', () => {
  describe('writePlanFile', () => {
    it('should create directory and write plan file', async () => {
      const service = new SandboxFileService();
      const { addLog } = await import('@/lib/db/queries');

      const mockRunCommand = vi.fn().mockResolvedValue({ exitCode: 0 });
      const mockWriteFiles = vi.fn().mockResolvedValue(undefined);
      const mockSandbox = {
        runCommand: mockRunCommand,
        writeFiles: mockWriteFiles,
      } as unknown as Sandbox;

      await service.writePlanFile('session-123', mockSandbox, 'Test plan', '/workspace/plan.md');

      expect(mockRunCommand).toHaveBeenCalledWith('mkdir', ['-p', '/workspace']);
      expect(mockWriteFiles).toHaveBeenCalledWith([
        {
          path: '/workspace/plan.md',
          content: Buffer.from('Test plan', 'utf-8'),
        },
      ]);
      expect(addLog).toHaveBeenCalledWith({
        sessionId: 'session-123',
        level: 'info',
        message: 'Plan file created at /workspace/plan.md',
      });
    });

    it('should skip directory creation for root files', async () => {
      const service = new SandboxFileService();

      const mockRunCommand = vi.fn();
      const mockWriteFiles = vi.fn().mockResolvedValue(undefined);
      const mockSandbox = {
        runCommand: mockRunCommand,
        writeFiles: mockWriteFiles,
      } as unknown as Sandbox;

      await service.writePlanFile('session-123', mockSandbox, 'Test plan', 'plan.md');

      expect(mockRunCommand).not.toHaveBeenCalled();
      expect(mockWriteFiles).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const service = new SandboxFileService();
      const { addLog } = await import('@/lib/db/queries');

      const error = new Error('Write failed');
      const mockWriteFiles = vi.fn().mockRejectedValue(error);
      const mockSandbox = {
        runCommand: vi.fn().mockResolvedValue({ exitCode: 0 }),
        writeFiles: mockWriteFiles,
      } as unknown as Sandbox;

      await service.writePlanFile('session-123', mockSandbox, 'Test plan', '/workspace/plan.md');

      expect(addLog).toHaveBeenCalledWith({
        sessionId: 'session-123',
        level: 'error',
        message: 'Failed to write plan file: Write failed',
      });
    });
  });

  describe('downloadAndPrepareGist', () => {
    it('should download and prepare gist script', async () => {
      const service = new SandboxFileService();
      const { addLog } = await import('@/lib/db/queries');

      const mockStdout = vi.fn().mockResolvedValue('');
      const mockStderr = vi.fn().mockResolvedValue('');
      const mockRunCommand = vi
        .fn()
        .mockResolvedValueOnce({ exitCode: 0, stdout: mockStdout, stderr: mockStderr })
        .mockResolvedValueOnce({ exitCode: 0 });

      const mockSandbox = {
        runCommand: mockRunCommand,
      } as unknown as Sandbox;

      await service.downloadAndPrepareGist(
        'session-123',
        mockSandbox,
        'https://gist.githubusercontent.com/user/id/raw'
      );

      expect(mockRunCommand).toHaveBeenCalledWith('curl', [
        '-fsSL',
        'https://gist.githubusercontent.com/user/id/raw',
        '-o',
        'run.sh',
      ]);
      expect(mockRunCommand).toHaveBeenCalledWith('chmod', ['+x', 'run.sh']);
      expect(addLog).toHaveBeenCalledWith({
        sessionId: 'session-123',
        level: 'info',
        message: 'Downloading script from Gist...',
      });
      expect(addLog).toHaveBeenCalledWith({
        sessionId: 'session-123',
        level: 'info',
        message: 'Script downloaded, starting execution...',
      });
    });

    it('should throw error when download fails', async () => {
      const service = new SandboxFileService();

      const mockStderr = vi.fn().mockResolvedValue('Download failed');
      const mockRunCommand = vi.fn().mockResolvedValue({
        exitCode: 1,
        stderr: mockStderr,
      });

      const mockSandbox = {
        runCommand: mockRunCommand,
      } as unknown as Sandbox;

      await expect(
        service.downloadAndPrepareGist(
          'session-123',
          mockSandbox,
          'https://gist.githubusercontent.com/user/id/raw'
        )
      ).rejects.toThrow('Failed to download script: Download failed');
    });
  });

  describe('prepareEnvFile', () => {
    it('should write /vercel/sandbox/.env.local when API keys are present', async () => {
      const service = new SandboxFileService();
      const { addLog } = await import('@/lib/db/queries');

      const mockWriteFiles = vi.fn().mockResolvedValue(undefined);
      const mockSandbox = {
        writeFiles: mockWriteFiles,
      } as unknown as Sandbox;

      await service.prepareEnvFile('session-123', mockSandbox, {
        ANTHROPIC_API_KEY: 'sk-ant-xxx',
        GITHUB_TOKEN: 'ghp_xxx',
      });

      expect(mockWriteFiles).toHaveBeenCalledWith([
        {
          path: '/vercel/sandbox/.env.local',
          content: expect.any(Buffer),
        },
      ]);
      const content = (mockWriteFiles.mock.calls[0][0][0] as { content: Buffer }).content.toString(
        'utf-8'
      );
      expect(content).toContain('ANTHROPIC_API_KEY=sk-ant-xxx');
      expect(content).toContain('GITHUB_TOKEN=ghp_xxx');
      expect(addLog).toHaveBeenCalledWith({
        sessionId: 'session-123',
        level: 'info',
        message: 'Created /vercel/sandbox/.env.local for Gist workflow',
      });
    });

    it('should skip writing when no API keys in env', async () => {
      const service = new SandboxFileService();
      const { addLog } = await import('@/lib/db/queries');

      const mockWriteFiles = vi.fn().mockResolvedValue(undefined);
      const mockSandbox = {
        writeFiles: mockWriteFiles,
      } as unknown as Sandbox;

      await service.prepareEnvFile('session-123', mockSandbox, {
        GIST_URL: 'https://gist.example/run.sh',
      });

      expect(mockWriteFiles).not.toHaveBeenCalled();
      expect(addLog).toHaveBeenCalledWith({
        sessionId: 'session-123',
        level: 'debug',
        message: 'No AI API keys in env; skipping .env.local creation',
      });
    });
  });

  describe('writeFiles', () => {
    it('should write files and log', async () => {
      const service = new SandboxFileService();
      const { addLog } = await import('@/lib/db/queries');

      const mockWriteFiles = vi.fn().mockResolvedValue(undefined);
      const mockSandbox = {
        writeFiles: mockWriteFiles,
      } as unknown as Sandbox;

      const files = [
        { path: '/tmp/file1.txt', content: Buffer.from('content1') },
        { path: '/tmp/file2.txt', content: Buffer.from('content2') },
      ];

      await service.writeFiles('session-123', mockSandbox, files);

      expect(mockWriteFiles).toHaveBeenCalledWith(files);
      expect(addLog).toHaveBeenCalledWith({
        sessionId: 'session-123',
        level: 'info',
        message: 'Wrote 2 file(s) to sandbox.',
      });
    });
  });

  describe('readFile', () => {
    it('should read file from sandbox', async () => {
      const service = new SandboxFileService();

      const buffer = Buffer.from('file content');
      const mockReadFileToBuffer = vi.fn().mockResolvedValue(buffer);
      const mockSandbox = {
        readFileToBuffer: mockReadFileToBuffer,
      } as unknown as Sandbox;

      const result = await service.readFile(mockSandbox, '/tmp/test.txt');

      expect(mockReadFileToBuffer).toHaveBeenCalledWith({ path: '/tmp/test.txt' });
      expect(result).toBe(buffer);
    });

    it('should return null for non-existent files', async () => {
      const service = new SandboxFileService();

      const mockReadFileToBuffer = vi.fn().mockResolvedValue(null);
      const mockSandbox = {
        readFileToBuffer: mockReadFileToBuffer,
      } as unknown as Sandbox;

      const result = await service.readFile(mockSandbox, '/tmp/missing.txt');

      expect(result).toBeNull();
    });
  });
});
