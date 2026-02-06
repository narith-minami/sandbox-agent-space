import { NextResponse } from 'next/server';
import { getSessionWithLogs, updateSession } from '@/lib/db/queries';
import { getSandboxManager } from '@/lib/sandbox/manager';
import { isTerminalStatus, mapVercelStatus } from '@/lib/sandbox/status-mapper';
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

    // Check if sandbox status needs to be synced with DB
    let { session } = result;
    if (session.sandboxId && (session.status === 'running' || session.status === 'pending')) {
      try {
        const sandboxManager = getSandboxManager();
        const status = await sandboxManager.getSandboxStatus(session.sandboxId);

        // If Vercel sandbox is in a terminal state but DB session is not, update DB
        if (status.vercelStatus) {
          const mappedStatus = mapVercelStatus(status.vercelStatus);
          if (isTerminalStatus(mappedStatus) && !isTerminalStatus(session.status)) {
            const updatedSession = await updateSession(session.id, { status: mappedStatus });
            if (updatedSession) {
              session = updatedSession;
            }
          }
        }
      } catch {
        // Sandbox might have stopped or been deleted - mark as completed
        if (!isTerminalStatus(session.status)) {
          const updatedSession = await updateSession(session.id, { status: 'completed' });
          if (updatedSession) {
            session = updatedSession;
          }
        }
      }
    }

    const response: SandboxSessionWithLogs = {
      id: session.id,
      sandboxId: session.sandboxId,
      status: session.status,
      config: session.config,
      runtime: session.runtime,
      prUrl: session.prUrl,
      prStatus: session.prStatus,
      memo: session.memo,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
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
