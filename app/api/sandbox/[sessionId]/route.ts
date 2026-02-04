import { NextResponse } from 'next/server';
import { getSessionWithLogs } from '@/lib/db/queries';
import { validateUUID } from '@/lib/validators/config';
import type { ApiError, SandboxSessionWithLogs } from '@/types/sandbox';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    // Validate session ID
    try {
      validateUUID(sessionId);
    } catch {
      return NextResponse.json<ApiError>(
        {
          error: 'Invalid session ID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Get session with logs
    const result = await getSessionWithLogs(sessionId);

    if (!result) {
      return NextResponse.json<ApiError>(
        {
          error: 'Session not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const response: SandboxSessionWithLogs = {
      id: result.session.id,
      sandboxId: result.session.sandboxId,
      status: result.session.status,
      config: result.session.config,
      runtime: result.session.runtime,
      prUrl: result.session.prUrl,
      prStatus: result.session.prStatus,
      memo: result.session.memo,
      createdAt: result.session.createdAt,
      updatedAt: result.session.updatedAt,
      logs: result.logs.map((log) => ({
        id: log.id,
        sessionId: log.sessionId,
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get session:', error);

    return NextResponse.json<ApiError>(
      {
        error: 'Failed to get session',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
