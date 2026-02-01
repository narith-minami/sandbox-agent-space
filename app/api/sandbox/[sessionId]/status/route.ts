import { NextResponse } from 'next/server';
import { getSession } from '@/lib/db/queries';
import { getSandboxManager } from '@/lib/sandbox/manager';
import { validateUUID } from '@/lib/validators/config';
import type { ApiError, SandboxStatusResponse } from '@/types/sandbox';

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

    // Get session from database
    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json<ApiError>(
        {
          error: 'Session not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // If sandbox is running, get real-time status from Vercel SDK
    let vercelStatus: SandboxStatusResponse['vercelStatus'];
    let timeout: number | undefined;

    if (session.sandboxId && (session.status === 'running' || session.status === 'pending')) {
      try {
        const sandboxManager = getSandboxManager();
        const status = await sandboxManager.getSandboxStatus(session.sandboxId);
        vercelStatus = status.vercelStatus;
        timeout = status.timeout;
      } catch {
        // Sandbox might have stopped or been deleted
        vercelStatus = undefined;
      }
    }

    const response: SandboxStatusResponse = {
      sessionId: session.id,
      sandboxId: session.sandboxId,
      status: session.status,
      vercelStatus,
      timeout,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get session status:', error);

    return NextResponse.json<ApiError>(
      {
        error: 'Failed to get session status',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
