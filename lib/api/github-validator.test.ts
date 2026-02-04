import { describe, expect, it, vi } from 'vitest';
import { GitHubValidator } from './github-validator';

// Mock dependencies
vi.mock('@/lib/sandbox/github-validation', () => ({
  validateGitHubAccess: vi.fn(),
}));

describe('GitHubValidator', () => {
  describe('validateRepoAccess', () => {
    it('should skip validation when skipForSnapshot is true', async () => {
      const validator = new GitHubValidator();
      const { validateGitHubAccess } = await import('@/lib/sandbox/github-validation');

      const result = await validator.validateRepoAccess(
        'token',
        'https://github.com/owner/repo',
        true
      );

      expect(result).toEqual({ success: true });
      expect(validateGitHubAccess).not.toHaveBeenCalled();
    });

    it('should validate access when skipForSnapshot is false', async () => {
      const validator = new GitHubValidator();
      const { validateGitHubAccess } = await import('@/lib/sandbox/github-validation');

      vi.mocked(validateGitHubAccess).mockResolvedValue({
        success: true,
        login: 'testuser',
        repo: { owner: 'owner', repo: 'repo' },
      });

      const result = await validator.validateRepoAccess('token', 'https://github.com/owner/repo');

      expect(result).toEqual({ success: true });
      expect(validateGitHubAccess).toHaveBeenCalledWith('token', 'https://github.com/owner/repo');
    });

    it('should return error response when validation fails', async () => {
      const validator = new GitHubValidator();
      const { validateGitHubAccess } = await import('@/lib/sandbox/github-validation');

      vi.mocked(validateGitHubAccess).mockResolvedValue({
        success: false,
        message: 'Repository not found',
        code: 'REPO_NOT_FOUND',
        details: { repo: 'owner/repo' },
      });

      const result = await validator.validateRepoAccess('token', 'https://github.com/owner/repo');

      expect(result.success).toBe(false);
      if (!result.success) {
        const json = await result.response.json();
        expect(json).toEqual({
          error: 'Repository not found',
          code: 'REPO_NOT_FOUND',
          details: { repo: 'owner/repo' },
        });
        expect(result.response.status).toBe(400);
      }
    });

    it('should default skipForSnapshot to false', async () => {
      const validator = new GitHubValidator();
      const { validateGitHubAccess } = await import('@/lib/sandbox/github-validation');

      vi.mocked(validateGitHubAccess).mockResolvedValue({
        success: true,
        login: 'testuser',
        repo: { owner: 'owner', repo: 'repo' },
      });

      await validator.validateRepoAccess('token', 'https://github.com/owner/repo');

      expect(validateGitHubAccess).toHaveBeenCalled();
    });
  });
});
