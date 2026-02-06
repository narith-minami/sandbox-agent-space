import { describe, expect, it } from 'vitest';
import type { ValidatedSandboxConfig } from '@/lib/validators/config';
import { SandboxConfigBuilder } from './sandbox-config-builder';

describe('SandboxConfigBuilder', () => {
  it('includes plan text in env for planSource=text', () => {
    const builder = new SandboxConfigBuilder();
    const config: ValidatedSandboxConfig = {
      gistUrl: 'https://gist.githubusercontent.com/user/123/raw/run.sh',
      repoUrl: 'https://github.com/owner/repo',
      repoSlug: 'owner/repo',
      baseBranch: 'main',
      frontDir: 'frontend',
      planSource: 'text',
      planFile: '',
      planText: 'Do the thing',
      opencodeAuthJsonB64: 'auth',
      runtime: 'node24',
      modelProvider: 'anthropic',
      modelId: 'claude-sonnet-4-5',
      snapshotId: 'snap_123',
      enableCodeReview: false,
      memo: '',
    };

    const result = builder.build(config, 'token');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.config.planText).toBe('Do the thing');
      expect(result.config.env.PLAN_TEXT).toBe('Do the thing');
      expect(result.config.env.SNAPSHOT_ID).toBe('snap_123');
      expect(result.config.env.PLAN_FILE).toBe('/vercel/sandbox/frontend/docs/plan.md');
    }
  });

  it('does not include plan text in env for planSource=file', () => {
    const builder = new SandboxConfigBuilder();
    const config: ValidatedSandboxConfig = {
      gistUrl: 'https://gist.githubusercontent.com/user/123/raw/run.sh',
      repoUrl: 'https://github.com/owner/repo',
      repoSlug: 'owner/repo',
      baseBranch: 'main',
      frontDir: '',
      planSource: 'file',
      planFile: 'docs/plan.md',
      planText: 'Should not be used',
      opencodeAuthJsonB64: 'auth',
      runtime: 'node24',
      modelProvider: 'anthropic',
      modelId: 'claude-sonnet-4-5',
      snapshotId: undefined,
      enableCodeReview: false,
      memo: '',
    };

    const result = builder.build(config, 'token');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.config.env.PLAN_TEXT).toBeUndefined();
    }
  });
});
