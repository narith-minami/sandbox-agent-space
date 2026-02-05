import { NextResponse } from 'next/server';
import { fetchPrStatus } from '@/lib/api/github-pr-status';
import { getGitHubSessionForApi } from '@/lib/auth/get-github-session';
import { isGitHubAuthEnabled } from '@/lib/auth/github';
import { updateSession } from '@/lib/db/queries';
import type { ApiError, PrStatus } from '@/types/sandbox';

interface PrStatusRequestItem {
  id: string;
  prUrl?: string | null;
}

interface PrStatusRequestBody {
  sessions: PrStatusRequestItem[];
}

interface PrStatusResult {
  id: string;
  prStatus: PrStatus | null;
}

export async function POST(request: Request) {
  try {
    if (!isGitHubAuthEnabled()) {
      return NextResponse.json<ApiError>(
        { error: 'GitHub authentication is not enabled', code: 'AUTH_DISABLED' },
        { status: 404 }
      );
    }

    const githubSessionResult = await getGitHubSessionForApi();
    if (!githubSessionResult) {
      return NextResponse.json<ApiError>(
        {
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
          details: { loginUrl: `/login?next=${encodeURIComponent('/')}` },
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as PrStatusRequestBody;
    if (!body?.sessions || !Array.isArray(body.sessions)) {
      return NextResponse.json<ApiError>(
        { error: 'Invalid request body', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { session } = githubSessionResult;

    const results = await Promise.all(
      body.sessions.map(async (item): Promise<PrStatusResult> => {
        if (!item.prUrl) {
          return { id: item.id, prStatus: null };
        }

        let prStatus: PrStatus | null = null;

        try {
          prStatus = await fetchPrStatus(item.prUrl, session.accessToken);
        } catch (error) {
          console.warn('Failed to fetch PR status:', item.prUrl, error);
        }

        if (prStatus) {
          try {
            await updateSession(item.id, { prStatus });
          } catch (updateError) {
            console.error('Failed to update session with PR status:', item.id, updateError);
          }
        }

        return { id: item.id, prStatus };
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Failed to refresh PR statuses:', error);
    return NextResponse.json<ApiError>(
      { error: 'Failed to refresh PR statuses', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
