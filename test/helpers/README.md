# Test Helpers

Shared utilities for testing in the sandbox-agent-space project.

## Overview

This directory contains reusable mock factories and utilities to reduce duplication in test files. The helpers are organized into three main modules:

- **mock-factories.ts** - Factory functions for creating mock data entities
- **mock-database.ts** - Database client and query mocking utilities
- **mock-sandbox.ts** - Vercel Sandbox SDK mocking utilities

## Installation

Import helpers from `@/test/helpers`:

```typescript
import {
  createMockSession,
  createMockDatabase,
  createMockSandbox,
} from '@/test/helpers';
```

## Mock Factories

### Database Entities

#### `createMockSession(overrides?)`

Creates a mock Session object with sensible defaults.

```typescript
const session = createMockSession({
  status: 'running',
  sandboxId: 'sandbox-123',
});
```

**Default values:**
- `id`: '550e8400-e29b-41d4-a716-446655440000'
- `status`: 'pending'
- `runtime`: 'node24'
- `config`: `{ planSource: 'file', planFile: 'plan.md' }`
- `createdAt`/`updatedAt`: Fixed timestamp
- `archived`: false

#### `createMockLog(overrides?)`

Creates a mock Log object.

```typescript
const log = createMockLog({
  level: 'error',
  message: 'Something went wrong',
});
```

#### `createMockSnapshot(overrides?)`

Creates a mock SnapshotRecord object.

```typescript
const snapshot = createMockSnapshot({
  status: 'created',
  sizeBytes: 2048000,
});
```

### Batch Factory Functions

#### `createMockSessions(count, baseOverrides?)`

Creates multiple sessions with sequential IDs.

```typescript
const sessions = createMockSessions(5, { status: 'completed' });
// Returns 5 sessions, all with status 'completed'
```

#### `createMockLogs(count, baseOverrides?)`

Creates multiple logs with sequential IDs.

```typescript
const logs = createMockLogs(10, { sessionId: 'abc-123' });
```

#### `createMockSnapshots(count, baseOverrides?)`

Creates multiple snapshots with sequential IDs.

```typescript
const snapshots = createMockSnapshots(3);
```

## Database Mocking

### Setting up Database Mocks

#### `setupMockDatabase()`

Creates a complete mock database client for use in `vi.mock()`.

```typescript
// At top of test file
vi.mock('@/lib/db/client', () => setupMockDatabase());
```

#### `createMockQueries()`

Creates mocks for all database query functions.

```typescript
// At top of test file
vi.mock('@/lib/db/queries', () => createMockQueries());

// In test
const { getSession } = await import('@/lib/db/queries');
vi.mocked(getSession).mockResolvedValue(mockSession);
```

### Individual Mock Builders

#### `createMockSelect(data?)`

Creates a mock select query chain.

```typescript
const { db } = await import('@/lib/db/client');
vi.mocked(db.select).mockImplementation(createMockSelect([session1, session2]));
```

#### `createMockInsert(data?)`

Creates a mock insert operation.

```typescript
vi.mocked(db.insert).mockImplementation(createMockInsert([newSession]));
```

#### `createMockUpdate(data?)`

Creates a mock update operation.

```typescript
vi.mocked(db.update).mockImplementation(createMockUpdate([updatedSession]));
```

#### `createMockDelete()`

Creates a mock delete operation.

```typescript
vi.mocked(db.delete).mockImplementation(createMockDelete());
```

## Sandbox Mocking

### Setting up Sandbox Mocks

#### `createMockSandboxModule()`

Creates mocks for the entire `@vercel/sandbox` module.

```typescript
// At top of test file
vi.mock('@vercel/sandbox', () => createMockSandboxModule());
```

#### `createMockAuthModule()`

Creates mocks for sandbox authentication module.

```typescript
// At top of test file
vi.mock('@/lib/sandbox/auth', () => createMockAuthModule());
```

### Sandbox Objects

#### `createMockSandbox(overrides?)`

Creates a mock Sandbox instance.

```typescript
const mockSandbox = createMockSandbox({
  sandboxId: 'test-sandbox',
  status: 'running',
});

const { Sandbox } = await import('@vercel/sandbox');
vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox as never);
```

#### `createMockCommand(overrides?)`

Creates a mock Command instance with event emitter support.

