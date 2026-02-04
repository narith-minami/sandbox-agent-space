import { NextResponse } from 'next/server';
import { validateGitHubToken } from '@/lib/sandbox/github-validation';
import type { ApiError } from '@/types/sandbox';

export interface ValidateTokenResponse {
  valid: boolean;
  login?: string;
  scopes?: string[];
  error?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json<ApiError>(
        {
          error: 'Token is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const result = await validateGitHubToken(token);

    return NextResponse.json<ValidateTokenResponse>({
      valid: result.valid,
      login: result.login,
      scopes: result.scopes,
      error: result.error,
    });
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to validate token',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
