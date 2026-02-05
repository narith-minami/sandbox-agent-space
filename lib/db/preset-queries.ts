import { and, desc, eq } from 'drizzle-orm';
import { db } from './client';
import { type EnvironmentPreset, environmentPresets } from './schema';

/**
 * EnvironmentPresetQueries - user preset operations
 */

export async function listEnvironmentPresets(userLogin: string): Promise<EnvironmentPreset[]> {
  return db
    .select()
    .from(environmentPresets)
    .where(eq(environmentPresets.userLogin, userLogin))
    .orderBy(desc(environmentPresets.updatedAt));
}

export async function getEnvironmentPreset(
  userLogin: string,
  presetId: string
): Promise<EnvironmentPreset | undefined> {
  const [preset] = await db
    .select()
    .from(environmentPresets)
    .where(and(eq(environmentPresets.id, presetId), eq(environmentPresets.userLogin, userLogin)));
  return preset;
}

export async function createEnvironmentPreset(data: {
  userLogin: string;
  name: string;
  gistUrl: string;
  snapshotId?: string;
  workdir: string;
}): Promise<EnvironmentPreset> {
  const [preset] = await db
    .insert(environmentPresets)
    .values({
      userLogin: data.userLogin,
      name: data.name,
      gistUrl: data.gistUrl,
      snapshotId: data.snapshotId || null,
      workdir: data.workdir,
    })
    .returning();
  return preset;
}

export async function updateEnvironmentPreset(data: {
  userLogin: string;
  presetId: string;
  name: string;
  gistUrl: string;
  snapshotId?: string;
  workdir: string;
}): Promise<EnvironmentPreset | undefined> {
  const [preset] = await db
    .update(environmentPresets)
    .set({
      name: data.name,
      gistUrl: data.gistUrl,
      snapshotId: data.snapshotId || null,
      workdir: data.workdir,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(environmentPresets.id, data.presetId),
        eq(environmentPresets.userLogin, data.userLogin)
      )
    )
    .returning();
  return preset;
}

export async function deleteEnvironmentPreset(userLogin: string, presetId: string): Promise<void> {
  await db
    .delete(environmentPresets)
    .where(and(eq(environmentPresets.id, presetId), eq(environmentPresets.userLogin, userLogin)));
}
