import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generatePlan } from '@/lib/opencode/plan-agent';

// Request schema validation
const generatePlanSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  opencodeAuthJsonB64: z.string().optional(),
});

/**
 * POST /api/plan/generate
 *
 * Development-only endpoint for generating implementation plans using OpenCode SDK
 * Returns 404 in production environments
 *
 * @param request - HTTP request with { prompt: string, opencodeAuthJsonB64?: string }
 * @returns JSON response with { plan: string, sessionId: string } or error
 */
export async function POST(request: Request) {
  // CRITICAL: Development-only check
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Plan generation is only available in development mode' },
      { status: 404 }
    );
  }

  try {
    // 1. Parse and validate request body
    const body = await request.json();
    const validation = generatePlanSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { prompt, opencodeAuthJsonB64 } = validation.data;

    // 2. Use common config as fallback for auth
    const auth = opencodeAuthJsonB64 || process.env.COMMON_OPENCODE_AUTH_JSON_B64;

    if (!auth) {
      return NextResponse.json(
        {
          error:
            'OpenCode authentication required. Set COMMON_OPENCODE_AUTH_JSON_B64 or provide opencodeAuthJsonB64.',
        },
        { status: 400 }
      );
    }

    // 3. Generate plan using service
    const result = await generatePlan({
      prompt,
      auth,
    });

    // 4. Return plan
    return NextResponse.json({
      plan: result.plan,
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error('Plan generation error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
