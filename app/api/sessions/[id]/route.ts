import { NextResponse } from 'next/server';
import { archiveSession, getSession } from '@/lib/db/queries';
import { SessionArchiveSchema, validateUUID } from '@/lib/validators/config';
import type { ApiError, SandboxSession } from '@/types/sandbox';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Validate session ID
    try {
      validateUUID(id);
    } catch {
      return NextResponse.json<ApiError>(
        {
          error: 'Invalid session ID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = SessionArchiveSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json<ApiError>(
        {
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: { errors: validationResult.error.flatten().fieldErrors },
        },
        { status: 400 }
      );
    }

    const { archived } = validationResult.data;

    // Check if session exists
    const existingSession = await getSession(id);
    if (!existingSession) {
      return NextResponse.json<ApiError>(
        {
          error: 'Session not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Update archive status
    const session = await archiveSession(id, archived);

    if (!session) {
      return NextResponse.json<ApiError>(
        {
          error: 'Failed to update session',
          code: 'INTERNAL_ERROR',
        },
        { status: 500 }
      );
    }

    const response: SandboxSession = {
      id: session.id,
      sandboxId: session.sandboxId,
      status: session.status,
      config: session.config,
      runtime: session.runtime,
      prUrl: session.prUrl,
      prStatus: session.prStatus,
      memo: session.memo,
      archived: session.archived,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to update session:', error);

    return NextResponse.json<ApiError>(
      {
        error: 'Failed to update session',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
