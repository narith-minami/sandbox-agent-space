/**
 * GitHub Validation Utilities
 *
 * Provides functions to validate GitHub token validity and repository access
 * before attempting to create a sandbox.
 */

export interface GitHubTokenValidationResult {
  valid: boolean;
  login?: string;
  scopes?: string[];
  error?: string;
}

export interface GitHubRepoAccessResult {
  accessible: boolean;
  exists: boolean;
  isPrivate?: boolean;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
  error?: string;
}

/**
 * Validate GitHub token by fetching user info
 */
export async function validateGitHubToken(token: string): Promise<GitHubTokenValidationResult> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Sandbox-Agent-Space',
      },
    });

    if (response.status === 401) {
      return {
        valid: false,
        error: 'GitHub token is invalid or expired',
      };
    }

    if (!response.ok) {
      return {
        valid: false,
        error: `GitHub API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    const scopesHeader = response.headers.get('x-oauth-scopes') || '';
    const scopes = scopesHeader ? scopesHeader.split(', ').filter(Boolean) : [];

    return {
      valid: true,
      login: data.login,
      scopes,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate token: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if token has access to a specific repository
 */
export async function validateRepoAccess(
  token: string,
  owner: string,
  repo: string
): Promise<GitHubRepoAccessResult> {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Sandbox-Agent-Space',
      },
    });

    if (response.status === 404) {
      return {
        accessible: false,
        exists: false,
        error: `Repository not found: ${owner}/${repo}`,
      };
    }

    if (response.status === 401) {
      return {
        accessible: false,
        exists: true,
        error: 'GitHub token does not have access to this repository',
      };
    }

    if (response.status === 403) {
      return {
        accessible: false,
        exists: true,
        error: 'GitHub token does not have sufficient permissions for this repository',
      };
    }

    if (!response.ok) {
      return {
        accessible: false,
        exists: true,
        error: `GitHub API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();

    return {
      accessible: true,
      exists: true,
      isPrivate: data.private,
      permissions: data.permissions || { admin: false, push: false, pull: true },
    };
  } catch (error) {
    return {
      accessible: false,
      exists: true,
      error: `Failed to check repository access: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Extract owner and repo from GitHub URL
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'github.com') {
      return null;
    }

    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) {
      return null;
    }

    return {
      owner: pathParts[0],
      repo: pathParts[1].replace(/\.git$/, ''),
    };
  } catch {
    return null;
  }
}

/**
 * Comprehensive validation before sandbox creation
 */
export async function validateGitHubAccess(
  token: string,
  repoUrl: string
): Promise<
  | { success: true; login: string; repo: { owner: string; repo: string } }
  | { success: false; code: string; message: string; details?: Record<string, unknown> }
> {
  // Step 1: Validate token
  const tokenValidation = await validateGitHubToken(token);
  if (!tokenValidation.valid) {
    return {
      success: false,
      code: 'GITHUB_TOKEN_INVALID',
      message: tokenValidation.error || 'GitHub token validation failed',
    };
  }

  // Step 2: Parse repository URL
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return {
      success: false,
      code: 'INVALID_REPO_URL',
      message: 'Invalid GitHub repository URL format',
    };
  }

  // Step 3: Check repository access
  const accessValidation = await validateRepoAccess(token, parsed.owner, parsed.repo);
  if (!accessValidation.accessible) {
    return {
      success: false,
      code: 'GITHUB_REPO_ACCESS_DENIED',
      message: accessValidation.error || 'Repository access denied',
      details: {
        repo: `${parsed.owner}/${parsed.repo}`,
        exists: accessValidation.exists,
      },
    };
  }

  // Step 4: Verify pull permission (minimum required for clone)
  if (!accessValidation.permissions?.pull) {
    return {
      success: false,
      code: 'GITHUB_INSUFFICIENT_PERMISSIONS',
      message: 'GitHub token does not have read permission for this repository',
      details: {
        repo: `${parsed.owner}/${parsed.repo}`,
        required: 'pull',
        granted: accessValidation.permissions,
      },
    };
  }

  return {
    success: true,
    login: tokenValidation.login || '',
    repo: parsed,
  };
}
