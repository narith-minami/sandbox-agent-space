import { vi } from 'vitest';

/**
 * Type-safe database query chain mock builder.
 * Provides a fluent API for mocking Drizzle ORM query chains.
 */
interface QueryChainMock {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock database select query chain.
 * Returns a chainable mock that resolves to the provided data.
 *
 * @param data - Data to return from the query chain
 * @returns Mock select function with chainable methods
 *
 * @example
 * ```ts
 * const mockSelect = createMockSelect([session1, session2]);
 * db.select = mockSelect;
 * const result = await db.select().from(sessions).where(...);
 * expect(result).toEqual([session1, session2]);
 * ```
 */
export function createMockSelect<T = unknown>(data: T[] = []) {
  const chain: QueryChainMock = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
  };

  // Setup chain to return Promise resolving to data
  chain.from.mockReturnValue(chain);
  chain.where.mockResolvedValue(data);
  chain.orderBy.mockResolvedValue(data);
  chain.limit.mockResolvedValue(data);
  chain.offset.mockResolvedValue(data);

  return vi.fn(() => chain);
}

/**
 * Creates a mock database insert operation.
 * Returns a mock that resolves to the provided data.
 *
 * @param data - Data to return from the insert operation
 * @returns Mock insert function
 *
 * @example
 * ```ts
 * const mockInsert = createMockInsert([newSession]);
 * db.insert = mockInsert;
 * const result = await db.insert(sessions).values({ ... }).returning();
 * expect(result).toEqual([newSession]);
 * ```
 */
export function createMockInsert<T = unknown>(data: T[] = []) {
  return vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => Promise.resolve(data)),
    })),
  }));
}

/**
 * Creates a mock database update operation.
 * Returns a mock that resolves to the provided data.
 *
 * @param data - Data to return from the update operation
 * @returns Mock update function
 *
 * @example
 * ```ts
 * const mockUpdate = createMockUpdate([updatedSession]);
 * db.update = mockUpdate;
 * const result = await db.update(sessions).set({ ... }).where(...).returning();
 * expect(result).toEqual([updatedSession]);
 * ```
 */
export function createMockUpdate<T = unknown>(data: T[] = []) {
  return vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(data)),
      })),
    })),
  }));
}

/**
 * Creates a mock database delete operation.
 * Returns a mock that resolves successfully.
 *
 * @returns Mock delete function
 *
 * @example
 * ```ts
 * const mockDelete = createMockDelete();
 * db.delete = mockDelete;
 * await db.delete(sessions).where(...);
 * expect(mockDelete).toHaveBeenCalled();
 * ```
 */
export function createMockDelete() {
  return vi.fn(() => ({
    where: vi.fn(() => Promise.resolve()),
  }));
}

/**
 * Creates a complete mock database client with all CRUD operations.
 * Useful for mocking the entire database in tests.
 *
 * @param defaults - Default data to return from operations
 * @returns Mock database client object
 *
 * @example
 * ```ts
 * vi.mock('@/lib/db/client', () => ({
 *   db: createMockDatabase({ selectData: [session1, session2] })
 * }));
 * ```
 */
export function createMockDatabase(
  defaults: { selectData?: unknown[]; insertData?: unknown[]; updateData?: unknown[] } = {}
) {
  return {
    select: createMockSelect(defaults.selectData),
    insert: createMockInsert(defaults.insertData),
    update: createMockUpdate(defaults.updateData),
    delete: createMockDelete(),
  };
}

/**
 * Creates a mock for database query module (@/lib/db/queries).
 * Provides vi.fn() mocks for all query functions.
 *
 * @returns Object with mocked query functions
 *
 * @example
 * ```ts
 * vi.mock('@/lib/db/queries', () => createMockQueries());
 *
 * // In test:
 * const { getSession } = await import('@/lib/db/queries');
 * vi.mocked(getSession).mockResolvedValue(mockSession);
 * ```
 */
export function createMockQueries() {
  return {
    // Session queries
    getSession: vi.fn().mockResolvedValue(undefined),
    getSessionWithLogs: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockResolvedValue({}),
    updateSession: vi.fn().mockResolvedValue({}),
    setSessionStatus: vi.fn().mockResolvedValue({}),
    setSessionSandboxId: vi.fn().mockResolvedValue({}),
    archiveSession: vi.fn().mockResolvedValue({}),

    // Log queries
    addLog: vi.fn().mockResolvedValue({}),
    getLogsBySessionId: vi.fn().mockResolvedValue([]),

    // Snapshot queries
    createSnapshotRecord: vi.fn().mockResolvedValue({}),
    getSnapshotRecord: vi.fn().mockResolvedValue(undefined),
    listSnapshotRecords: vi.fn().mockResolvedValue([]),
    getSnapshotsBySessionId: vi.fn().mockResolvedValue([]),
    updateSnapshotStatus: vi.fn().mockResolvedValue({}),
    deleteSnapshotRecord: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Helper to setup a mock database client in vi.mock().
 * Combines createMockDatabase with vi.mock setup.
 *
 * @example
 * ```ts
 * // At the top of test file
 * vi.mock('@/lib/db/client', () => ({
 *   db: createMockDatabase()
 * }));
 *
 * // In test
 * const { db } = await import('@/lib/db/client');
 * vi.mocked(db.select).mockImplementation(createMockSelect([session]));
 * ```
 */
export function setupMockDatabase() {
  return {
    db: createMockDatabase(),
  };
}

/**
 * Resets all database mock functions.
 * Call this in beforeEach() to ensure clean state between tests.
 *
 * @param db - Mock database client to reset
 *
 * @example
 * ```ts
 * beforeEach(() => {
 *   const { db } = await import('@/lib/db/client');
 *   resetDatabaseMocks(db);
 * });
 * ```
 */
export function resetDatabaseMocks(db: ReturnType<typeof createMockDatabase>) {
  vi.mocked(db.select).mockClear();
  vi.mocked(db.insert).mockClear();
  vi.mocked(db.update).mockClear();
  vi.mocked(db.delete).mockClear();
}
