'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBreakpoint } from './use-media-query';

/**
 * Default breakpoint for sidebar auto-collapse behavior.
 * Sidebar will be open by default on lg (1024px) and above,
 * and collapsed on smaller screens.
 */
const DEFAULT_BREAKPOINT = 'lg' as const;

export interface UseResponsiveSidebarOptions {
  /**
   * The breakpoint at which the sidebar should auto-open.
   * Below this breakpoint, sidebar will be collapsed by default.
   * @default 'lg'
   */
  breakpoint?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /**
   * Initial open state override (optional).
   * If not provided, the initial state is determined by the breakpoint.
   */
  defaultOpen?: boolean;
}

export interface UseResponsiveSidebarReturn {
  /** Whether the sidebar is currently open */
  isOpen: boolean;
  /** Toggle the sidebar open/closed state */
  toggle: () => void;
  /** Explicitly open the sidebar */
  open: () => void;
  /** Explicitly close the sidebar */
  close: () => void;
  /** Whether the viewport is above the responsive breakpoint */
  isDesktop: boolean;
}

/**
 * Hook to manage sidebar open/close state with responsive behavior.
 *
 * The sidebar will automatically:
 * - Open when the viewport expands above the breakpoint
 * - Close when the viewport shrinks below the breakpoint
 *
 * Manual toggles are preserved until the next resize crosses the breakpoint.
 */
export function useResponsiveSidebar(
  options: UseResponsiveSidebarOptions = {}
): UseResponsiveSidebarReturn {
  const { breakpoint = DEFAULT_BREAKPOINT, defaultOpen } = options;
  const isDesktop = useBreakpoint(breakpoint);

  // Initialize state based on defaultOpen if provided, otherwise use breakpoint detection
  const [isOpen, setIsOpen] = useState(() => {
    if (defaultOpen !== undefined) {
      return defaultOpen;
    }
    // SSR fallback: assume desktop on server
    return true;
  });

  // Track if this is the initial mount to handle SSR hydration
  const [hasMounted, setHasMounted] = useState(false);

  // Sync with breakpoint changes after mount
  useEffect(() => {
    if (!hasMounted) {
      setHasMounted(true);
      // Set initial state based on actual viewport on first mount
      if (defaultOpen === undefined) {
        setIsOpen(isDesktop);
      }
      return;
    }

    // After mount, auto-adjust based on breakpoint changes
    setIsOpen(isDesktop);
  }, [isDesktop, hasMounted, defaultOpen]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    toggle,
    open,
    close,
    isDesktop,
  };
}
