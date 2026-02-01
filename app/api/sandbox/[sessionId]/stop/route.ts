import { NextResponse } from 'next/server';
import { getSession } from '@/lib/db/queries';
import { getSandboxManager } from '@/lib/sandbox/manager';
import { validateUUID } from '@/lib/validators/config';
import type { ApiError } from '@/types/sandbox';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/sandbox/[sessionId]/stop
 * Stop a running sandbox
 */
export async function POST(
  request: Request,
  { params }: RouteParams
) {
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

    if (session.status !== 'running' && session.status !== 'pending') {
      return NextResponse.json<ApiError>(
        {
          error: 'Sandbox is not running',
          code: 'SANDBOX_NOT_RUNNING',
          details: { currentStatus: session.status },
        },
        { status: 400 }
      );
    }

    // Stop sandbox using sandbox manager
    const sandboxManager = getSandboxManager();
    await sandboxManager.stopSandboxBySession(sessionId);

    return NextResponse.json({ 
      success: true,
      sessionId,
      message: 'Sandbox stopped successfully',
    });
  } catch (error) {
    console.error('Failed to stop sandbox:', error);
    
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to stop sandbox',
        code: 'INTERNAL_ERROR',
        details: { message: error instanceof Error ? error.message : 'Unknown error' },
      },
      { status: 500 }
    );
  }
}
