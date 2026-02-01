import { describe, expect, it, vi } from 'vitest';
import {
  deleteSnapshot,
  formatSnapshotSize,
  getSnapshot,
  getSnapshotExpirationInfo,
  isSnapshotValid,
  listSnapshots,
} from './snapshots';

// Mock the Vercel SDK
vi.mock('@vercel/sandbox', () => ({
  Snapshot: {
    get: vi.fn(),
    list: vi.fn(),
  },
}));

describe('getSnapshot', () => {
  it('should return snapshot when found', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const mockSnapshot = {
      snapshotId: 'snap-123',
      sourceSandboxId: 'sandbox-456',
      status: 'created' as const,
      sizeBytes: 1024000,
      createdAt: new Date('2024-01-01'),
      expiresAt: new Date('2024-01-08'),
    };
    vi.mocked(Snapshot.get).mockResolvedValue(mockSnapshot);

    const result = await getSnapshot('snap-123');
    expect(result).toEqual(mockSnapshot);
  });

  it('should return null when snapshot not found', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    vi.mocked(Snapshot.get).mockRejectedValue(new Error('Not found'));

    const result = await getSnapshot('snap-123');
    expect(result).toBeNull();
  });

  it('should handle deleted snapshot', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const mockSnapshot = {
      snapshotId: 'snap-123',
      sourceSandboxId: 'sandbox-456',
      status: 'deleted' as const,
      sizeBytes: 1024000,
      createdAt: new Date('2024-01-01'),
      expiresAt: new Date('2024-01-08'),
    };
    vi.mocked(Snapshot.get).mockResolvedValue(mockSnapshot);

    const result = await getSnapshot('snap-123');
    expect(result?.status).toBe('deleted');
  });

  it('should handle failed snapshot', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const mockSnapshot = {
      snapshotId: 'snap-123',
      sourceSandboxId: 'sandbox-456',
      status: 'failed' as const,
      sizeBytes: 0,
      createdAt: new Date('2024-01-01'),
      expiresAt: new Date('2024-01-08'),
    };
    vi.mocked(Snapshot.get).mockResolvedValue(mockSnapshot);

    const result = await getSnapshot('snap-123');
    expect(result?.status).toBe('failed');
  });
});

describe('listSnapshots', () => {
  it('should return list of snapshots', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const mockResponse = {
      json: {
        snapshots: [
          {
            id: 'snap-1',
            sourceSandboxId: 'sandbox-1',
            status: 'created',
            sizeBytes: 1024000,
            createdAt: Date.now(),
            expiresAt: Date.now() + 86400000,
          },
          {
            id: 'snap-2',
            sourceSandboxId: 'sandbox-2',
            status: 'created',
            sizeBytes: 2048000,
            createdAt: Date.now(),
            expiresAt: Date.now() + 86400000,
          },
        ],
        pagination: {},
      },
    };
    vi.mocked(Snapshot.list).mockResolvedValue(mockResponse);

    const result = await listSnapshots();
    expect(result.snapshots).toHaveLength(2);
    expect(result.snapshots[0].snapshotId).toBe('snap-1');
    expect(result.snapshots[1].snapshotId).toBe('snap-2');
    expect(result.hasMore).toBe(false);
  });

  it('should handle pagination with hasMore true', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const mockResponse = {
      json: {
        snapshots: [
          {
            id: 'snap-1',
            sourceSandboxId: 'sandbox-1',
            status: 'created',
            sizeBytes: 1024000,
            createdAt: Date.now(),
            expiresAt: Date.now() + 86400000,
          },
        ],
        pagination: { next: 'cursor-123' },
      },
    };
    vi.mocked(Snapshot.list).mockResolvedValue(mockResponse);

    const result = await listSnapshots();
    expect(result.hasMore).toBe(true);
  });

  it('should handle empty list', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const mockResponse = {
      json: {
        snapshots: [],
        pagination: {},
      },
    };
    vi.mocked(Snapshot.list).mockResolvedValue(mockResponse);

    const result = await listSnapshots();
    expect(result.snapshots).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it('should pass limit option', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const mockResponse = {
      json: {
        snapshots: [],
        pagination: {},
      },
    };
    vi.mocked(Snapshot.list).mockResolvedValue(mockResponse);

    await listSnapshots({ limit: 10 });
    expect(Snapshot.list).toHaveBeenCalledWith({ limit: 10 });
  });

  it('should pass since and until options', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const mockResponse = {
      json: {
        snapshots: [],
        pagination: {},
      },
    };
    vi.mocked(Snapshot.list).mockResolvedValue(mockResponse);

    const since = new Date('2024-01-01');
    const until = new Date('2024-01-31');
    await listSnapshots({ since, until });
    expect(Snapshot.list).toHaveBeenCalledWith({ since, until });
  });

  it('should return empty array on error', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    vi.mocked(Snapshot.list).mockRejectedValue(new Error('API error'));

    const result = await listSnapshots();
    expect(result.snapshots).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });
});

