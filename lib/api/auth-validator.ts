import { NextResponse } from 'next/server';
import { getGitHubSessionForApi } from '@/lib/auth/get-github-session';
import { getAuthMethod, isAuthenticationAvailable } from '@/lib/sandbox/auth';
import type { ApiError } from '@/types/sandbox';

export interface AuthValidationResult {
  success: true;
  githubToken: string;
  authMethod: string;
}

export interface AuthValidationError {
  success: false;
  response: NextResponse<ApiError>;
}

/**
 * AuthenticationValidator - Validates authentication requirements
 *
 * Responsibilities:
 * - Check GitHub authentication (session or env var)
 * - Check Vercel Sandbox authentication
 * - Return token or error response
 */
export class AuthenticationValidator {
  /**
   * Validate all authentication requirements
   */
  async validate(): Promise<AuthValidationResult | AuthValidationError> {
    // Check GitHub authentication
    const githubResult = await this.validateGitHubAuth();
    if (!githubResult.success) {
      return githubResult;
    }

    // Check Vercel authentication
    const vercelResult = this.validateVercelAuth();
    if (!vercelResult.success) {
      return vercelResult;
    }

    return {
      success: true,
      githubToken: githubResult.token,
      authMethod: getAuthMethod(),
    };
  }

  /**
   * Validate GitHub authentication
   */
  private async validateGitHubAuth(): Promise<
    { success: true; token: string } | AuthValidationError
  > {
    const githubSessionResult = await getGitHubSessionForApi();

    // Check if user is authenticated with GitHub or has env var
    if (!githubSessionResult && !process.env.COMMON_GITHUB_TOKEN) {
      return {
        success: false,
        response: NextResponse.json<ApiError>(
          {
            error: 'GitHub authentication required',
            code: 'AUTH_REQUIRED',
            details: {
              message: 'Please authenticate with GitHub to create a sandbox',
              loginUrl: `/login?next=${encodeURIComponent('/')}`,
            },
          },
          { status: 401 }
        ),
      };
    }

    const token = githubSessionResult?.session.accessToken || process.env.COMMON_GITHUB_TOKEN || '';

    return {
      success: true,
      token,
    };
  }

  /**
   * Validate Vercel Sandbox authentication
   */
  private validateVercelAuth(): { success: true } | AuthValidationError {
    if (!isAuthenticationAvailable()) {
      return {
        success: false,
        response: NextResponse.json<ApiError>(
          {
            error: 'Vercel Sandbox authentication not configured',
            code: 'AUTH_NOT_CONFIGURED',
            details: {
              message:
                'For local development, run "vercel link" and "vercel env pull". For production on Vercel, authentication is automatic.',
            },
          },
          { status: 503 }
        ),
      };
    }

    return { success: true };
  }
}
