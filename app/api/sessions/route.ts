import { NextResponse } from 'next/server';
import { listSessions } from '@/lib/db/queries';
import { PaginationSchema } from '@/lib/validators/config';
import type { SessionListResponse, ApiError } from '@/types/sandbox';

export async function GET(request: Request) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '20';

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

    const { page: validPage, limit: validLimit } = paginationResult.data;

    // Get sessions
    const result = await listSessions(validPage, validLimit);

    const response: SessionListResponse = {
      sessions: result.sessions.map(session => ({
        id: session.id,
        sandboxId: session.sandboxId,
        status: session.status,
        config: session.config,
        runtime: session.runtime,
        prUrl: session.prUrl,
        memo: session.memo,
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
