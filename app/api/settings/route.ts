import { NextResponse } from 'next/server';
import { getGitHubSessionForApi } from '@/lib/auth/get-github-session';
import { getUserSettings, upsertUserSettings } from '@/lib/db/queries';
import { UserSettingsSchema } from '@/lib/validators/config';
import type { ApiError, UserSettingsResponse } from '@/types/sandbox';

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errorWithCode = error as { code?: string; cause?: { code?: string } };
  return errorWithCode.code === '42P01' || errorWithCode.cause?.code === '42P01';
}

export async function GET() {
  try {
    const sessionResult = await getGitHubSessionForApi();
    if (!sessionResult) {
      return NextResponse.json<ApiError>(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const settings = await getUserSettings(sessionResult.session.user.login);
    const response: UserSettingsResponse = { settings: settings || null };
    return NextResponse.json(response);
  } catch (error) {
    if (isMissingRelationError(error)) {
      const response: UserSettingsResponse = { settings: null };
      return NextResponse.json(response);
    }
    console.error('Failed to fetch user settings:', error);
    return NextResponse.json<ApiError>(
      { error: 'Failed to fetch user settings', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const sessionResult = await getGitHubSessionForApi();
    if (!sessionResult) {
      return NextResponse.json<ApiError>(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validationResult = UserSettingsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json<ApiError>(
        {
          error: 'Invalid settings data',
          code: 'VALIDATION_ERROR',
          details: { errors: validationResult.error.flatten().fieldErrors },
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const settings = await upsertUserSettings({
      userLogin: sessionResult.session.user.login,
      opencodeAuthJsonB64: data.opencodeAuthJsonB64 || '',
      enableCodeReview: data.enableCodeReview,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return NextResponse.json<ApiError>(
        { error: 'User settings table not found. Run db migrations.', code: 'MIGRATION_REQUIRED' },
        { status: 503 }
      );
    }
    console.error('Failed to update user settings:', error);
    return NextResponse.json<ApiError>(
      { error: 'Failed to update user settings', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
