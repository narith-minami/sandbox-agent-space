import { describe, expect, it } from 'vitest';
import type { SessionStatus, VercelSandboxStatus } from '@/types/sandbox';
import { isTerminalStatus, mapVercelStatus } from './status-mapper';

describe('status-mapper', () => {
  describe('mapVercelStatus', () => {
    it('should map pending status', () => {
      expect(mapVercelStatus('pending')).toBe('pending');
    });

    it('should map running status', () => {
      expect(mapVercelStatus('running')).toBe('running');
    });

    it('should map stopping status', () => {
      expect(mapVercelStatus('stopping')).toBe('stopping');
    });

    it('should map stopped to completed', () => {
      expect(mapVercelStatus('stopped')).toBe('completed');
    });

    it('should map failed status', () => {
      expect(mapVercelStatus('failed')).toBe('failed');
    });

    it('should map snapshotting to running', () => {
      expect(mapVercelStatus('snapshotting')).toBe('running');
    });

    it('should return pending for unknown status', () => {
      expect(mapVercelStatus('unknown' as VercelSandboxStatus)).toBe('pending');
    });
  });

  describe('isTerminalStatus', () => {
    it('should return true for completed status', () => {
      expect(isTerminalStatus('completed')).toBe(true);
    });

    it('should return true for failed status', () => {
      expect(isTerminalStatus('failed')).toBe(true);
    });

    it('should return false for pending status', () => {
      expect(isTerminalStatus('pending')).toBe(false);
    });

    it('should return false for running status', () => {
      expect(isTerminalStatus('running')).toBe(false);
    });

    it('should return false for stopping status', () => {
      expect(isTerminalStatus('stopping')).toBe(false);
    });

    it('should handle all non-terminal states', () => {
      const nonTerminalStatuses: SessionStatus[] = ['pending', 'running', 'stopping'];
      for (const status of nonTerminalStatuses) {
        expect(isTerminalStatus(status)).toBe(false);
      }
    });
  });
});