```typescript
const mockCommand = createMockCommand();
mockCommand.on('data', (data) => console.log(data));
mockCommand.emit('data', 'test output');
```

### Source Configuration

#### `createMockSnapshotSource(snapshotId)`

Creates a snapshot source configuration.

```typescript
const source = createMockSnapshotSource('snap-123');
```

#### `createMockGitSource(repoUrl, branch?)`

Creates a git source configuration.

```typescript
const source = createMockGitSource('https://github.com/owner/repo', 'develop');
```

### API Response Mocks

#### `createMockSandboxResponse(overrides?)`

Creates a mock API response for sandbox creation.

```typescript
const response = createMockSandboxResponse({
  sessionId: 'test-123',
  sandboxId: 'sandbox-456',
});
```

#### `createMockFetchResponse(data, ok?, status?)`

Creates a mock fetch Response object.

```typescript
const response = createMockFetchResponse({ success: true }, true, 200);
mockFetch.mockResolvedValue(response);
```

## Complete Examples

### Testing Database Queries

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createMockSession, setupMockDatabase } from '@/test/helpers';
import { getSession } from '@/lib/db/queries';

// Mock the database
vi.mock('@/lib/db/client', () => setupMockDatabase());

describe('getSession', () => {
  it('should return session when found', async () => {
    const mockSession = createMockSession({ status: 'running' });
    
    const { db } = await import('@/lib/db/client');
    vi.mocked(db.select).mockImplementation(() => ({
      from: () => ({
        where: () => Promise.resolve([mockSession]),
      }),
    }) as any);
    
    const result = await getSession('session-id');
    expect(result).toEqual(mockSession);
  });
});
```

### Testing Sandbox Manager

```typescript
import { describe, expect, it, vi } from 'vitest';
import {
  createMockSandbox,
  createMockSandboxModule,
  createMockAuthModule,
  createMockQueries,
} from '@/test/helpers';

// Mock all dependencies
vi.mock('@vercel/sandbox', () => createMockSandboxModule());
vi.mock('@/lib/sandbox/auth', () => createMockAuthModule());
vi.mock('@/lib/db/queries', () => createMockQueries());

describe('SandboxManager', () => {
  it('should create sandbox', async () => {
    const manager = new SandboxManager();
    const mockSandbox = createMockSandbox({ sandboxId: 'test-123' });
    
    const { Sandbox } = await import('@vercel/sandbox');
    vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox as never);
    
    const result = await manager.createSandbox('session-123', {
      env: {},
      command: 'echo test',
    });
    
    expect(result.sandboxId).toBe('test-123');
  });
});
```

### Testing React Hooks with API Calls

```typescript
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createMockSandboxResponse, createMockFetchResponse } from '@/test/helpers';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useSandboxCreate', () => {
  it('should create sandbox successfully', async () => {
    const response = createMockSandboxResponse({ sessionId: 'test-123' });
    mockFetch.mockResolvedValue(createMockFetchResponse(response));
    
    const { result } = renderHook(() => useSandboxCreate());
    result.current.mutate(config);
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
  });
});
```

## Benefits

Using these helpers:

1. **Reduces duplication** - No need to recreate mock objects in every test
2. **Consistent data** - All tests use the same default values
3. **Type-safe** - Full TypeScript support with IntelliSense
4. **Easy to maintain** - Update defaults in one place
5. **Better readability** - Tests focus on what's being tested, not setup

## Adding New Helpers

When adding new helpers:

1. Add the factory function to the appropriate file
2. Export it from `test/helpers/index.ts`
3. Add JSDoc comments with usage examples
4. Update this README with documentation
5. Ensure type safety with proper TypeScript types

## Best Practices

1. **Use overrides for test-specific values**
   ```typescript
   const session = createMockSession({ status: 'running' });
   ```

2. **Batch create when testing lists**
   ```typescript
   const sessions = createMockSessions(5);
   ```

3. **Mock modules at the top of test files**
   ```typescript
   vi.mock('@/lib/db/client', () => setupMockDatabase());
   ```

4. **Keep test logic separate from mock setup**
   - Mock setup should be declarative at the top
   - Test logic should be clear and focused

5. **Don't over-mock**
   - Only mock what you need for the test
   - Use the shared utilities but customize as needed
