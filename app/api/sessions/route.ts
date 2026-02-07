import { NextResponse } from 'next/server';
import { getGitHubSessionForApi } from '@/lib/auth/get-github-session';
import { listSessions } from '@/lib/db/queries';
import { PaginationSchema, SessionListFilterSchema } from '@/lib/validators/config';
import type { ApiError, SessionListResponse } from '@/types/sandbox';

export async function GET(request: Request) {
  try {
    const sessionResult = await getGitHubSessionForApi();
    if (!sessionResult) {
      return NextResponse.json<ApiError>(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '20';

    // Parse status filter (comma-separated)
    const statusParam = searchParams.get('status');
    const status = statusParam
      ? statusParam
          .split(',')
          .filter((s): s is 'pending' | 'running' | 'stopping' | 'completed' | 'failed' =>
            ['pending', 'running', 'stopping', 'completed', 'failed'].includes(s)
          )
      : undefined;

    const prStatusParam = searchParams.get('prStatus');
    const prStatus = prStatusParam
      ? prStatusParam
          .split(',')
          .filter((s): s is 'open' | 'closed' | 'merged' =>
            ['open', 'closed', 'merged'].includes(s)
          )
      : undefined;

    const archived = searchParams.get('archived');

    // Validate pagination
    const paginationResult = PaginationSchema.safeParse({ page, limit });

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

    // Validate filters
    const filterResult = SessionListFilterSchema.safeParse({
      status,
      prStatus,
      archived: archived === null ? undefined : archived,
    });

    if (!filterResult.success) {
      return NextResponse.json<ApiError>(
        {
          error: 'Invalid filter parameters',
          code: 'VALIDATION_ERROR',
          details: { errors: filterResult.error.flatten().fieldErrors },
        },
        { status: 400 }
      );
    }

    const { page: validPage, limit: validLimit } = paginationResult.data;
    const filters = filterResult.data;

    // Get sessions with filters
    const result = await listSessions(validPage, validLimit, filters);

    const response: SessionListResponse = {
      sessions: result.sessions.map((session) => ({
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
      })),
      total: result.total,
      page: validPage,
      limit: validLimit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to list sessions:', error);

    return NextResponse.json<ApiError>(
      {
        error: 'Failed to list sessions',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
