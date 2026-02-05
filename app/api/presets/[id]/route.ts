import { NextResponse } from 'next/server';
import { getGitHubSessionForApi } from '@/lib/auth/get-github-session';
import { deleteEnvironmentPreset, updateEnvironmentPreset } from '@/lib/db/queries';
import { EnvironmentPresetSchema, UUIDSchema } from '@/lib/validators/config';
import type { ApiError } from '@/types/sandbox';

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errorWithCode = error as { code?: string; cause?: { code?: string } };
  return errorWithCode.code === '42P01' || errorWithCode.cause?.code === '42P01';
}

interface PresetRouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: PresetRouteParams) {
  try {
    const sessionResult = await getGitHubSessionForApi();
    if (!sessionResult) {
      return NextResponse.json<ApiError>(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const idResult = UUIDSchema.safeParse(id);
    if (!idResult.success) {
      return NextResponse.json<ApiError>(
        { error: 'Invalid preset ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
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
    const preset = await updateEnvironmentPreset({
      userLogin: sessionResult.session.user.login,
      presetId: id,
      name: data.name,
      gistUrl: data.gistUrl || '',
      snapshotId: data.snapshotId || '',
      workdir: data.workdir || '',
    });

    if (!preset) {
      return NextResponse.json<ApiError>(
        { error: 'Preset not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(preset);
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
    console.error('Failed to update environment preset:', error);
    return NextResponse.json<ApiError>(
      { error: 'Failed to update environment preset', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: PresetRouteParams) {
  try {
    const sessionResult = await getGitHubSessionForApi();
    if (!sessionResult) {
      return NextResponse.json<ApiError>(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const idResult = UUIDSchema.safeParse(id);
    if (!idResult.success) {
      return NextResponse.json<ApiError>(
        { error: 'Invalid preset ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    await deleteEnvironmentPreset(sessionResult.session.user.login, id);
    return new NextResponse(null, { status: 204 });
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
    console.error('Failed to delete environment preset:', error);
    return NextResponse.json<ApiError>(
      { error: 'Failed to delete environment preset', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
