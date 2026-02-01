import { NextResponse } from 'next/server';
import { createSession } from '@/lib/db/queries';
import { getSandboxManager } from '@/lib/sandbox/manager';
import { safeParseSandboxConfig } from '@/lib/validators/config';
import { checkRateLimit, getClientIp, getRateLimitHeaders } from '@/lib/rate-limit';
import { isAuthenticationAvailable, getAuthMethod } from '@/lib/sandbox/auth';
import type { CreateSandboxResponse, ApiError } from '@/types/sandbox';

export async function POST(request: Request) {
  try {
    // Check if Vercel authentication is available
    if (!isAuthenticationAvailable()) {
      return NextResponse.json<ApiError>(
        {
          error: 'Vercel Sandbox authentication not configured',
          code: 'AUTH_NOT_CONFIGURED',
          details: {
            message: 'For local development, run "vercel link" and "vercel env pull". For production on Vercel, authentication is automatic.',
          },
        },
        { status: 503 }
      );
    }

    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(clientIp);
    
    if (!rateLimitResult.success) {
      return NextResponse.json<ApiError>(
        {
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          details: { retryAfter: rateLimitResult.reset },
        },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate configuration
    const validationResult = safeParseSandboxConfig(body);
    
    if (!validationResult.success) {
      return NextResponse.json<ApiError>(
        {
          error: 'Invalid configuration',
          code: 'VALIDATION_ERROR',
          details: { errors: validationResult.error.flatten().fieldErrors },
        },
        { status: 400 }
      );
    }

    const config = validationResult.data;
    const runtime = config.runtime || 'node24';

    // Use common config as fallback for empty values
    const githubToken = config.githubToken || process.env.COMMON_GITHUB_TOKEN || '';
    const opencodeAuthJsonB64 = config.opencodeAuthJsonB64 || process.env.COMMON_OPENCODE_AUTH_JSON_B64 || '';
    const gistUrl = config.gistUrl || process.env.COMMON_GIST_URL || '';

    // Validate that we have required values (either from form or common config)
    if (!githubToken) {
      return NextResponse.json<ApiError>(
        {
          error: 'GitHub token is required',
          code: 'VALIDATION_ERROR',
          details: { message: 'Please provide a GitHub token or set COMMON_GITHUB_TOKEN environment variable' },
        },
        { status: 400 }
      );
    }

    if (!opencodeAuthJsonB64) {
      return NextResponse.json<ApiError>(
        {
          error: 'OpenCode auth JSON is required',
          code: 'VALIDATION_ERROR',
          details: { message: 'Please provide OpenCode auth JSON or set COMMON_OPENCODE_AUTH_JSON_B64 environment variable' },
        },
        { status: 400 }
      );
    }

    if (!gistUrl && !config.snapshotId) {
      return NextResponse.json<ApiError>(
        {
          error: 'Gist URL is required',
          code: 'VALIDATION_ERROR',
          details: { message: 'Please provide a Gist URL or set COMMON_GIST_URL environment variable' },
        },
        { status: 400 }
      );
    }

    // Create session in database with runtime and memo (prUrl will be auto-detected from logs)
    const session = await createSession(config, runtime, undefined, config.memo);

    // Start sandbox using Vercel Sandbox SDK
    const sandboxManager = getSandboxManager();
    const result = await sandboxManager.createSandbox(session.id, {
      env: {
        GITHUB_TOKEN: githubToken,
        OPENCODE_AUTH_JSON_B64: opencodeAuthJsonB64,
        GIST_URL: gistUrl,
        REPO_URL: config.repoUrl,
        REPO_SLUG: config.repoSlug,
        FRONT_DIR: config.frontDir,
        PLAN_FILE: config.planFile,
        ENABLE_CODE_REVIEW: config.enableCodeReview ? '1' : '0',
      },
      command: `
        curl -fsSL "${gistUrl}" -o run.sh
        chmod +x run.sh
        ./run.sh
      `,
      runtime,
      snapshotId: config.snapshotId,
    });

    return NextResponse.json<CreateSandboxResponse>(
      {
        sessionId: session.id,
        sandboxId: result.sandboxId,
        runtime: result.runtime,
      },
      { 
        status: 201,
        headers: {
          ...getRateLimitHeaders(rateLimitResult),
          'X-Auth-Method': getAuthMethod(),
        },
      }
    );
  } catch (error) {
    console.error('Failed to create sandbox:', error);
    
    // Check if it's an authentication error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('authentication') || errorMessage.includes('OIDC')) {
      return NextResponse.json<ApiError>(
        {
          error: 'Authentication failed',
          code: 'AUTH_FAILED',
          details: { message: errorMessage },
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to create sandbox',
        code: 'INTERNAL_ERROR',
        details: { message: errorMessage },
      },
      { status: 500 }
    );
  }
}
