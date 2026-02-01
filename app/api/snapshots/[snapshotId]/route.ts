import { NextResponse } from 'next/server';
import { getSnapshotRecord, updateSnapshotStatus, deleteSnapshotRecord } from '@/lib/db/queries';
import { getSnapshot, deleteSnapshot } from '@/lib/sandbox/snapshots';
import { validateSnapshotId } from '@/lib/validators/config';
import { isAuthenticationAvailable } from '@/lib/sandbox/auth';
import type { SnapshotSummary, ApiError } from '@/types/sandbox';

interface RouteParams {
  params: Promise<{ snapshotId: string }>;
}

/**
 * GET /api/snapshots/[snapshotId]
 * Get snapshot details
 */
export async function GET(
  request: Request,
  { params }: RouteParams
) {
  try {
    const { snapshotId } = await params;
    
    // Validate snapshot ID
    try {
      validateSnapshotId(snapshotId);
    } catch {
      return NextResponse.json<ApiError>(
        {
          error: 'Invalid snapshot ID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Try to get from local database first
    const localRecord = await getSnapshotRecord(snapshotId);
    
    if (localRecord) {
      const response: SnapshotSummary = {
        snapshotId: localRecord.snapshotId,
        sourceSandboxId: localRecord.sourceSandboxId,
        status: localRecord.status,
        sizeBytes: localRecord.sizeBytes,
        createdAt: localRecord.createdAt,
        expiresAt: localRecord.expiresAt,
      };
      return NextResponse.json(response);
    }

    // If not in database, try to get from Vercel
    if (!isAuthenticationAvailable()) {
      return NextResponse.json<ApiError>(
        {
          error: 'Snapshot not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const vercelSnapshot = await getSnapshot(snapshotId);
    
    if (!vercelSnapshot) {
      return NextResponse.json<ApiError>(
        {
          error: 'Snapshot not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const response: SnapshotSummary = {
      snapshotId: vercelSnapshot.snapshotId,
      sourceSandboxId: vercelSnapshot.sourceSandboxId,
      status: vercelSnapshot.status,
      sizeBytes: vercelSnapshot.sizeBytes,
      createdAt: vercelSnapshot.createdAt,
      expiresAt: vercelSnapshot.expiresAt,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get snapshot:', error);
    
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to get snapshot',
        code: 'INTERNAL_ERROR',
        details: { message: error instanceof Error ? error.message : 'Unknown error' },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/snapshots/[snapshotId]
 * Delete a snapshot
 */
export async function DELETE(
  request: Request,
  { params }: RouteParams
) {
  try {
    const { snapshotId } = await params;
    
    // Validate snapshot ID
    try {
      validateSnapshotId(snapshotId);
    } catch {
      return NextResponse.json<ApiError>(
        {
          error: 'Invalid snapshot ID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    if (!isAuthenticationAvailable()) {
      return NextResponse.json<ApiError>(
        {
          error: 'Vercel authentication not configured',
          code: 'AUTH_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    // Delete from Vercel
    const deleted = await deleteSnapshot(snapshotId);
    
    if (!deleted) {
      return NextResponse.json<ApiError>(
        {
          error: 'Failed to delete snapshot from Vercel',
          code: 'DELETE_FAILED',
        },
        { status: 500 }
      );
    }

    // Update local database
    const localRecord = await getSnapshotRecord(snapshotId);
    if (localRecord) {
      await updateSnapshotStatus(snapshotId, 'deleted');
    }

    return NextResponse.json({ 
      success: true,
      snapshotId,
      message: 'Snapshot deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete snapshot:', error);
    
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to delete snapshot',
        code: 'INTERNAL_ERROR',
        details: { message: error instanceof Error ? error.message : 'Unknown error' },
      },
      { status: 500 }
    );
  }
}
