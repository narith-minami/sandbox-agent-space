import { NextResponse } from 'next/server';
import { getConnectedProviderModels } from '@/lib/opencode/provider-models';
import type { ApiError } from '@/types/sandbox';

interface ModelsRequestBody {
  opencodeAuthJsonB64?: string;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getConnectedProviderModels(process.env.COMMON_OPENCODE_AUTH_JSON_B64);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to load OpenCode model list',
        code: 'INTERNAL_ERROR',
        details: { message },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ModelsRequestBody;
    const result = await getConnectedProviderModels(body.opencodeAuthJsonB64);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to load OpenCode model list',
        code: 'INTERNAL_ERROR',
        details: { message },
      },
      { status: 500 }
    );
  }
}
