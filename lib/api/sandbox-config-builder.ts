import { NextResponse } from 'next/server';
import type { SandboxRuntime } from '@/lib/sandbox/auth';
import type { ValidatedSandboxConfig } from '@/lib/validators/config';
import type { ApiError } from '@/types/sandbox';

export interface SandboxEnvironment {
  GITHUB_TOKEN: string;
  OPENCODE_AUTH_JSON_B64: string;
  GIST_URL: string;
  REPO_URL: string;
  REPO_SLUG: string;
  BASE_BRANCH: string;
  FRONT_DIR: string;
  PLAN_FILE: string;
  ENABLE_CODE_REVIEW: string;
  OPENCODE_MODEL_PROVIDER: string;
  OPENCODE_MODEL_ID: string;
  /** Gist の run-opencode-with-snapshot.sh が要求。スナップショット起動時に必須 */
  SNAPSHOT_ID?: string;
  /** Gist の run.sh が要求。planSource=text のときのプラン本文 */
  PLAN_TEXT?: string;
  [key: string]: string | undefined;
}

export interface SandboxCommandConfig {
  env: SandboxEnvironment;
  command: string;
  runtime: SandboxRuntime;
  snapshotId?: string;
  planText?: string;
  planFilePath: string;
}

export interface ConfigBuildResult {
  success: true;
  config: SandboxCommandConfig;
}

export interface ConfigBuildError {
  success: false;
  response: NextResponse<ApiError>;
}

/**
 * SandboxConfigBuilder - Builds sandbox configuration from form input
 *
 * Responsibilities:
 * - Merge form values with environment variable fallbacks
 * - Validate required fields
 * - Build environment variables
 * - Resolve plan file paths
 * - Generate sandbox command
 */
export class SandboxConfigBuilder {
  /**
   * Build complete sandbox configuration
   */
  build(config: ValidatedSandboxConfig, githubToken: string): ConfigBuildResult | ConfigBuildError {
    // Merge with common config from env vars
    const opencodeAuthJsonB64 =
      config.opencodeAuthJsonB64 || process.env.COMMON_OPENCODE_AUTH_JSON_B64 || '';
    const gistUrl = config.gistUrl || process.env.COMMON_GIST_URL || '';

    // Validate required fields
    const validationError = this.validateRequiredFields(
      opencodeAuthJsonB64,
      gistUrl,
      config.snapshotId
    );
    if (validationError) {
      return validationError;
    }

    // Resolve plan file path
    const planFilePath = this.resolvePlanFilePath(config);

    // Build environment variables
    const env = this.buildEnvironment(
      config,
      githubToken,
      opencodeAuthJsonB64,
      gistUrl,
      planFilePath
    );

    // Build command
    const command = this.buildCommand(gistUrl);

    // Get runtime
    const runtime = config.runtime || 'node24';

    return {
      success: true,
      config: {
        env,
        command,
        runtime,
        snapshotId: config.snapshotId,
        planText: config.planSource === 'text' ? config.planText : undefined,
        planFilePath,
      },
    };
  }

  /**
   * Validate required configuration fields
   */
  private validateRequiredFields(
    opencodeAuthJsonB64: string,
    gistUrl: string,
    snapshotId?: string
  ): ConfigBuildError | null {
    if (!opencodeAuthJsonB64) {
      return {
        success: false,
        response: NextResponse.json<ApiError>(
          {
            error: 'OpenCode auth JSON is required',
            code: 'VALIDATION_ERROR',
            details: {
              message:
                'Please provide OpenCode auth JSON or set COMMON_OPENCODE_AUTH_JSON_B64 environment variable',
            },
          },
          { status: 400 }
        ),
      };
    }

    if (!gistUrl && !snapshotId) {
      return {
        success: false,
        response: NextResponse.json<ApiError>(
          {
            error: 'Gist URL is required',
            code: 'VALIDATION_ERROR',
            details: {
              message: 'Please provide a Gist URL or set COMMON_GIST_URL environment variable',
            },
          },
          { status: 400 }
        ),
      };
    }

    return null;
  }

  /**
   * Resolve plan file path based on configuration
   */
  private resolvePlanFilePath(config: ValidatedSandboxConfig): string {
    const frontDir = config.frontDir;
    const planFileName =
      config.planSource === 'text' ? 'plan.md' : config.planFile?.split('/').pop() || 'plan.md';

    // Build absolute path to plan file in sandbox
    if (frontDir) {
      return `/vercel/sandbox/${frontDir}/docs/${planFileName}`;
    }

    return `/vercel/sandbox/docs/${planFileName}`;
  }

  /**
   * Build environment variables for sandbox
   */
  private buildEnvironment(
    config: ValidatedSandboxConfig,
    githubToken: string,
    opencodeAuthJsonB64: string,
    gistUrl: string,
    planFilePath: string
  ): SandboxEnvironment {
    // Get model configuration with fallbacks
    const modelProvider =
      config.modelProvider || process.env.COMMON_MODEL_PROVIDER || 'anthropic';
    const modelId =
      config.modelId || process.env.COMMON_MODEL_ID || 'claude-3-5-sonnet-20241022';

    const env: SandboxEnvironment = {
      GITHUB_TOKEN: githubToken,
      OPENCODE_AUTH_JSON_B64: opencodeAuthJsonB64,
      GIST_URL: gistUrl,
      REPO_URL: config.repoUrl,
      REPO_SLUG: config.repoSlug,
      BASE_BRANCH: config.baseBranch || 'main',
      FRONT_DIR: config.frontDir,
      PLAN_FILE: planFilePath,
      ENABLE_CODE_REVIEW: config.enableCodeReview ? '1' : '0',
      OPENCODE_MODEL_PROVIDER: modelProvider,
      OPENCODE_MODEL_ID: modelId,
    };
    if (config.snapshotId) {
      env.SNAPSHOT_ID = config.snapshotId;
    }
    if (config.planSource === 'text' && config.planText) {
      env.PLAN_TEXT = config.planText;
    }
    return env;
  }

  /**
   * Build sandbox command
   */
  private buildCommand(gistUrl: string): string {
    return `
      curl -fsSL "${gistUrl}" -o run.sh
      chmod +x run.sh
      ./run.sh
    `;
  }
}
