import { NextResponse } from 'next/server';
import { listSessions } from '@/lib/db/queries';
import type { ApiError, SessionListResponse } from '@/types/sandbox';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') || '12', 10);
    const archived = searchParams.get('archived') === 'true';
    const status = searchParams
      .get('status')
      ?.split(',')
      .filter((s) => ['pending', 'running', 'stopping', 'completed', 'failed'].includes(s)) as
      | ('pending' | 'running' | 'stopping' | 'completed' | 'failed')[]
      | undefined;

    const filters = {
      archived,
      status,
    };

    const result = await listSessions(page, limit, filters);

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
      page,
      limit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Debug - API Error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to list sessions',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
