import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getConnectedProviderModels } from '@/lib/opencode/provider-models';
import type { ApiError } from '@/types/sandbox';

const modelsRequestBodySchema = z.object({
  opencodeAuthJsonB64: z.string().optional(),
});

function createErrorResponse(error: unknown) {
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

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getConnectedProviderModels(process.env.COMMON_OPENCODE_AUTH_JSON_B64);
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = modelsRequestBodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json<ApiError>(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: { errors: parsed.error.flatten().fieldErrors },
        },
        { status: 400 }
      );
    }

    const result = await getConnectedProviderModels(parsed.data.opencodeAuthJsonB64);
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
