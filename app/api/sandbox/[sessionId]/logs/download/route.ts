import { NextResponse } from 'next/server';
import { getSessionWithLogs } from '@/lib/db/queries';
import { validateUUID } from '@/lib/validators/config';
import type { ApiError } from '@/types/sandbox';

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

    // Prepare JSON data for download
    const downloadData = {
      session: {
        id: result.session.id,
        sandboxId: result.session.sandboxId,
        status: result.session.status,
        runtime: result.session.runtime,
        prUrl: result.session.prUrl,
        prStatus: result.session.prStatus,
        memo: result.session.memo,
        createdAt: result.session.createdAt,
        updatedAt: result.session.updatedAt,
        config: result.session.config,
      },
      logs: result.logs.map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
      })),
      downloadedAt: new Date().toISOString(),
    };

    // Create JSON string
    const jsonString = JSON.stringify(downloadData, null, 2);

    // Return as downloadable file
    return new NextResponse(jsonString, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="session-${sessionId}-logs.json"`,
      },
    });
  } catch (error) {
    console.error('Failed to download session logs:', error);

    return NextResponse.json<ApiError>(
      {
        error: 'Failed to download session logs',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
