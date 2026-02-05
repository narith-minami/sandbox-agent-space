/**
 * LocalStorage utilities for persisting form values
 */

const STORAGE_KEYS = {
  LAST_REPO_URL: 'sandbox_last_repo_url',
  LAST_REPO_SLUG: 'sandbox_last_repo_slug',
  LAST_BASE_BRANCH: 'sandbox_last_base_branch',
  LAST_FRONT_DIR: 'sandbox_last_front_dir',
  LAST_PLAN_FILE: 'sandbox_last_plan_file',
  LAST_MODEL_ID: 'sandbox_last_model_id',
  LAST_MODEL_PROVIDER: 'sandbox_last_model_provider',
  LAST_PRESET_ID: 'sandbox_last_preset_id',
} as const;

/**
 * Save last used values to localStorage
 */
export function saveLastUsedValues(values: {
  repoUrl?: string;
  repoSlug?: string;
  baseBranch?: string;
  frontDir?: string;
  planFile?: string;
  modelId?: string;
  modelProvider?: string;
  presetId?: string | null;
}) {
  if (typeof window === 'undefined') return;

  try {
    if (values.repoUrl) {
      localStorage.setItem(STORAGE_KEYS.LAST_REPO_URL, values.repoUrl);
    }
    if (values.repoSlug) {
      localStorage.setItem(STORAGE_KEYS.LAST_REPO_SLUG, values.repoSlug);
    }
    if (values.baseBranch) {
      localStorage.setItem(STORAGE_KEYS.LAST_BASE_BRANCH, values.baseBranch);
    }
    if (values.frontDir) {
      localStorage.setItem(STORAGE_KEYS.LAST_FRONT_DIR, values.frontDir);
    }
    if (values.planFile) {
      localStorage.setItem(STORAGE_KEYS.LAST_PLAN_FILE, values.planFile);
    }
    if (values.modelId) {
      localStorage.setItem(STORAGE_KEYS.LAST_MODEL_ID, values.modelId);
    }
    if (values.modelProvider) {
      localStorage.setItem(STORAGE_KEYS.LAST_MODEL_PROVIDER, values.modelProvider);
    }
    if (values.presetId !== undefined) {
      if (values.presetId) {
        localStorage.setItem(STORAGE_KEYS.LAST_PRESET_ID, values.presetId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.LAST_PRESET_ID);
      }
    }
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

/**
 * Get last used values from localStorage
 */
export function getLastUsedValues(): {
  repoUrl?: string;
  repoSlug?: string;
  baseBranch: string;
  frontDir: string;
  planFile?: string;
  modelId?: string;
  modelProvider?: string;
  presetId?: string;
} {
  if (typeof window === 'undefined') {
    return { baseBranch: 'main', frontDir: '' };
  }

  try {
    return {
      repoUrl: localStorage.getItem(STORAGE_KEYS.LAST_REPO_URL) || undefined,
      repoSlug: localStorage.getItem(STORAGE_KEYS.LAST_REPO_SLUG) || undefined,
      baseBranch: localStorage.getItem(STORAGE_KEYS.LAST_BASE_BRANCH) || 'main',
      frontDir: localStorage.getItem(STORAGE_KEYS.LAST_FRONT_DIR) || '',
      planFile: localStorage.getItem(STORAGE_KEYS.LAST_PLAN_FILE) || undefined,
      modelId: localStorage.getItem(STORAGE_KEYS.LAST_MODEL_ID) || undefined,
      modelProvider: localStorage.getItem(STORAGE_KEYS.LAST_MODEL_PROVIDER) || undefined,
      presetId: localStorage.getItem(STORAGE_KEYS.LAST_PRESET_ID) || undefined,
    };
  } catch (error) {
    console.error('Failed to read from localStorage:', error);
    return { baseBranch: 'main', frontDir: '' };
  }
}

/**
 * Clear all stored values
 */
export function clearLastUsedValues() {
  if (typeof window === 'undefined') return;

  try {
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }
}
