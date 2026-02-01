import '@testing-library/jest-dom';
import { afterAll, afterEach, vi } from 'vitest';

// Mock environment variables for tests
vi.stubEnv('DATABASE_URL', 'file:./test.db');
vi.stubEnv('VERCEL_OIDC_TOKEN', 'test_oidc_token');

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  vi.restoreAllMocks();
});
