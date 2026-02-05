import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockSandboxConfig, createMockSession } from '@/test/helpers/mock-factories';
import { renderHook, waitFor } from '@/test/react-test-utils';
import type { SandboxSessionWithLogs } from '@/types/sandbox';
import { useSessionCloning } from './use-session-cloning';

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
  },
}));

describe('useSessionCloning', () => {
  afterEach(() => {
    localStorage.clear();
  });
  it('forces planSource text for cloned sessions', async () => {
    const config = createMockSandboxConfig({
      planSource: 'file',
      planFile: 'docs/plan.md',
      planText: 'Task content',
    });
    const session = createMockSession({ config });
    const cloneSession: SandboxSessionWithLogs = {
      ...session,
      logs: [],
    };

    const { result } = renderHook(() => useSessionCloning(cloneSession, false));

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(result.current?.planSource).toBe('text');
    expect(result.current?.planFile).toBe('');
    expect(result.current?.planText).toBe('Task content');
  });

  it('defaults planSource to text for localStorage fallback', async () => {
    localStorage.setItem('sandbox_last_repo_url', 'https://github.com/owner/repo');
    localStorage.setItem('sandbox_last_repo_slug', 'owner/repo');
    localStorage.setItem('sandbox_last_base_branch', 'main');
    localStorage.setItem('sandbox_last_plan_file', 'docs/plan.md');
    localStorage.setItem('sandbox_last_model_id', 'claude-3-5-sonnet-20241022');
    localStorage.setItem('sandbox_last_model_provider', 'anthropic');

    const { result } = renderHook(() => useSessionCloning(undefined, false));

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(result.current?.planSource).toBe('text');
    expect(result.current?.planFile).toBe('');
    expect(result.current?.modelId).toBe('claude-3-5-sonnet-20241022');
    expect(result.current?.modelProvider).toBe('anthropic');
  });
});
