/**
 * PR URL Detection Utility
 *
 * Extracts GitHub Pull Request URLs from sandbox execution logs
 * and validates them against the configured repository.
 */

// Regular expressions to match different PR URL patterns
const PR_URL_PATTERNS = [
  // Standard GitHub PR URL: https://github.com/owner/repo/pull/123
  /https:\/\/github\.com\/([\w-]+)\/([\w.-]+)\/pull\/(\d+)/g,

  // GitHub PR URL in markdown format: [PR #123](https://github.com/owner/repo/pull/123)
  /\[.*?\]\(https:\/\/github\.com\/([\w-]+)\/([\w.-]+)\/pull\/(\d+)\)/g,

  // GitHub PR URL in text: https://github.com/owner/repo/pull/123
  /https:\/\/github\.com\/([\w-]+)\/([\w.-]+)\/pull\/(\d+)/g,
];

/**
 * Extracts the first GitHub PR URL found in a log message
 * @param logMessage - The log message to search for PR URLs
 * @returns The first detected PR URL or null if none found
 */
export function extractPrUrl(logMessage: string): string | null {
  for (const pattern of PR_URL_PATTERNS) {
    // Reset lastIndex to ensure global regex works correctly
    pattern.lastIndex = 0;

    const match = pattern.exec(logMessage);
    if (match) {
      // Reconstruct the full URL from the regex match
      const [, owner, repo, prNumber] = match;
      return `https://github.com/${owner}/${repo}/pull/${prNumber}`;
    }
  }

  return null;
}

/**
 * Validates if a PR URL matches the configured repository
 * @param prUrl - The PR URL to validate
 * @param repoSlug - The expected repository slug (owner/repo format)
 * @returns true if the URL matches the repository, false otherwise
 */
export function validatePrUrl(prUrl: string, repoSlug: string): boolean {
  try {
    const url = new URL(prUrl);
    if (url.hostname !== 'github.com') {
      return false;
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length !== 4 || pathParts[2] !== 'pull') {
      return false;
    }

    const urlRepoSlug = `${pathParts[0]}/${pathParts[1]}`;
    return urlRepoSlug === repoSlug;
  } catch {
    return false;
  }
}

/**
 * Extracts repository slug from a PR URL
 * @param prUrl - The PR URL to extract from
 * @returns The repository slug (owner/repo) or null if invalid
 */
export function extractRepoSlugFromPrUrl(prUrl: string): string | null {
  try {
    const url = new URL(prUrl);
    if (url.hostname !== 'github.com') {
      return null;
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length !== 4 || pathParts[2] !== 'pull') {
      return null;
    }

    return `${pathParts[0]}/${pathParts[1]}`;
  } catch {
    return null;
  }
}