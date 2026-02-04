import { NextResponse } from 'next/server';

export interface CommonConfig {
  opencodeAuthJsonB64?: string;
  gistUrl?: string;
}

/**
 * GET /api/config
 * Returns common configuration from environment variables
 * Note: COMMON_GITHUB_TOKEN is not exposed here for security reasons.
 * It will be used server-side in sandbox creation.
 */
export async function GET() {
  const config: CommonConfig = {
    opencodeAuthJsonB64: process.env.COMMON_OPENCODE_AUTH_JSON_B64,
    gistUrl: process.env.COMMON_GIST_URL,
  };

  return NextResponse.json(config);
}
