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

function tryExtractPrUrlWithPattern(logMessage: string, pattern: RegExp): string | null {
  pattern.lastIndex = 0;
  const match = pattern.exec(logMessage);
  if (!match) return null;

  const [, owner, repo, prNumber] = match;
  return `https://github.com/${owner}/${repo}/pull/${prNumber}`;
}

/**
 * Extracts the first GitHub PR URL found in a log message
 * @param logMessage - The log message to search for PR URLs
 * @returns The first detected PR URL or null if none found
 */
export function extractPrUrl(logMessage: string): string | null {
  for (const pattern of PR_URL_PATTERNS) {
    const result = tryExtractPrUrlWithPattern(logMessage, pattern);
    if (result) return result;
  }
  return null;
}

interface ParsedPrUrl {
  owner: string;
  repo: string;
  prNumber: string;
}

function parsePrUrl(prUrl: string): ParsedPrUrl | null {
  try {
    const url = new URL(prUrl);
    if (url.hostname !== 'github.com') return null;

    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length !== 4 || pathParts[2] !== 'pull') return null;

    return {
      owner: pathParts[0],
      repo: pathParts[1],
      prNumber: pathParts[3],
    };
  } catch {
    return null;
  }
}

/**
 * Validates if a PR URL matches the configured repository
 * @param prUrl - The PR URL to validate
 * @param repoSlug - The expected repository slug (owner/repo format)
 * @returns true if the URL matches the repository, false otherwise
 */
export function validatePrUrl(prUrl: string, repoSlug: string): boolean {
  const parsed = parsePrUrl(prUrl);
  if (!parsed) return false;
  return `${parsed.owner}/${parsed.repo}` === repoSlug;
}

/**
 * Extracts repository slug from a PR URL
 * @param prUrl - The PR URL to extract from
 * @returns The repository slug (owner/repo) or null if invalid
 */
export function extractRepoSlugFromPrUrl(prUrl: string): string | null {
  const parsed = parsePrUrl(prUrl);
  if (!parsed) return null;
  return `${parsed.owner}/${parsed.repo}`;
}
