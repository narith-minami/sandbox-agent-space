import { z } from 'zod';

// URL validation helpers
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isGistUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'gist.githubusercontent.com' || parsed.hostname === 'gist.github.com'
    );
  } catch {
    return false;
  }
};

const isGitHubRepoUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'github.com' && parsed.pathname.split('/').filter(Boolean).length >= 2
    );
  } catch {
    return false;
  }
};

// Runtime options
export const SandboxRuntimeSchema = z.enum(['node24', 'node22', 'python3.13']);

// Plan source type
export const PlanSourceSchema = z.enum(['file', 'text']);

// Sandbox configuration schema with Zod v4
// Fields can be empty if common config environment variables are set
export const SandboxConfigSchema = z
  .object({
    gistUrl: z
      .string()
      .refine((val) => !val || isValidUrl(val), 'Invalid URL format')
      .refine((val) => !val || isGistUrl(val), 'Must be a valid GitHub Gist URL')
      .optional()
      .default(''),

    repoUrl: z
      .string()
      .refine((val) => !val || isValidUrl(val), 'Invalid URL format')
      .refine((val) => !val || isGitHubRepoUrl(val), 'Must be a valid GitHub repository URL')
      .optional()
      .default(''),

    repoSlug: z
      .string()
      .refine(
        (val) => !val || /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(val),
        'Invalid repository slug format (owner/repo)'
      )
      .optional()
      .default(''),

    baseBranch: z
      .string()
      .min(1, 'Base branch is required')
      .refine((val) => !val.includes('..'), 'Invalid branch name')
      .refine((val) => !val.includes(' '), 'Branch name cannot contain spaces')
      .default('main'),

    frontDir: z
      .string()
      .refine((val) => !val || !val.includes('..'), 'Path traversal is not allowed')
      .refine((val) => !val || !val.startsWith('/'), 'Absolute paths are not allowed')
      .default(''),

    // Plan source: 'file' or 'text'
    planSource: PlanSourceSchema.default('file'),

    // Plan file path (used when planSource is 'file')
    // Can be relative path (from FRONT_DIR) or absolute path
    planFile: z
      .string()
      .refine((val) => !val || !val.includes('..'), 'Path traversal is not allowed')
      .refine(
        (val) => !val || val.endsWith('.md') || val.endsWith('.txt'),
        'Plan file must be .md or .txt'
      )
      .optional()
      .default(''),

    // Plan text content (used when planSource is 'text')
    planText: z.string().optional().default(''),

    opencodeAuthJsonB64: z
      .string()
      .refine((val) => {
        if (!val) return true; // Allow empty if common config exists
        try {
          const decoded = atob(val);
          JSON.parse(decoded);
          return true;
        } catch {
          return false;
        }
      }, 'Invalid base64-encoded JSON')
      .optional()
      .default(''),

    // New: runtime selection (optional, defaults to node24)
    runtime: SandboxRuntimeSchema.optional().default('node24'),

    // New: AI model selection (optional, defaults to Claude Sonnet 4.5 / OpenCode default)
    modelProvider: z.string().default('anthropic'),
    modelId: z.string().default('claude-sonnet-4-5'),

    // New: optional snapshot ID to create from
    snapshotId: z.string().optional(),

    // New: enable code review (default: false)
    enableCodeReview: z.boolean().default(false),

    // New: optional memo field
    memo: z.string().optional(),
  })
  .refine(
    (data) => {
      // Validate that either planFile or planText is provided based on planSource
      if (data.planSource === 'file') {
        return data.planFile && data.planFile.length > 0;
      }
      return data.planText && data.planText.length > 0;
    },
    {
      message: 'Plan file path or plan text is required',
      path: ['planFile'],
    }
  );

export type ValidatedSandboxConfig = z.infer<typeof SandboxConfigSchema>;

// Validation function
export function validateSandboxConfig(data: unknown): ValidatedSandboxConfig {
  return SandboxConfigSchema.parse(data);
}

// Safe validation that returns result object
export function safeParseSandboxConfig(data: unknown) {
  return SandboxConfigSchema.safeParse(data);
}

// UUID validation
export const UUIDSchema = z.string().uuid('Invalid session ID format');

export function validateUUID(id: string): string {
  return UUIDSchema.parse(id);
}

// Pagination schema
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

// Session list filter schema
export const SessionListFilterSchema = z.object({
  status: z.enum(['pending', 'running', 'stopping', 'completed', 'failed']).array().optional(),
  prStatus: z.enum(['open', 'closed', 'merged']).array().optional(),
  archived: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        return val.toLowerCase() === 'true';
      }
      return false;
    })
    .optional()
    .default(false),
});

export type SessionListFilterParams = z.infer<typeof SessionListFilterSchema>;

// Session archive schema
export const SessionArchiveSchema = z.object({
  archived: z.boolean(),
});

export type SessionArchiveParams = z.infer<typeof SessionArchiveSchema>;

// Snapshot ID validation
export const SnapshotIdSchema = z.string().min(1, 'Snapshot ID is required');

export function validateSnapshotId(id: string): string {
  return SnapshotIdSchema.parse(id);
}

// Environment preset schema
export const EnvironmentPresetSchema = z.object({
  name: z.string().min(1, 'Preset name is required'),
  gistUrl: z
    .string()
    .refine((val) => !val || isValidUrl(val), 'Invalid URL format')
    .refine((val) => !val || isGistUrl(val), 'Must be a valid GitHub Gist URL')
    .optional()
    .default(''),
  snapshotId: z.string().optional().default(''),
  workdir: z
    .string()
    .refine((val) => !val || !val.includes('..'), 'Path traversal is not allowed')
    .refine((val) => !val || !val.startsWith('/'), 'Absolute paths are not allowed')
    .optional()
    .default(''),
});

export type EnvironmentPresetParams = z.infer<typeof EnvironmentPresetSchema>;

// User settings schema
export const UserSettingsSchema = z.object({
  opencodeAuthJsonB64: z
    .string()
    .refine((val) => {
      if (!val) return true;
      try {
        const decoded = atob(val);
        JSON.parse(decoded);
        return true;
      } catch {
        return false;
      }
    }, 'Invalid base64-encoded JSON')
    .optional()
    .default(''),
  enableCodeReview: z.boolean().default(false),
});

export type UserSettingsParams = z.infer<typeof UserSettingsSchema>;
