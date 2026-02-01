import { NextResponse } from 'next/server';
import { listSnapshotRecords } from '@/lib/db/queries';
import { isAuthenticationAvailable } from '@/lib/sandbox/auth';
import { listSnapshots as listVercelSnapshots } from '@/lib/sandbox/snapshots';
import { PaginationSchema } from '@/lib/validators/config';
import type { ApiError, SnapshotListResponse } from '@/types/sandbox';

/**
 * GET /api/snapshots
 * List all snapshots for the project
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Number of items per page (default: 20, max: 100)
 * - source: 'local' | 'vercel' (default: 'local')
 *   - 'local': Returns snapshots from database
 *   - 'vercel': Returns snapshots directly from Vercel SDK
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination
    const paginationResult = PaginationSchema.safeParse({
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 20,
    });

    if (!paginationResult.success) {
      return NextResponse.json<ApiError>(
        {
          error: 'Invalid pagination parameters',
          code: 'VALIDATION_ERROR',
          details: { errors: paginationResult.error.flatten().fieldErrors },
        },
        { status: 400 }
      );
    }

    const { page, limit } = paginationResult.data;
    const source = searchParams.get('source') || 'local';

    if (source === 'vercel') {
      // Get snapshots directly from Vercel SDK
      if (!isAuthenticationAvailable()) {
        return NextResponse.json<ApiError>(
          {
            error: 'Vercel authentication not configured',
            code: 'AUTH_NOT_CONFIGURED',
          },
          { status: 503 }
        );
      }

      const result = await listVercelSnapshots({ limit });

      return NextResponse.json<SnapshotListResponse>({
        snapshots: result.snapshots,
        total: result.snapshots.length,
      });
    }

    // Get snapshots from local database
    const result = await listSnapshotRecords(page, limit);

    return NextResponse.json<SnapshotListResponse>({
      snapshots: result.snapshots.map((s) => ({
        snapshotId: s.snapshotId,
        sourceSandboxId: s.sourceSandboxId,
        status: s.status,
        sizeBytes: s.sizeBytes,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
      total: result.total,
    });
  } catch (error) {
    console.error('Failed to list snapshots:', error);

    return NextResponse.json<ApiError>(
      {
        error: 'Failed to list snapshots',
        code: 'INTERNAL_ERROR',
        details: { message: error instanceof Error ? error.message : 'Unknown error' },
      },
      { status: 500 }
    );
  }
}
