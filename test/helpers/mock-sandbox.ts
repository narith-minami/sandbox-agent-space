import type { Sandbox } from '@vercel/sandbox';
import { vi } from 'vitest';

/**
 * Type for sandbox source configuration
 */
type SandboxSource =
  | { type: 'snapshot'; id: string }
  | { type: 'git'; url: string; ref?: string }
  | { type: 'tarball'; url: string };

/**
 * Creates a mock Sandbox instance with all required properties.
 * Useful for testing sandbox-related logic without real sandbox creation.
 *
 * @param overrides - Partial Sandbox object to override defaults
 * @returns Mock Sandbox object with common methods and properties
 *
 * @example
 * ```ts
 * const mockSandbox = createMockSandbox({ sandboxId: 'test-123' });
 * const { Sandbox } = await import('@vercel/sandbox');
 * vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox as never);
 * ```
 */
export function createMockSandbox(overrides: Partial<Sandbox> = {}): Partial<Sandbox> {
  return {
    sandboxId: 'sandbox-123456789',
    status: 'running',
    timeout: 600000,
    shutdown: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as Partial<Sandbox>;
}

/**
 * Creates a mock Command instance for testing command execution.
 * Includes mocked on() and off() event handlers.
 *
 * @param overrides - Partial overrides for the command mock
 * @returns Mock Command object with event handlers
 *
 * @example
 * ```ts
 * const mockCommand = createMockCommand();
 * mockCommand.on('data', (data) => console.log(data));
 * ```
 */
export function createMockCommand(overrides = {}) {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  return {
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)?.push(callback);
    }),
    off: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(callback);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
    }),
    emit: (event: string, ...args: unknown[]) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        for (const callback of eventListeners) {
          callback(...args);
        }
      }
    },
    ...overrides,
  };
}

/**
 * Creates a mock for @vercel/sandbox module.
 * Provides mocked Sandbox.create, Sandbox.get, Sandbox.list, and Command.
 *
 * @returns Object with mocked Sandbox and Command classes
 *
 * @example
 * ```ts
 * vi.mock('@vercel/sandbox', () => createMockSandboxModule());
 *
 * // In test:
 * const { Sandbox } = await import('@vercel/sandbox');
 * const mockSandbox = createMockSandbox();
 * vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox as never);
 * ```
 */
export function createMockSandboxModule() {
  return {
    Sandbox: {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
    },
    Command: vi.fn(() => createMockCommand()),
  };
}

/**
 * Creates a mock snapshot source for sandbox creation.
 *
 * @param snapshotId - Snapshot ID to use
 * @returns SandboxSource object with snapshot type
 *
 * @example
 * ```ts
 * const source = createMockSnapshotSource('snap-123');
 * expect(source.type).toBe('snapshot');
 * ```
 */
export function createMockSnapshotSource(snapshotId: string): SandboxSource {
  return {
    type: 'snapshot',
    id: snapshotId,
  } as SandboxSource;
}

/**
 * Creates a mock git source for sandbox creation.
 *
 * @param repoUrl - Git repository URL
 * @param branch - Branch name (default: 'main')
 * @returns SandboxSource object with git type
 *
 * @example
 * ```ts
 * const source = createMockGitSource('https://github.com/owner/repo', 'develop');
 * expect(source.type).toBe('git');
 * ```
 */
export function createMockGitSource(repoUrl: string, branch = 'main'): SandboxSource {
  return {
    type: 'git',
    url: repoUrl,
    ref: branch,
  } as SandboxSource;
}

/**
 * Creates a mock environment object for sandbox configuration.
 *
 * @param overrides - Environment variables to include
 * @returns Environment object
 *
 * @example
 * ```ts
 * const env = createMockEnvironment({ NODE_ENV: 'test', API_KEY: 'secret' });
 * ```
 */
export function createMockEnvironment(
  overrides: Record<string, string> = {}
): Record<string, string> {
  return {
    NODE_ENV: 'test',
    ...overrides,
  };
}

/**
 * Creates a complete mock for sandbox auth module.
 * Provides mocked authentication and configuration functions.
 *
 * @returns Object with mocked auth functions
 *
 * @example
 * ```ts
 * vi.mock('@/lib/sandbox/auth', () => createMockAuthModule());
 *
 * // In test:
 * const { getSandboxRuntime } = await import('@/lib/sandbox/auth');
 * expect(getSandboxRuntime()).toBe('node24');
 * ```
 */
export function createMockAuthModule() {
  return {
    getSandboxRuntime: vi.fn().mockReturnValue('node24'),
    getSandboxTimeout: vi.fn().mockReturnValue(600000),
    requireAuthentication: vi.fn(),
  };
}

/**
 * Setup helper for sandbox-related tests.
 * Mocks both @vercel/sandbox and authentication modules.
 *
 * @example
 * ```ts
 * // At top of test file
 * vi.mock('@vercel/sandbox', () => createMockSandboxModule());
 * vi.mock('@/lib/sandbox/auth', () => createMockAuthModule());
 * ```
 */
export function setupSandboxMocks() {
  return {
    sandboxModule: createMockSandboxModule(),
    authModule: createMockAuthModule(),
  };
}

/**
 * Creates a mock sandbox response for API testing.
 *
 * @param overrides - Override default response values
 * @returns API response object
 *
 * @example
 * ```ts
 * const response = createMockSandboxResponse({ sessionId: 'test-123' });
 * mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(response) });
 * ```
 */
export function createMockSandboxResponse(
  overrides: { sessionId?: string; sandboxId?: string; runtime?: string } = {}
) {
  return {
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    sandboxId: 'sandbox-123456789',
    runtime: 'node24',
    ...overrides,
  };
}

/**
 * Creates a mock fetch response for testing API calls.
 *
 * @param data - Response data
 * @param ok - Whether response is successful (default: true)
 * @param status - HTTP status code (default: 200)
 * @returns Mock Response object
 *
 * @example
 * ```ts
 * const response = createMockFetchResponse({ success: true }, true, 200);
 * mockFetch.mockResolvedValue(response);
 * ```
 */
export function createMockFetchResponse(data: unknown, ok = true, status = 200): Partial<Response> {
  return {
    ok,
    status,
    json: vi.fn(() => Promise.resolve(data)),
    text: vi.fn(() => Promise.resolve(JSON.stringify(data))),
  };
}
