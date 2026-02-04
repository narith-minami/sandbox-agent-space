import { NextResponse } from 'next/server';
import { validateGitHubAccess } from '@/lib/sandbox/github-validation';
import type { ApiError } from '@/types/sandbox';

export interface GitHubValidationResult {
  success: true;
}

export interface GitHubValidationError {
  success: false;
  response: NextResponse<ApiError>;
}

/**
 * GitHubValidator - Validates GitHub access for repositories
 *
 * Responsibilities:
 * - Validate token has access to repository
 * - Return validation result or error response
 */
export class GitHubValidator {
  /**
   * Validate GitHub access to repository
   */
  async validateRepoAccess(
    githubToken: string,
    repoUrl: string,
    skipForSnapshot: boolean = false
  ): Promise<GitHubValidationResult | GitHubValidationError> {
    // Skip validation if creating from snapshot
    if (skipForSnapshot) {
      return { success: true };
    }

    console.log(`[GitHub Validation] Validating access to ${repoUrl}...`);
    const gitHubValidation = await validateGitHubAccess(githubToken, repoUrl);

    if (!gitHubValidation.success) {
      console.log(`[GitHub Validation] Failed: ${gitHubValidation.message}`);
      return {
        success: false,
        response: NextResponse.json<ApiError>(
          {
            error: gitHubValidation.message,
            code: gitHubValidation.code,
            details: gitHubValidation.details,
          },
          { status: 400 }
        ),
      };
    }

    console.log(
      `[GitHub Validation] Success: ${gitHubValidation.login} has access to ${gitHubValidation.repo.owner}/${gitHubValidation.repo.repo}`
    );

    return { success: true };
  }
}
