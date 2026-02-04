import { describe, expect, it } from 'vitest';
import {
  PaginationSchema,
  PlanSourceSchema,
  SandboxConfigSchema,
  SandboxRuntimeSchema,
  SessionArchiveSchema,
  SessionListFilterSchema,
  SnapshotIdSchema,
  safeParseSandboxConfig,
  UUIDSchema,
  validateSandboxConfig,
  validateSnapshotId,
  validateUUID,
} from './config';

describe('SandboxRuntimeSchema', () => {
  it('should validate node24 runtime', () => {
    const result = SandboxRuntimeSchema.parse('node24');
    expect(result).toBe('node24');
  });

  it('should validate node22 runtime', () => {
    const result = SandboxRuntimeSchema.parse('node22');
    expect(result).toBe('node22');
  });

  it('should validate python3.13 runtime', () => {
    const result = SandboxRuntimeSchema.parse('python3.13');
    expect(result).toBe('python3.13');
  });

  it('should reject invalid runtime', () => {
    expect(() => SandboxRuntimeSchema.parse('invalid')).toThrow();
  });
});

describe('PlanSourceSchema', () => {
  it('should validate file source', () => {
    const result = PlanSourceSchema.parse('file');
    expect(result).toBe('file');
  });

  it('should validate text source', () => {
    const result = PlanSourceSchema.parse('text');
    expect(result).toBe('text');
  });

  it('should reject invalid source', () => {
    expect(() => PlanSourceSchema.parse('invalid')).toThrow();
  });
});

