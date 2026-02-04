import { NextResponse } from 'next/server';
import { AuthenticationValidator } from '@/lib/api/auth-validator';
import { GitHubValidator } from '@/lib/api/github-validator';
import { SandboxConfigBuilder } from '@/lib/api/sandbox-config-builder';
import { createSession } from '@/lib/db/queries';
import { checkRateLimit, getClientIp, getRateLimitHeaders } from '@/lib/rate-limit';
import { getSandboxManager } from '@/lib/sandbox/manager';
import { safeParseSandboxConfig } from '@/lib/validators/config';
import type { ApiError, CreateSandboxResponse } from '@/types/sandbox';

export async function POST(request: Request) {
  try {
    // 1. Authentication validation
    const authValidator = new AuthenticationValidator();
    const authResult = await authValidator.validate();
    if (!authResult.success) {
      return authResult.response;
    }

    // 2. Rate limiting
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

    // 3. Parse and validate request body
    const body = await request.json();
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

    // 4. Build sandbox configuration
    const configBuilder = new SandboxConfigBuilder();
    const buildResult = configBuilder.build(config, authResult.githubToken);
    if (!buildResult.success) {
      return buildResult.response;
    }

    // 5. Validate GitHub access (if using repository)
    if (config.repoUrl) {
      const githubValidator = new GitHubValidator();
      const githubResult = await githubValidator.validateRepoAccess(
        authResult.githubToken,
        config.repoUrl,
        !!config.snapshotId
      );
      if (!githubResult.success) {
        return githubResult.response;
      }
    }

    // 6. Create session in database
    const session = await createSession(config, buildResult.config.runtime, undefined, config.memo);

    // 7. Start sandbox
    const sandboxManager = getSandboxManager();
    const result = await sandboxManager.createSandbox(session.id, buildResult.config);

    // 8. Return success response
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
          'X-Auth-Method': authResult.authMethod,
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
