import { NextResponse } from 'next/server';
import { getGitHubSessionForApi } from '@/lib/auth/get-github-session';
import { isGitHubAuthEnabled } from '@/lib/auth/github';

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubBranchResponse {
  name: string;
  sha: string;
  protected: boolean;
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

interface RouteParams {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

export async function GET(request: Request, { params }: RouteParams): Promise<NextResponse> {
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
        loginUrl: `/login?next=${encodeURIComponent('/')}`,
      },
      { status: 401 }
    );
  }

  const { session } = githubSessionResult;

  try {
    const { owner, repo } = await params;

    // Fetch branches from GitHub API
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const perPage = url.searchParams.get('per_page') || '100';

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=${perPage}&page=${page}`,
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

      let errorMessage = 'Failed to fetch branches';
      if (response.status === 401) {
        errorMessage = 'GitHub authentication token is invalid';
      } else if (response.status === 403) {
        errorMessage = 'Access forbidden - check repository permissions';
      } else if (response.status === 404) {
        errorMessage = `Repository ${owner}/${repo} not found`;
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

    const branches = (await response.json()) as GitHubBranch[];

    // Transform to our response format
    const transformedBranches: GitHubBranchResponse[] = branches.map((branch) => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected,
    }));

    // Add rate limit info to response headers
    const headers = new Headers();
    if (rateLimitRemaining) {
      headers.set('X-RateLimit-Remaining', rateLimitRemaining);
    }
    if (rateLimitReset) {
      headers.set('X-RateLimit-Reset', rateLimitReset);
    }

    return NextResponse.json(transformedBranches, { headers });
  } catch (error) {
    console.error('Failed to fetch branches:', error);
    return NextResponse.json<GitHubApiError>(
      {
        error: 'Internal error while fetching branches',
        code: 'INTERNAL_ERROR',
        details: { message: error instanceof Error ? error.message : 'Unknown error' },
      },
      { status: 500 }
    );
  }
}
