import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock generatePlan function (using hoisted to avoid initialization issues)
const { mockGeneratePlan } = vi.hoisted(() => ({
  mockGeneratePlan: vi.fn(),
}));

vi.mock('@/lib/opencode/plan-agent', () => ({
  generatePlan: mockGeneratePlan,
}));

// Import after mocks are set up
const { POST } = await import('./route');

describe('POST /api/plan/generate', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    // Use type assertion to override readonly NODE_ENV in tests
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  it('should return 404 in production mode', async () => {
    // Arrange
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const request = new Request('http://localhost:3000/api/plan/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Test prompt' }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(404);
    expect(data.error).toBe('Plan generation is only available in development mode');
    expect(mockGeneratePlan).not.toHaveBeenCalled();
  });

  it('should generate plan successfully with valid request', async () => {
    // Arrange
    (process.env as Record<string, string | undefined>).COMMON_OPENCODE_AUTH_JSON_B64 = 'test-auth';

    const planResult = {
      plan: '# Implementation Plan\n\n1. Step one',
      sessionId: 'session-123',
    };

    mockGeneratePlan.mockResolvedValue(planResult);

    const request = new Request('http://localhost:3000/api/plan/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Implement user authentication',
      }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toEqual(planResult);
    expect(mockGeneratePlan).toHaveBeenCalledWith({
      prompt: 'Implement user authentication',
      auth: 'test-auth',
    });

    // Cleanup
    delete process.env.COMMON_OPENCODE_AUTH_JSON_B64;
  });

  it('should use provided opencodeAuthJsonB64', async () => {
    // Arrange
    const auth = 'base64-encoded-auth';
    mockGeneratePlan.mockResolvedValue({
      plan: 'Test plan',
      sessionId: 'session-123',
    });

    const request = new Request('http://localhost:3000/api/plan/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Test prompt',
        opencodeAuthJsonB64: auth,
      }),
    });

    // Act
    await POST(request);

    // Assert
    expect(mockGeneratePlan).toHaveBeenCalledWith({
      prompt: 'Test prompt',
      auth: auth,
    });
  });

  it('should use COMMON_OPENCODE_AUTH_JSON_B64 as fallback', async () => {
    // Arrange
    const commonAuth = 'common-base64-auth';
    (process.env as Record<string, string | undefined>).COMMON_OPENCODE_AUTH_JSON_B64 = commonAuth;

    mockGeneratePlan.mockResolvedValue({
      plan: 'Test plan',
      sessionId: 'session-123',
    });

    const request = new Request('http://localhost:3000/api/plan/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Test prompt',
      }),
    });

    // Act
    await POST(request);

    // Assert
    expect(mockGeneratePlan).toHaveBeenCalledWith({
      prompt: 'Test prompt',
      auth: commonAuth,
    });

    // Cleanup
    delete process.env.COMMON_OPENCODE_AUTH_JSON_B64;
  });

  it('should return 400 if auth is not provided', async () => {
    // Arrange
    delete process.env.COMMON_OPENCODE_AUTH_JSON_B64;

    const request = new Request('http://localhost:3000/api/plan/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Test prompt',
      }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.error).toContain('OpenCode authentication required');
    expect(mockGeneratePlan).not.toHaveBeenCalled();
  });

  it('should return 400 if prompt is too short', async () => {
    // Arrange
    const request = new Request('http://localhost:3000/api/plan/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Short',
      }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request');
    expect(data.details).toBeDefined();
    expect(mockGeneratePlan).not.toHaveBeenCalled();
  });

  it('should return 400 if prompt is missing', async () => {
    // Arrange
    const request = new Request('http://localhost:3000/api/plan/generate', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request');
    expect(data.details).toBeDefined();
    expect(mockGeneratePlan).not.toHaveBeenCalled();
  });

  it('should return 500 if generatePlan throws an error', async () => {
    // Arrange
    (process.env as Record<string, string | undefined>).COMMON_OPENCODE_AUTH_JSON_B64 = 'test-auth';

    mockGeneratePlan.mockRejectedValue(new Error('OpenCode SDK error'));

    const request = new Request('http://localhost:3000/api/plan/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Test prompt',
      }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate plan');
    expect(data.message).toBe('OpenCode SDK error');

    // Cleanup
    delete process.env.COMMON_OPENCODE_AUTH_JSON_B64;
  });

  it('should handle malformed JSON request body', async () => {
    // Arrange
    const request = new Request('http://localhost:3000/api/plan/generate', {
      method: 'POST',
      body: 'invalid json',
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate plan');
    expect(mockGeneratePlan).not.toHaveBeenCalled();
  });
});
