import { describe, expect, it } from 'vitest';
import { extractPrUrl, extractRepoSlugFromPrUrl, validatePrUrl } from './pr-detector';

describe('extractPrUrl', () => {
  it('should extract standard GitHub PR URL', () => {
    const logMessage = 'Created PR at https://github.com/owner/repo/pull/123';
    const result = extractPrUrl(logMessage);
    expect(result).toBe('https://github.com/owner/repo/pull/123');
  });

  it('should extract PR URL with hyphens in owner', () => {
    const logMessage = 'PR: https://github.com/my-org/repo/pull/456';
    const result = extractPrUrl(logMessage);
    expect(result).toBe('https://github.com/my-org/repo/pull/456');
  });

  it('should extract PR URL with dots in repo name', () => {
    const logMessage = 'PR: https://github.com/owner/my.repo/pull/789';
    const result = extractPrUrl(logMessage);
    expect(result).toBe('https://github.com/owner/my.repo/pull/789');
  });

  it('should extract PR URL from markdown link', () => {
    const logMessage = '[PR #123](https://github.com/owner/repo/pull/123) created';
    const result = extractPrUrl(logMessage);
    expect(result).toBe('https://github.com/owner/repo/pull/123');
  });

  it('should return null for non-GitHub URL', () => {
    const logMessage = 'PR at https://gitlab.com/owner/repo/pull/123';
    const result = extractPrUrl(logMessage);
    expect(result).toBeNull();
  });

  it('should return null for GitHub repo URL without PR', () => {
    const logMessage = 'Repo: https://github.com/owner/repo';
    const result = extractPrUrl(logMessage);
    expect(result).toBeNull();
  });

  it('should return null for GitHub issues URL', () => {
    const logMessage = 'Issue: https://github.com/owner/repo/issues/123';
    const result = extractPrUrl(logMessage);
    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = extractPrUrl('');
    expect(result).toBeNull();
  });

  it('should return null for string without URL', () => {
    const logMessage = 'Just a plain log message with no URLs';
    const result = extractPrUrl(logMessage);
    expect(result).toBeNull();
  });

  it('should extract first PR URL when multiple exist', () => {
    const logMessage =
      'PRs: https://github.com/owner/repo/pull/123 and https://github.com/owner/repo/pull/456';
    const result = extractPrUrl(logMessage);
    expect(result).toBe('https://github.com/owner/repo/pull/123');
  });

  it('should handle PR URL with underscores in owner', () => {
    const logMessage = 'PR: https://github.com/my_org/repo/pull/123';
    const result = extractPrUrl(logMessage);
    expect(result).toBe('https://github.com/my_org/repo/pull/123');
  });

  it('should handle PR URL with numbers in repo name', () => {
    const logMessage = 'PR: https://github.com/owner/repo123/pull/456';
    const result = extractPrUrl(logMessage);
    expect(result).toBe('https://github.com/owner/repo123/pull/456');
  });

  it('should handle large PR numbers', () => {
    const logMessage = 'PR: https://github.com/owner/repo/pull/999999';
    const result = extractPrUrl(logMessage);
    expect(result).toBe('https://github.com/owner/repo/pull/999999');
  });
});

describe('validatePrUrl', () => {
  it('should return true when PR URL matches repo slug', () => {
    const prUrl = 'https://github.com/owner/repo/pull/123';
    const repoSlug = 'owner/repo';
    expect(validatePrUrl(prUrl, repoSlug)).toBe(true);
  });

  it('should return false when PR URL does not match repo slug', () => {
    const prUrl = 'https://github.com/other/repo/pull/123';
    const repoSlug = 'owner/repo';
    expect(validatePrUrl(prUrl, repoSlug)).toBe(false);
  });

  it('should return false when owner does not match', () => {
    const prUrl = 'https://github.com/wrong-owner/repo/pull/123';
    const repoSlug = 'owner/repo';
    expect(validatePrUrl(prUrl, repoSlug)).toBe(false);
  });

  it('should return false when repo does not match', () => {
    const prUrl = 'https://github.com/owner/wrong-repo/pull/123';
    const repoSlug = 'owner/repo';
    expect(validatePrUrl(prUrl, repoSlug)).toBe(false);
  });

  it('should handle repo with dots in name', () => {
    const prUrl = 'https://github.com/owner/my.repo/pull/123';
    const repoSlug = 'owner/my.repo';
    expect(validatePrUrl(prUrl, repoSlug)).toBe(true);
  });

  it('should return false for invalid PR URL format', () => {
    const prUrl = 'not-a-url';
    const repoSlug = 'owner/repo';
    expect(validatePrUrl(prUrl, repoSlug)).toBe(false);
  });

  it('should return false for non-GitHub URL', () => {
    const prUrl = 'https://gitlab.com/owner/repo/pull/123';
    const repoSlug = 'owner/repo';
    expect(validatePrUrl(prUrl, repoSlug)).toBe(false);
  });

  it('should handle repo slug with hyphens', () => {
    const prUrl = 'https://github.com/my-org/my-repo/pull/123';
    const repoSlug = 'my-org/my-repo';
    expect(validatePrUrl(prUrl, repoSlug)).toBe(true);
  });
});

describe('extractRepoSlugFromPrUrl', () => {
  it('should extract repo slug from valid PR URL', () => {
    const prUrl = 'https://github.com/owner/repo/pull/123';
    const result = extractRepoSlugFromPrUrl(prUrl);
    expect(result).toBe('owner/repo');
  });

  it('should extract repo slug with hyphens', () => {
    const prUrl = 'https://github.com/my-org/my-repo/pull/456';
    const result = extractRepoSlugFromPrUrl(prUrl);
    expect(result).toBe('my-org/my-repo');
  });

  it('should extract repo slug with dots', () => {
    const prUrl = 'https://github.com/owner/my.repo/pull/789';
    const result = extractRepoSlugFromPrUrl(prUrl);
    expect(result).toBe('owner/my.repo');
  });

  it('should return null for non-GitHub URL', () => {
    const prUrl = 'https://gitlab.com/owner/repo/pull/123';
    const result = extractRepoSlugFromPrUrl(prUrl);
    expect(result).toBeNull();
  });

  it('should return null for invalid PR URL format', () => {
    const prUrl = 'not-a-url';
    const result = extractRepoSlugFromPrUrl(prUrl);
    expect(result).toBeNull();
  });

  it('should return null for GitHub URL without PR path', () => {
    const prUrl = 'https://github.com/owner/repo';
    const result = extractRepoSlugFromPrUrl(prUrl);
    expect(result).toBeNull();
  });

  it('should return null for GitHub issues URL', () => {
    const prUrl = 'https://github.com/owner/repo/issues/123';
    const result = extractRepoSlugFromPrUrl(prUrl);
    expect(result).toBeNull();
  });

  it('should handle URL with trailing slash', () => {
    const prUrl = 'https://github.com/owner/repo/pull/123/';
    const result = extractRepoSlugFromPrUrl(prUrl);
    expect(result).toBe('owner/repo');
  });
});
