import { NextResponse } from 'next/server';
import { getSession, createSnapshotRecord } from '@/lib/db/queries';
import { getSandboxManager } from '@/lib/sandbox/manager';
import { getSnapshot } from '@/lib/sandbox/snapshots';
import { validateUUID } from '@/lib/validators/config';
import type { CreateSnapshotResponse, ApiError } from '@/types/sandbox';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/sandbox/[sessionId]/snapshot
 * Create a snapshot of the current sandbox state
 * 
 * Note: Creating a snapshot will automatically stop the sandbox.
 * Snapshots expire after 7 days.
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

    if (!session.sandboxId) {
      return NextResponse.json<ApiError>(
        {
          error: 'Sandbox not started yet',
          code: 'SANDBOX_NOT_STARTED',
        },
        { status: 400 }
      );
    }

    if (session.status !== 'running') {
      return NextResponse.json<ApiError>(
        {
          error: 'Sandbox is not running. Snapshots can only be created from running sandboxes.',
          code: 'SANDBOX_NOT_RUNNING',
          details: { currentStatus: session.status },
        },
        { status: 400 }
      );
    }

    // Create snapshot using sandbox manager
    const sandboxManager = getSandboxManager();
    const result = await sandboxManager.createSnapshot(sessionId);

    // Get snapshot details from Vercel
    const snapshotDetails = await getSnapshot(result.snapshotId);
    
    // Save snapshot record to database
    await createSnapshotRecord({
      snapshotId: result.snapshotId,
      sessionId,
      sourceSandboxId: session.sandboxId,
      sizeBytes: snapshotDetails?.sizeBytes || 0,
      expiresAt: result.expiresAt,
    });

    const response: CreateSnapshotResponse = {
      snapshotId: result.snapshotId,
      sessionId,
      sourceSandboxId: session.sandboxId,
      expiresAt: result.expiresAt,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Failed to create snapshot:', error);
    
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to create snapshot',
        code: 'INTERNAL_ERROR',
        details: { message: error instanceof Error ? error.message : 'Unknown error' },
      },
      { status: 500 }
    );
  }
}
