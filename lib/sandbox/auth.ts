/**
 * Vercel Sandbox Authentication Utilities
 *
 * The SDK automatically reads authentication from environment variables:
 * - VERCEL_OIDC_TOKEN (recommended, auto-set on Vercel)
 * - VERCEL_ACCESS_TOKEN (fallback for non-Vercel environments)
 *
 * For local development:
 * 1. Run `vercel link` to connect to your Vercel project
 * 2. Run `vercel env pull` to pull environment variables including OIDC token
 */

export type SandboxRuntime = 'node24' | 'node22' | 'python3.13';

/**
 * Get the configured sandbox runtime from environment
 */
export function getSandboxRuntime(): SandboxRuntime {
  const runtime = process.env.VERCEL_SANDBOX_RUNTIME;
  if (runtime === 'node22' || runtime === 'python3.13') {
    return runtime;
  }
  return 'node24'; // default
}

/**
 * Get the configured sandbox timeout in milliseconds
 */
export function getSandboxTimeout(): number {
  const timeout = Number.parseInt(process.env.VERCEL_SANDBOX_TIMEOUT_MS || '600000', 10);
  // Ensure timeout is within reasonable bounds (1 min - 45 min)
  return Math.min(Math.max(timeout, 60000), 2700000);
}

/**
 * Check if Vercel authentication is available
 * The SDK handles authentication automatically, but this can be used for validation
 */
export function isAuthenticationAvailable(): boolean {
  return !!(process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_ACCESS_TOKEN);
}

/**
 * Get authentication method being used
 */
export function getAuthMethod(): 'oidc' | 'access_token' | 'none' {
  if (process.env.VERCEL_OIDC_TOKEN) {
    return 'oidc';
  }
  if (process.env.VERCEL_ACCESS_TOKEN) {
    return 'access_token';
  }
  return 'none';
}

/**
 * Validate that authentication is properly configured
 * Throws an error if authentication is not available
 */
export function requireAuthentication(): void {
  if (!isAuthenticationAvailable()) {
    throw new Error(
      'Vercel Sandbox authentication not configured. ' +
        'For local development, run "vercel link" and "vercel env pull". ' +
        'For production, ensure VERCEL_OIDC_TOKEN is set automatically by Vercel.'
    );
  }
}
