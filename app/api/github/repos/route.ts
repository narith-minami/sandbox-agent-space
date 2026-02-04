import { NextResponse } from 'next/server';
import { getGitHubSessionForApi } from '@/lib/auth/get-github-session';
import { isGitHubAuthEnabled } from '@/lib/auth/github';

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
  description: string | null;
  default_branch: string;
  updated_at: string;
}

export interface GitHubRepoResponse {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  isPrivate: boolean;
  description: string | null;
  defaultBranch: string;
  htmlUrl: string;
  avatarUrl: string;
  updatedAt: string;
}

interface GitHubApiError {
  error: string;
  code?: string;
  details?: {
    message?: string;
    retryAfter?: string;
    resetAt?: string;
  };
  loginUrl?: string;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isGitHubAuthEnabled()) {
    return NextResponse.json<GitHubApiError>(
      { error: 'GitHub authentication is not enabled' },
      { status: 404 }
    );
  }

  // Get GitHub session
  const githubSessionResult = await getGitHubSessionForApi();
  if (!githubSessionResult) {
    return NextResponse.json<GitHubApiError>(
      {
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        loginUrl: `/login?next=${encodeURIComponent('/sandbox')}`,
      },
      { status: 401 }
    );
  }

  const { session } = githubSessionResult;

  try {
    // Fetch repositories from GitHub API
    // Get all repos (owned, collaborator, organization member)
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const perPage = url.searchParams.get('per_page') || '100';

    const response = await fetch(
      `https://api.github.com/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=${perPage}&page=${page}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${session.accessToken}`,
          'User-Agent': 'sandbox-agent-space',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    // Check for rate limiting
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');

    if (!response.ok) {
      // Handle rate limiting
      if (response.status === 403 && rateLimitRemaining === '0') {
        const resetDate = rateLimitReset
          ? new Date(Number.parseInt(rateLimitReset, 10) * 1000).toISOString()
          : undefined;

        return NextResponse.json<GitHubApiError>(
          {
            error: 'GitHub API rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            details: {
              message: 'Please wait before making more requests',
              resetAt: resetDate,
            },
          },
          { status: 429 }
        );
      }

      // Handle other errors
      const errorText = await response.text();
      console.error('GitHub API error:', response.status, errorText);

      let errorMessage = 'Failed to fetch repositories';
      if (response.status === 401) {
        errorMessage = 'GitHub authentication token is invalid';
      } else if (response.status === 403) {
        errorMessage = 'Access forbidden - check repository permissions';
      } else if (response.status >= 500) {
        errorMessage = 'GitHub API is temporarily unavailable';
      }

      return NextResponse.json<GitHubApiError>(
        {
          error: errorMessage,
          code: 'GITHUB_API_ERROR',
          details: { message: errorText },
        },
        { status: response.status }
      );
    }

    const repos = (await response.json()) as GitHubRepository[];

    // Transform to our response format
    const transformedRepos: GitHubRepoResponse[] = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      isPrivate: repo.private,
      description: repo.description,
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
      avatarUrl: repo.owner.avatar_url,
      updatedAt: repo.updated_at,
    }));

    // Add rate limit info to response headers
    const headers = new Headers();
    if (rateLimitRemaining) {
      headers.set('X-RateLimit-Remaining', rateLimitRemaining);
    }
    if (rateLimitReset) {
      headers.set('X-RateLimit-Reset', rateLimitReset);
    }

    return NextResponse.json(transformedRepos, { headers });
  } catch (error) {
    console.error('Failed to fetch repositories:', error);
    return NextResponse.json<GitHubApiError>(
      {
        error: 'Internal error while fetching repositories',
        code: 'INTERNAL_ERROR',
        details: { message: error instanceof Error ? error.message : 'Unknown error' },
      },
      { status: 500 }
    );
  }
}
