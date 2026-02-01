import { describe, expect, it, vi } from 'vitest';

// Mock all dependencies before importing the route
vi.mock('@/lib/db/queries', () => ({
  createSession: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  getRateLimitHeaders: vi.fn().mockReturnValue({
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '99',
  }),
}));

vi.mock('@/lib/sandbox/auth', () => ({
  getAuthMethod: vi.fn().mockReturnValue('oidc'),
  isAuthenticationAvailable: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/sandbox/manager', () => ({
  getSandboxManager: vi.fn().mockReturnValue({
    createSandbox: vi.fn().mockResolvedValue({
      sandboxId: 'sandbox-123',
      runtime: 'node24',
    }),
  }),
}));

vi.mock('@/lib/validators/config', () => ({
  safeParseSandboxConfig: vi.fn(),
}));

import { POST } from './route';
import { safeParseSandboxConfig } from '@/lib/validators/config';
import { checkRateLimit } from '@/lib/rate-limit';
import { createSession } from '@/lib/db/queries';
import { getSandboxManager } from '@/lib/sandbox/manager';

describe('POST /api/sandbox/create', () => {
  const validConfig = {
    planSource: 'file',
    planFile: 'plan.md',
    runtime: 'node24',
    githubToken: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    opencodeAuthJsonB64: Buffer.from(JSON.stringify({ key: 'value' })).toString('base64'),
    gistUrl: 'https://gist.githubusercontent.com/user/123/raw/script.sh',
  };

  function createMockRequest(body: unknown): Request {
    return new Request('http://localhost/api/sandbox/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('should create sandbox successfully with valid config', async () => {
    const mockSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      config: validConfig,
      runtime: 'node24',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(safeParseSandboxConfig).mockReturnValue({
      success: true,
      data: validConfig,
    } as never);

    vi.mocked(checkRateLimit).mockResolvedValue({
      success: true,
      remaining: 99,
      reset: Date.now() + 3600000,
    });

    vi.mocked(createSession).mockResolvedValue(mockSession as never);

    const request = createMockRequest(validConfig);
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.sessionId).toBe(mockSession.id);
    expect(body.sandboxId).toBe('sandbox-123');
    expect(body.runtime).toBe('node24');
  });

  it('should return 503 when authentication not available', async () => {
    const { isAuthenticationAvailable } = await import('@/lib/sandbox/auth');
    vi.mocked(isAuthenticationAvailable).mockReturnValue(false);

    const request = createMockRequest(validConfig);
    const response = await POST(request);

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe('AUTH_NOT_CONFIGURED');
  });

  it('should return 429 when rate limit exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 3600000,
    });

    const request = createMockRequest(validConfig);
    const response = await POST(request);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should return 400 for invalid configuration', async () => {
    vi.mocked(safeParseSandboxConfig).mockReturnValue({
      success: false,
      error: {
        flatten: () => ({
          fieldErrors: { planFile: ['Plan file is required'] },
        }),
      },
    } as never);

    const request = createMockRequest({ invalid: 'config' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when GitHub token is missing', async () => {
    const configWithoutToken = { ...validConfig, githubToken: '' };

    vi.mocked(safeParseSandboxConfig).mockReturnValue({
      success: true,
      data: configWithoutToken,
    } as never);

    vi.mocked(checkRateLimit).mockResolvedValue({
      success: true,
      remaining: 99,
      reset: Date.now() + 3600000,
    });

    const request = createMockRequest(configWithoutToken);
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toContain('GitHub token');
  });

  it('should return 400 when opencode auth is missing', async () => {
    const configWithoutAuth = { ...validConfig, opencodeAuthJsonB64: '' };

    vi.mocked(safeParseSandboxConfig).mockReturnValue({
      success: true,
      data: configWithoutAuth,
    } as never);

    vi.mocked(checkRateLimit).mockResolvedValue({
      success: true,
      remaining: 99,
      reset: Date.now() + 3600000,
    });

    const request = createMockRequest(configWithoutAuth);
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toContain('OpenCode');
  });

  it('should return 400 when gist URL is missing and no snapshot', async () => {
    const configWithoutGist = {
      ...validConfig,
      gistUrl: '',
      snapshotId: undefined,
    };

    vi.mocked(safeParseSandboxConfig).mockReturnValue({
      success: true,
      data: configWithoutGist,
    } as never);

    vi.mocked(checkRateLimit).mockResolvedValue({
      success: true,
      remaining: 99,
      reset: Date.now() + 3600000,
    });

    const request = createMockRequest(configWithoutGist);
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toContain('Gist URL');
  });

  it('should allow creation with snapshot ID even without gist URL', async () => {
    const configWithSnapshot = {
      ...validConfig,
      gistUrl: '',
      snapshotId: 'snap-123',
    };

    vi.mocked(safeParseSandboxConfig).mockReturnValue({
      success: true,
      data: configWithSnapshot,
    } as never);

    vi.mocked(checkRateLimit).mockResolvedValue({
      success: true,
      remaining: 99,
      reset: Date.now() + 3600000,
    });

    const mockSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      config: configWithSnapshot,
      runtime: 'node24',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(createSession).mockResolvedValue(mockSession as never);

    const request = createMockRequest(configWithSnapshot);
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.sessionId).toBe(mockSession.id);
  });

  it('should return 401 for authentication errors', async () => {
    vi.mocked(safeParseSandboxConfig).mockReturnValue({
      success: true,
      data: validConfig,
    } as never);

    vi.mocked(checkRateLimit).mockResolvedValue({
      success: true,
      remaining: 99,
      reset: Date.now() + 3600000,
    });

    const mockManager = {
      createSandbox: vi.fn().mockRejectedValue(new Error('OIDC authentication failed')),
    };
    vi.mocked(getSandboxManager).mockReturnValue(mockManager as never);

    const request = createMockRequest(validConfig);
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('AUTH_FAILED');
  });

  it('should return 500 for internal errors', async () => {
    vi.mocked(safeParseSandboxConfig).mockReturnValue({
      success: true,
      data: validConfig,
    } as never);

    vi.mocked(checkRateLimit).mockResolvedValue({
      success: true,
      remaining: 99,
      reset: Date.now() + 3600000,
    });

    vi.mocked(createSession).mockRejectedValue(new Error('Database connection failed'));

    const request = createMockRequest(validConfig);
    const response = await POST(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it('should use common config from environment variables', async () => {
    const configWithPartialData = {
      planSource: 'file',
      planFile: 'plan.md',
    };

    vi.mocked(safeParseSandboxConfig).mockReturnValue({
      success: true,
      data: configWithPartialData,
    } as never);

    vi.mocked(checkRateLimit).mockResolvedValue({
      success: true,
      remaining: 99,
      reset: Date.now() + 3600000,
    });

    const mockSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      config: configWithPartialData,
      runtime: 'node24',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(createSession).mockResolvedValue(mockSession as never);

    // Set common env vars
    process.env.COMMON_GITHUB_TOKEN = 'ghp_common_token';
    process.env.COMMON_OPENCODE_AUTH_JSON_B64 = Buffer.from(JSON.stringify({ key: 'value' })).toString('base64');
    process.env.COMMON_GIST_URL = 'https://gist.githubusercontent.com/user/common/raw/script.sh';

    const request = createMockRequest(configWithPartialData);
    const response = await POST(request);

    expect(response.status).toBe(201);

    // Clean up env vars
    delete process.env.COMMON_GITHUB_TOKEN;
    delete process.env.COMMON_OPENCODE_AUTH_JSON_B64;
    delete process.env.COMMON_GIST_URL;
  });

  it('should include rate limit headers in response', async () => {
    vi.mocked(safeParseSandboxConfig).mockReturnValue({
      success: true,
      data: validConfig,
    } as never);

    vi.mocked(checkRateLimit).mockResolvedValue({
      success: true,
      remaining: 99,
      reset: Date.now() + 3600000,
    });

    const mockSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      config: validConfig,
      runtime: 'node24',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(createSession).mockResolvedValue(mockSession as never);

    const request = createMockRequest(validConfig);
    const response = await POST(request);

    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('99');
    expect(response.headers.get('X-Auth-Method')).toBe('oidc');
  });
});
