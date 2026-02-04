import { NextResponse } from 'next/server';
import { validateGitHubAccess } from '@/lib/sandbox/github-validation';
import type { ApiError } from '@/types/sandbox';

export interface CheckRepoResponse {
  accessible: boolean;
  login?: string;
  repo?: {
    owner: string;
    repo: string;
  };
  isPrivate?: boolean;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
  error?: string;
  code?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, repoUrl } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json<ApiError>(
        {
          error: 'Token is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json<ApiError>(
        {
          error: 'Repository URL is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const result = await validateGitHubAccess(token, repoUrl);

    if (!result.success) {
      return NextResponse.json<CheckRepoResponse>(
        {
          accessible: false,
          error: result.message,
          code: result.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json<CheckRepoResponse>({
      accessible: true,
      login: result.login,
      repo: result.repo,
    });
  } catch (error) {
    console.error('Repository check error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to check repository access',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
