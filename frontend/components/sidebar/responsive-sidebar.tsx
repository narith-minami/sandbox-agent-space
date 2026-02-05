'use client';

import type { ReactNode } from 'react';
import { useResponsiveSidebar } from '../../hooks/use-responsive-sidebar';

export interface ResponsiveSidebarProps {
  /** Content to display in the sidebar */
  children?: ReactNode;
  /** Title to display in the sidebar header */
  title?: string;
  /** Breakpoint at which to auto-expand the sidebar */
  breakpoint?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

/**
 * A responsive sidebar component that automatically opens/closes
 * based on browser window size.
 *
 * - On desktop (lg and above by default): Sidebar is expanded
 * - On mobile/tablet: Sidebar is collapsed
 *
 * Users can manually toggle the sidebar state, which will be
 * preserved until the window is resized across the breakpoint.
 */
export function ResponsiveSidebar({
  children,
  title = 'Menu',
  breakpoint = 'lg',
}: ResponsiveSidebarProps) {
  const { isOpen, toggle, isDesktop } = useResponsiveSidebar({ breakpoint });

  return (
    <aside
      data-state={isOpen ? 'open' : 'closed'}
      data-desktop={isDesktop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRight: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        transition: 'width 200ms ease-in-out',
        width: isOpen ? '288px' : '56px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid #e5e7eb',
          padding: isOpen ? '12px' : '12px 8px',
        }}
      >
        {isOpen && (
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {title}
          </span>
        )}
        <button
          type='button'
          onClick={toggle}
          title={isOpen ? 'Close sidebar' : 'Open sidebar'}
          style={{
            marginLeft: isOpen ? 'auto' : '0',
            marginRight: isOpen ? '0' : 'auto',
            padding: '4px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
          }}
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={isOpen}
        >
          <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            aria-hidden='true'
            style={{
              transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 200ms ease-in-out',
            }}
          >
            <path d='M15 18l-6-6 6-6' />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: isOpen ? '12px' : '8px',
        }}
      >
        {isOpen ? (
          children
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {/* Collapsed state indicator */}
            <div
              style={{
                width: '40px',
                height: '4px',
                backgroundColor: '#e5e7eb',
                borderRadius: '2px',
              }}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
