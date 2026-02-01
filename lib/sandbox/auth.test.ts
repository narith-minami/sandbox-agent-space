import { describe, expect, it, vi } from 'vitest';
import {
  getAuthMethod,
  getSandboxRuntime,
  getSandboxTimeout,
  isAuthenticationAvailable,
  requireAuthentication,
} from './auth';

describe('getSandboxRuntime', () => {
  it('should return node24 by default', () => {
    vi.stubEnv('VERCEL_SANDBOX_RUNTIME', '');
    const runtime = getSandboxRuntime();
    expect(runtime).toBe('node24');
  });

  it('should return node22 when set', () => {
    vi.stubEnv('VERCEL_SANDBOX_RUNTIME', 'node22');
    const runtime = getSandboxRuntime();
    expect(runtime).toBe('node22');
  });

  it('should return python3.13 when set', () => {
    vi.stubEnv('VERCEL_SANDBOX_RUNTIME', 'python3.13');
    const runtime = getSandboxRuntime();
    expect(runtime).toBe('python3.13');
  });

  it('should return node24 for invalid value', () => {
    vi.stubEnv('VERCEL_SANDBOX_RUNTIME', 'invalid');
    const runtime = getSandboxRuntime();
    expect(runtime).toBe('node24');
  });
});

describe('getSandboxTimeout', () => {
  it('should return default 600000 (10 minutes)', () => {
    vi.stubEnv('VERCEL_SANDBOX_TIMEOUT_MS', '');
    const timeout = getSandboxTimeout();
    expect(timeout).toBe(600000);
  });

  it('should return custom timeout', () => {
    vi.stubEnv('VERCEL_SANDBOX_TIMEOUT_MS', '300000');
    const timeout = getSandboxTimeout();
    expect(timeout).toBe(300000);
  });

  it('should enforce minimum of 60000 (1 minute)', () => {
    vi.stubEnv('VERCEL_SANDBOX_TIMEOUT_MS', '30000');
    const timeout = getSandboxTimeout();
    expect(timeout).toBe(60000);
  });

  it('should enforce maximum of 2700000 (45 minutes)', () => {
    vi.stubEnv('VERCEL_SANDBOX_TIMEOUT_MS', '3600000');
    const timeout = getSandboxTimeout();
    expect(timeout).toBe(2700000);
  });

  it('should handle non-numeric value gracefully', () => {
    vi.stubEnv('VERCEL_SANDBOX_TIMEOUT_MS', 'invalid');
    const timeout = getSandboxTimeout();
    expect(timeout).toBeNaN(); // parseInt returns NaN for invalid strings
  });
});

describe('isAuthenticationAvailable', () => {
  it('should return true when VERCEL_OIDC_TOKEN is set', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN', 'test-token');
    vi.stubEnv('VERCEL_ACCESS_TOKEN', '');
    expect(isAuthenticationAvailable()).toBe(true);
  });

  it('should return true when VERCEL_ACCESS_TOKEN is set', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');
    vi.stubEnv('VERCEL_ACCESS_TOKEN', 'test-token');
    expect(isAuthenticationAvailable()).toBe(true);
  });

  it('should return true when both tokens are set', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN', 'oidc-token');
    vi.stubEnv('VERCEL_ACCESS_TOKEN', 'access-token');
    expect(isAuthenticationAvailable()).toBe(true);
  });

  it('should return false when no tokens are set', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');
    vi.stubEnv('VERCEL_ACCESS_TOKEN', '');
    expect(isAuthenticationAvailable()).toBe(false);
  });
});

describe('getAuthMethod', () => {
  it('should return oidc when VERCEL_OIDC_TOKEN is set', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN', 'test-token');
    vi.stubEnv('VERCEL_ACCESS_TOKEN', '');
    expect(getAuthMethod()).toBe('oidc');
  });

  it('should return access_token when only VERCEL_ACCESS_TOKEN is set', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');
    vi.stubEnv('VERCEL_ACCESS_TOKEN', 'test-token');
    expect(getAuthMethod()).toBe('access_token');
  });

  it('should return oidc when both tokens are set (OIDC preferred)', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN', 'oidc-token');
    vi.stubEnv('VERCEL_ACCESS_TOKEN', 'access-token');
    expect(getAuthMethod()).toBe('oidc');
  });

  it('should return none when no tokens are set', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');
    vi.stubEnv('VERCEL_ACCESS_TOKEN', '');
    expect(getAuthMethod()).toBe('none');
  });
});

describe('requireAuthentication', () => {
  it('should not throw when VERCEL_OIDC_TOKEN is set', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN', 'test-token');
    vi.stubEnv('VERCEL_ACCESS_TOKEN', '');
    expect(() => requireAuthentication()).not.toThrow();
  });

  it('should not throw when VERCEL_ACCESS_TOKEN is set', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');
    vi.stubEnv('VERCEL_ACCESS_TOKEN', 'test-token');
    expect(() => requireAuthentication()).not.toThrow();
  });

  it('should throw when no authentication is available', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');
    vi.stubEnv('VERCEL_ACCESS_TOKEN', '');
    expect(() => requireAuthentication()).toThrow(
      'Vercel Sandbox authentication not configured'
    );
  });

  it('should throw with helpful message', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');
    vi.stubEnv('VERCEL_ACCESS_TOKEN', '');
    expect(() => requireAuthentication()).toThrow(/vercel link/);
    expect(() => requireAuthentication()).toThrow(/vercel env pull/);
  });
});
