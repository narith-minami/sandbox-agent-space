'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'sidebar-pinned-groups';

export interface UsePinnedGroupsReturn {
  /** Check if a group is pinned */
  isPinned: (repoSlug: string) => boolean;
  /** Toggle the pinned state of a group */
  togglePin: (repoSlug: string) => void;
  /** All pinned repo slugs */
  pinnedGroups: string[];
}

/**
 * Hook to manage pinned groups in the sidebar with localStorage persistence.
 *
 * Groups can be pinned/unpinned and the state will persist across sessions.
 */
export function usePinnedGroups(): UsePinnedGroupsReturn {
  const [pinnedGroups, setPinnedGroups] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPinnedGroups(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load pinned groups from localStorage:', error);
    } finally {
      setInitialized(true);
    }
  }, []);

  // Save to localStorage whenever pinnedGroups changes (but only after initial load)
  useEffect(() => {
    if (!initialized) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedGroups));
    } catch (error) {
      console.error('Failed to save pinned groups to localStorage:', error);
    }
  }, [pinnedGroups, initialized]);

  const isPinned = useCallback(
    (repoSlug: string) => pinnedGroups.includes(repoSlug),
    [pinnedGroups]
  );

  const togglePin = useCallback((repoSlug: string) => {
    setPinnedGroups((prev) => {
      if (prev.includes(repoSlug)) {
        return prev.filter((slug) => slug !== repoSlug);
      }
      return [...prev, repoSlug];
    });
  }, []);

  return {
    isPinned,
    togglePin,
    pinnedGroups,
  };
}