describe('deleteSnapshot', () => {
  it('should return true on successful deletion', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const mockSnapshot = {
      snapshotId: 'snap-123',
      delete: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(Snapshot.get).mockResolvedValue(mockSnapshot);

    const result = await deleteSnapshot('snap-123');
    expect(result).toBe(true);
    expect(mockSnapshot.delete).toHaveBeenCalled();
  });

  it('should return false when snapshot not found', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    vi.mocked(Snapshot.get).mockRejectedValue(new Error('Not found'));

    const result = await deleteSnapshot('snap-123');
    expect(result).toBe(false);
  });

  it('should return false on delete error', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const mockSnapshot = {
      snapshotId: 'snap-123',
      delete: vi.fn().mockRejectedValue(new Error('Delete failed')),
    };
    vi.mocked(Snapshot.get).mockResolvedValue(mockSnapshot);

    const result = await deleteSnapshot('snap-123');
    expect(result).toBe(false);
  });
});

describe('isSnapshotValid', () => {
  it('should return true for valid created snapshot', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const futureDate = new Date(Date.now() + 86400000);
    const mockSnapshot = {
      snapshotId: 'snap-123',
      sourceSandboxId: 'sandbox-456',
      status: 'created' as const,
      sizeBytes: 1024000,
      createdAt: new Date(),
      expiresAt: futureDate,
    };
    vi.mocked(Snapshot.get).mockResolvedValue(mockSnapshot);

    const result = await isSnapshotValid('snap-123');
    expect(result).toBe(true);
  });

  it('should return false for deleted snapshot', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const mockSnapshot = {
      snapshotId: 'snap-123',
      sourceSandboxId: 'sandbox-456',
      status: 'deleted' as const,
      sizeBytes: 1024000,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    };
    vi.mocked(Snapshot.get).mockResolvedValue(mockSnapshot);

    const result = await isSnapshotValid('snap-123');
    expect(result).toBe(false);
  });

  it('should return false for expired snapshot', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const pastDate = new Date(Date.now() - 86400000);
    const mockSnapshot = {
      snapshotId: 'snap-123',
      sourceSandboxId: 'sandbox-456',
      status: 'created' as const,
      sizeBytes: 1024000,
      createdAt: new Date(Date.now() - 172800000),
      expiresAt: pastDate,
    };
    vi.mocked(Snapshot.get).mockResolvedValue(mockSnapshot);

    const result = await isSnapshotValid('snap-123');
    expect(result).toBe(false);
  });

  it('should return false for failed snapshot', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    const mockSnapshot = {
      snapshotId: 'snap-123',
      sourceSandboxId: 'sandbox-456',
      status: 'failed' as const,
      sizeBytes: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    };
    vi.mocked(Snapshot.get).mockResolvedValue(mockSnapshot);

    const result = await isSnapshotValid('snap-123');
    expect(result).toBe(false);
  });

  it('should return false when snapshot not found', async () => {
    const { Snapshot } = await import('@vercel/sandbox');
    vi.mocked(Snapshot.get).mockRejectedValue(new Error('Not found'));

    const result = await isSnapshotValid('snap-123');
    expect(result).toBe(false);
  });
});

describe('getSnapshotExpirationInfo', () => {
  it('should return correct days and hours for future date', () => {
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000); // 3 days, 5 hours
    const result = getSnapshotExpirationInfo(expiresAt);

    expect(result.isExpired).toBe(false);
    expect(result.daysRemaining).toBe(3);
    expect(result.hoursRemaining).toBe(5);
  });

  it('should return expired true for past date', () => {
    const expiresAt = new Date(Date.now() - 86400000);
    const result = getSnapshotExpirationInfo(expiresAt);

    expect(result.isExpired).toBe(true);
    expect(result.daysRemaining).toBe(0);
    expect(result.hoursRemaining).toBe(0);
  });

  it('should return expired true for current time', () => {
    const expiresAt = new Date();
    const result = getSnapshotExpirationInfo(expiresAt);

    expect(result.isExpired).toBe(true);
  });

  it('should handle exactly 24 hours', () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const result = getSnapshotExpirationInfo(expiresAt);

    expect(result.isExpired).toBe(false);
    expect(result.daysRemaining).toBe(1);
    expect(result.hoursRemaining).toBe(0);
  });

  it('should handle less than 24 hours', () => {
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const result = getSnapshotExpirationInfo(expiresAt);

    expect(result.isExpired).toBe(false);
    expect(result.daysRemaining).toBe(0);
    expect(result.hoursRemaining).toBe(12);
  });
});

describe('formatSnapshotSize', () => {
  it('should format bytes correctly', () => {
    expect(formatSnapshotSize(512)).toBe('512 B');
    expect(formatSnapshotSize(0)).toBe('0 B');
  });

  it('should format kilobytes correctly', () => {
    expect(formatSnapshotSize(1024)).toBe('1.0 KB');
    expect(formatSnapshotSize(1536)).toBe('1.5 KB');
    expect(formatSnapshotSize(1024000)).toBe('1000.0 KB');
  });

  it('should format megabytes correctly', () => {
    expect(formatSnapshotSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSnapshotSize(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatSnapshotSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });

  it('should format gigabytes correctly', () => {
    expect(formatSnapshotSize(1024 * 1024 * 1024)).toBe('1.00 GB');
    expect(formatSnapshotSize(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
  });

  it('should handle edge cases', () => {
    expect(formatSnapshotSize(1023)).toBe('1023 B');
    expect(formatSnapshotSize(1024 * 1024 - 1)).toBe('1024.0 KB');
  });
});
