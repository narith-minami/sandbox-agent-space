import { NextResponse } from 'next/server';

export interface CommonConfig {
  githubToken?: string;
  opencodeAuthJsonB64?: string;
  gistUrl?: string;
}

/**
 * GET /api/config
 * Returns common configuration from environment variables
 */
export async function GET() {
  const config: CommonConfig = {
    githubToken: process.env.COMMON_GITHUB_TOKEN,
    opencodeAuthJsonB64: process.env.COMMON_OPENCODE_AUTH_JSON_B64,
    gistUrl: process.env.COMMON_GIST_URL,
  };

  return NextResponse.json(config);
}
