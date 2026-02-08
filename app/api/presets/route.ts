import { NextResponse } from 'next/server';
import { getGitHubSessionForApi } from '@/lib/auth/get-github-session';
import { createEnvironmentPreset, listEnvironmentPresets } from '@/lib/db/queries';
import { EnvironmentPresetSchema } from '@/lib/validators/config';
import type { ApiError, EnvironmentPresetListResponse } from '@/types/sandbox';

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

    const presets = await listEnvironmentPresets(sessionResult.session.user.login);
    const response: EnvironmentPresetListResponse = { presets };
    return NextResponse.json(response);
  } catch (error) {
    if (isMissingRelationError(error)) {
      const response: EnvironmentPresetListResponse = { presets: [] };
      return NextResponse.json(response);
    }
    console.error('Failed to list environment presets:', error);
    return NextResponse.json<ApiError>(
      { error: 'Failed to list environment presets', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const sessionResult = await getGitHubSessionForApi();
    if (!sessionResult) {
      return NextResponse.json<ApiError>(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validationResult = EnvironmentPresetSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json<ApiError>(
        {
          error: 'Invalid preset data',
          code: 'VALIDATION_ERROR',
          details: { errors: validationResult.error.flatten().fieldErrors },
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const preset = await createEnvironmentPreset({
      userLogin: sessionResult.session.user.login,
      name: data.name,
      gistUrl: data.gistUrl || '',
      snapshotId: data.snapshotId || '',
      workdir: data.workdir || '',
      notes: data.notes || '',
    });

    return NextResponse.json(preset, { status: 201 });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return NextResponse.json<ApiError>(
        {
          error: 'Environment presets table not found. Run db migrations.',
          code: 'MIGRATION_REQUIRED',
        },
        { status: 503 }
      );
    }
    console.error('Failed to create environment preset:', error);
    return NextResponse.json<ApiError>(
      { error: 'Failed to create environment preset', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