describe('SandboxConfigSchema', () => {
  describe('gistUrl validation', () => {
    it('should accept valid gist URL', () => {
      const result = SandboxConfigSchema.safeParse({
        gistUrl: 'https://gist.githubusercontent.com/user/123/raw/file.sh',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid gist.github.com URL', () => {
      const result = SandboxConfigSchema.safeParse({
        gistUrl: 'https://gist.github.com/user/123',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-gist URL', () => {
      const result = SandboxConfigSchema.safeParse({
        gistUrl: 'https://example.com/file.sh',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL format', () => {
      const result = SandboxConfigSchema.safeParse({
        gistUrl: 'not-a-url',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(false);
    });

    it('should allow empty gistUrl', () => {
      const result = SandboxConfigSchema.safeParse({
        gistUrl: '',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('repoUrl validation', () => {
    it('should accept valid GitHub repo URL', () => {
      const result = SandboxConfigSchema.safeParse({
        repoUrl: 'https://github.com/owner/repo',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });

    it('should accept GitHub URL with path', () => {
      const result = SandboxConfigSchema.safeParse({
        repoUrl: 'https://github.com/owner/repo/tree/main',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-GitHub URL', () => {
      const result = SandboxConfigSchema.safeParse({
        repoUrl: 'https://gitlab.com/owner/repo',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(false);
    });

    it('should reject URL without owner/repo', () => {
      const result = SandboxConfigSchema.safeParse({
        repoUrl: 'https://github.com/',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(false);
    });

    it('should allow empty repoUrl', () => {
      const result = SandboxConfigSchema.safeParse({
        repoUrl: '',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('repoSlug validation', () => {
    it('should accept valid repo slug', () => {
      const result = SandboxConfigSchema.safeParse({
        repoSlug: 'owner/repo',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });

    it('should accept repo slug with hyphen', () => {
      const result = SandboxConfigSchema.safeParse({
        repoSlug: 'my-owner/my-repo',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });

    it('should accept repo slug with underscore', () => {
      const result = SandboxConfigSchema.safeParse({
        repoSlug: 'my_owner/my_repo',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });

    it('should accept repo slug with dot', () => {
      const result = SandboxConfigSchema.safeParse({
        repoSlug: 'owner/repo.name',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid repo slug format', () => {
      const result = SandboxConfigSchema.safeParse({
        repoSlug: 'invalid-slug',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(false);
    });

    it('should allow empty repoSlug', () => {
      const result = SandboxConfigSchema.safeParse({
        repoSlug: '',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('baseBranch validation', () => {
    it('should accept valid branch name', () => {
      const result = SandboxConfigSchema.safeParse({
        baseBranch: 'main',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });

    it('should reject branch with path traversal', () => {
      const result = SandboxConfigSchema.safeParse({
        baseBranch: 'main..branch',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(false);
    });

    it('should reject branch with space', () => {
      const result = SandboxConfigSchema.safeParse({
        baseBranch: 'feature branch',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(false);
    });

    it('should default to main', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.baseBranch).toBe('main');
      }
    });

    it('should reject empty branch', () => {
      const result = SandboxConfigSchema.safeParse({
        baseBranch: '',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('frontDir validation', () => {
    it('should accept valid directory', () => {
      const result = SandboxConfigSchema.safeParse({
        frontDir: 'frontend',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });

    it('should reject path traversal', () => {
      const result = SandboxConfigSchema.safeParse({
        frontDir: '../frontend',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(false);
    });

    it('should reject absolute path', () => {
      const result = SandboxConfigSchema.safeParse({
        frontDir: '/frontend',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(false);
    });

    it('should accept empty string (root directory)', () => {
      const result = SandboxConfigSchema.safeParse({
        frontDir: '',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.frontDir).toBe('');
      }
    });

    it('should default to empty string (root directory)', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.frontDir).toBe('');
      }
    });
  });

  describe('planFile validation', () => {
    it('should accept .md file', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });

    it('should accept .txt file', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'file',
        planFile: 'plan.txt',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-md/txt file', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'file',
        planFile: 'plan.js',
      });
      expect(result.success).toBe(false);
    });

    it('should reject path traversal in planFile', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'file',
        planFile: '../plan.md',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('planSource and planText validation', () => {
    it('should accept text source with planText', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'text',
        planText: 'Some plan content',
      });
      expect(result.success).toBe(true);
    });

    it('should reject text source without planText', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'text',
        planText: '',
      });
      expect(result.success).toBe(false);
    });

    it('should accept file source with planFile', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });

    it('should reject file source without planFile', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'file',
        planFile: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('opencodeAuthJsonB64 validation', () => {
    it('should accept valid base64 JSON', () => {
      const validJson = JSON.stringify({ key: 'value' });
      const base64 = Buffer.from(validJson).toString('base64');
      const result = SandboxConfigSchema.safeParse({
        opencodeAuthJsonB64: base64,
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid base64', () => {
      const result = SandboxConfigSchema.safeParse({
        opencodeAuthJsonB64: 'not-valid-base64!!!',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-JSON base64', () => {
      const base64 = Buffer.from('not-json').toString('base64');
      const result = SandboxConfigSchema.safeParse({
        opencodeAuthJsonB64: base64,
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(false);
    });

    it('should allow empty value', () => {
      const result = SandboxConfigSchema.safeParse({
        opencodeAuthJsonB64: '',
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('optional fields', () => {
    it('should accept runtime selection', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'file',
        planFile: 'plan.md',
        runtime: 'python3.13',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.runtime).toBe('python3.13');
      }
    });

    it('should accept snapshotId', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'file',
        planFile: 'plan.md',
        snapshotId: 'snapshot-123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.snapshotId).toBe('snapshot-123');
      }
    });

    it('should accept enableCodeReview', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'file',
        planFile: 'plan.md',
        enableCodeReview: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enableCodeReview).toBe(true);
      }
    });

    it('should accept memo', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'file',
        planFile: 'plan.md',
        memo: 'Test memo',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.memo).toBe('Test memo');
      }
    });
  });

  describe('default values', () => {
    it('should set all defaults', () => {
      const result = SandboxConfigSchema.safeParse({
        planSource: 'file',
        planFile: 'plan.md',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gistUrl).toBe('');
        expect(result.data.repoUrl).toBe('');
        expect(result.data.repoSlug).toBe('');
        expect(result.data.baseBranch).toBe('main');
        expect(result.data.frontDir).toBe('');
        expect(result.data.planSource).toBe('file');
        expect(result.data.planFile).toBe('plan.md');
        expect(result.data.planText).toBe('');
        expect(result.data.opencodeAuthJsonB64).toBe('');
        expect(result.data.runtime).toBe('node24');
        expect(result.data.enableCodeReview).toBe(false);
        expect(result.data.memo).toBeUndefined();
        expect(result.data.snapshotId).toBeUndefined();
      }
    });
  });
});

describe('validateSandboxConfig', () => {
  it('should return validated config on valid input', () => {
    const input = {
      planSource: 'file',
      planFile: 'plan.md',
    };
    const result = validateSandboxConfig(input);
    expect(result.planSource).toBe('file');
    expect(result.planFile).toBe('plan.md');
  });

  it('should throw on invalid input', () => {
    const input = {
      planSource: 'invalid',
      planFile: 'plan.md',
    };
    expect(() => validateSandboxConfig(input)).toThrow();
  });
});

describe('safeParseSandboxConfig', () => {
  it('should return success true on valid input', () => {
    const input = {
      planSource: 'file',
      planFile: 'plan.md',
    };
    const result = safeParseSandboxConfig(input);
    expect(result.success).toBe(true);
  });

  it('should return success false on invalid input', () => {
    const input = {
      planSource: 'invalid',
      planFile: 'plan.md',
    };
    const result = safeParseSandboxConfig(input);
    expect(result.success).toBe(false);
  });
});

describe('UUIDSchema', () => {
  it('should validate UUID format', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = UUIDSchema.parse(validUuid);
    expect(result).toBe(validUuid);
  });

  it('should reject invalid UUID', () => {
    expect(() => UUIDSchema.parse('not-a-uuid')).toThrow();
  });

  it('should reject empty string', () => {
    expect(() => UUIDSchema.parse('')).toThrow();
  });
});

describe('validateUUID', () => {
  it('should return valid UUID', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = validateUUID(validUuid);
    expect(result).toBe(validUuid);
  });

  it('should throw on invalid UUID', () => {
    expect(() => validateUUID('not-a-uuid')).toThrow();
  });
});

describe('PaginationSchema', () => {
  it('should default page to 1', () => {
    const result = PaginationSchema.parse({});
    expect(result.page).toBe(1);
  });

  it('should default limit to 20', () => {
    const result = PaginationSchema.parse({});
    expect(result.limit).toBe(20);
  });

  it('should coerce string page to number', () => {
    const result = PaginationSchema.parse({ page: '5' });
    expect(result.page).toBe(5);
  });

  it('should coerce string limit to number', () => {
    const result = PaginationSchema.parse({ limit: '50' });
    expect(result.limit).toBe(50);
  });

  it('should reject zero page', () => {
    expect(() => PaginationSchema.parse({ page: 0 })).toThrow();
  });

  it('should reject negative page', () => {
    expect(() => PaginationSchema.parse({ page: -1 })).toThrow();
  });

  it('should reject limit over 100', () => {
    expect(() => PaginationSchema.parse({ limit: 101 })).toThrow();
  });

  it('should reject non-integer page', () => {
    expect(() => PaginationSchema.parse({ page: 1.5 })).toThrow();
  });
});

describe('SessionListFilterSchema', () => {
  it('should default archived to false', () => {
    const result = SessionListFilterSchema.parse({});
    expect(result.archived).toBe(false);
  });

  it('should accept boolean archived', () => {
    const result = SessionListFilterSchema.parse({ archived: true });
    expect(result.archived).toBe(true);
  });

  it('should transform string "true" to boolean true', () => {
    const result = SessionListFilterSchema.parse({ archived: 'true' });
    expect(result.archived).toBe(true);
  });

  it('should transform string "TRUE" to boolean true', () => {
    const result = SessionListFilterSchema.parse({ archived: 'TRUE' });
    expect(result.archived).toBe(true);
  });

  it('should transform string "false" to boolean false', () => {
    const result = SessionListFilterSchema.parse({ archived: 'false' });
    expect(result.archived).toBe(false);
  });

  it('should transform any other string to boolean false', () => {
    const result = SessionListFilterSchema.parse({ archived: 'yes' });
    expect(result.archived).toBe(false);
  });

  it('should accept status array', () => {
    const result = SessionListFilterSchema.parse({
      status: ['running', 'completed'],
    });
    expect(result.status).toEqual(['running', 'completed']);
  });

  it('should accept single status', () => {
    const result = SessionListFilterSchema.parse({ status: ['running'] });
    expect(result.status).toEqual(['running']);
  });

  it('should reject invalid status', () => {
    expect(() => SessionListFilterSchema.parse({ status: ['invalid'] })).toThrow();
  });
});

describe('SessionArchiveSchema', () => {
  it('should accept archived true', () => {
    const result = SessionArchiveSchema.parse({ archived: true });
    expect(result.archived).toBe(true);
  });

  it('should accept archived false', () => {
    const result = SessionArchiveSchema.parse({ archived: false });
    expect(result.archived).toBe(false);
  });

  it('should reject non-boolean', () => {
    expect(() => SessionArchiveSchema.parse({ archived: 'true' })).toThrow();
  });
});

describe('SnapshotIdSchema', () => {
  it('should accept valid snapshot ID', () => {
    const result = SnapshotIdSchema.parse('snapshot-123');
    expect(result).toBe('snapshot-123');
  });

  it('should reject empty string', () => {
    expect(() => SnapshotIdSchema.parse('')).toThrow();
  });
});

describe('validateSnapshotId', () => {
  it('should return valid snapshot ID', () => {
    const result = validateSnapshotId('snapshot-123');
    expect(result).toBe('snapshot-123');
  });

  it('should throw on empty string', () => {
    expect(() => validateSnapshotId('')).toThrow();
  });
});
