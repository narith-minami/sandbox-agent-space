import { eq } from 'drizzle-orm';
import { db } from './client';
import { type UserSettings, userSettings } from './schema';

/**
 * UserSettingsQueries - per-user settings operations
 */

export async function getUserSettings(userLogin: string): Promise<UserSettings | undefined> {
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userLogin, userLogin));
  return settings;
}

export async function upsertUserSettings(data: {
  userLogin: string;
  opencodeAuthJsonB64?: string;
  enableCodeReview: boolean;
}): Promise<UserSettings> {
  const existing = await getUserSettings(data.userLogin);
  if (existing) {
    const [updated] = await db
      .update(userSettings)
      .set({
        opencodeAuthJsonB64: data.opencodeAuthJsonB64 || null,
        enableCodeReview: data.enableCodeReview,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userLogin, data.userLogin))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(userSettings)
    .values({
      userLogin: data.userLogin,
      opencodeAuthJsonB64: data.opencodeAuthJsonB64 || null,
      enableCodeReview: data.enableCodeReview,
    })
    .returning();
  return created;
}
