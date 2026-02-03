import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create fresh mocks for each test
const mockCreateSession = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGetClientIp = vi.fn().mockReturnValue('127.0.0.1');
const mockGetRateLimitHeaders = vi.fn().mockReturnValue({
  'X-RateLimit-Limit': '100',
  'X-RateLimit-Remaining': '99',
});
const mockGetAuthMethod = vi.fn().mockReturnValue('oidc');
const mockIsAuthenticationAvailable = vi.fn().mockReturnValue(true);
const mockCreateSandbox = vi.fn().mockResolvedValue({
  sandboxId: 'sandbox-123',
  runtime: 'node24',
});
const mockSafeParseSandboxConfig = vi.fn();

// Mock all dependencies
vi.mock('@/lib/db/queries', () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
  getRateLimitHeaders: (...args: unknown[]) => mockGetRateLimitHeaders(...args),
}));

vi.mock('@/lib/sandbox/auth', () => ({
  getAuthMethod: (...args: unknown[]) => mockGetAuthMethod(...args),
  isAuthenticationAvailable: (...args: unknown[]) => mockIsAuthenticationAvailable(...args),
}));

vi.mock('@/lib/sandbox/manager', () => ({
  getSandboxManager: vi.fn().mockReturnValue({
    createSandbox: (...args: unknown[]) => mockCreateSandbox(...args),
  }),
}));

vi.mock('@/lib/validators/config', () => ({
  safeParseSandboxConfig: (...args: unknown[]) => mockSafeParseSandboxConfig(...args),
}));

import { POST } from './route';

describe('POST /api/sandbox/create', () => {
  const validConfig = {
    planSource: 'file',
    planFile: 'plan.md',
    runtime: 'node24',
    githubToken: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    opencodeAuthJsonB64: Buffer.from(JSON.stringify({ key: 'value' })).toString('base64'),
    gistUrl: 'https://gist.githubusercontent.com/user/123/raw/script.sh',
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Set default mock implementations
    mockIsAuthenticationAvailable.mockReturnValue(true);
    mockGetAuthMethod.mockReturnValue('oidc');
    mockGetRateLimitHeaders.mockReturnValue({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '99',
    });
    mockGetClientIp.mockReturnValue('127.0.0.1');
    mockCreateSandbox.mockResolvedValue({
      sandboxId: 'sandbox-123',
      runtime: 'node24',
    });
  });

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

    mockSafeParseSandboxConfig.mockReturnValue({
      success: true,
      data: validConfig,
    });

    mockCheckRateLimit.mockResolvedValue({
      success: true,
      remaining: 99,
      reset: Date.now() + 3600000,
    });

    mockCreateSession.mockResolvedValue(mockSession);

    const request = createMockRequest(validConfig);
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.sessionId).toBe(mockSession.id);
    expect(body.sandboxId).toBe('sandbox-123');
    expect(body.runtime).toBe('node24');
  });

  it('should return 503 when authentication not available', async () => {
    mockIsAuthenticationAvailable.mockReturnValue(false);

    const request = createMockRequest(validConfig);
    const response = await POST(request);

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe('AUTH_NOT_CONFIGURED');
  });

  it('should return 429 when rate limit exceeded', async () => {
    mockSafeParseSandboxConfig.mockReturnValue({
      success: true,
      data: validConfig,
    });

    mockCheckRateLimit.mockResolvedValue({
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
    // Reset rate limit mock to success to ensure validation error is returned
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      remaining: 99,
      reset: Date.now() + 3600000,
    });

    mockSafeParseSandboxConfig.mockReturnValue({
      success: false,
      error: {
        flatten: () => ({
          fieldErrors: { planFile: ['Plan file is required'] },
        }),
      },
    });

    const request = createMockRequest({ invalid: 'config' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when GitHub token is missing', async () => {
    const configWithoutToken = { ...validConfig, githubToken: '' };

    mockSafeParseSandboxConfig.mockReturnValue({
      success: true,
      data: configWithoutToken,
    });

    mockCheckRateLimit.mockResolvedValue({
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

    mockSafeParseSandboxConfig.mockReturnValue({
      success: true,
      data: configWithoutAuth,
    });

    mockCheckRateLimit.mockResolvedValue({
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

    mockSafeParseSandboxConfig.mockReturnValue({
      success: true,
      data: configWithoutGist,
    });

    mockCheckRateLimit.mockResolvedValue({
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

    mockSafeParseSandboxConfig.mockReturnValue({
      success: true,
      data: configWithSnapshot,
    });

    mockCheckRateLimit.mockResolvedValue({
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

    mockCreateSession.mockResolvedValue(mockSession);

    const request = createMockRequest(configWithSnapshot);
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.sessionId).toBe(mockSession.id);
  });

  it('should return 401 for authentication errors', async () => {
    mockSafeParseSandboxConfig.mockReturnValue({
      success: true,
      data: validConfig,
    });

    mockCheckRateLimit.mockResolvedValue({
      success: true,
      remaining: 99,
      reset: Date.now() + 3600000,
    });

    mockCreateSession.mockRejectedValue(new Error('OIDC authentication failed'));

    const request = createMockRequest(validConfig);
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('AUTH_FAILED');
  });

  it('should return 500 for internal errors', async () => {
    mockSafeParseSandboxConfig.mockReturnValue({
      success: true,
      data: validConfig,
    });

    mockCheckRateLimit.mockResolvedValue({
      success: true,
      remaining: 99,
      reset: Date.now() + 3600000,
    });

    mockCreateSession.mockRejectedValue(new Error('Database connection failed'));

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

    mockSafeParseSandboxConfig.mockReturnValue({
      success: true,
      data: configWithPartialData,
    });

    mockCheckRateLimit.mockResolvedValue({
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

    mockCreateSession.mockResolvedValue(mockSession);

    // Set common env vars
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      COMMON_GITHUB_TOKEN: 'ghp_common_token',
      COMMON_OPENCODE_AUTH_JSON_B64: Buffer.from(JSON.stringify({ key: 'value' })).toString(
        'base64'
      ),
      COMMON_GIST_URL: 'https://gist.githubusercontent.com/user/common/raw/script.sh',
    };

    const request = createMockRequest(configWithPartialData);
    const response = await POST(request);

    expect(response.status).toBe(201);

    // Restore env vars
    process.env = originalEnv;
  });

  it('should include rate limit headers in response', async () => {
    mockSafeParseSandboxConfig.mockReturnValue({
      success: true,
      data: validConfig,
    });

    mockCheckRateLimit.mockResolvedValue({
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

    mockCreateSession.mockResolvedValue(mockSession);

    // Mock the headers to be returned in the response
    mockGetRateLimitHeaders.mockReturnValue({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '99',
    });

    const request = createMockRequest(validConfig);
    const response = await POST(request);

    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('99');
    expect(response.headers.get('X-Auth-Method')).toBe('oidc');
  });
});
