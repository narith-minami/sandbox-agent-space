# Implementation Plan: Group Session List by Repository

## Overview
Change the sidebar session list from a flat list to a grouped, collapsible UI organized by repository. Each repository group can be expanded/collapsed, with sessions listed underneath.

## Current State
- Sessions are displayed in a flat list in `SessionList` component
- Each session shows repository name extracted from `session.config.repoSlug`
- No grouping or organization by repository
- Sessions are fetched via `useSidebarSessions` hook and filtered client-side

## Target State
- Sessions grouped by repository in collapsible sections
- Repository headers show repo name and session count
- Groups sorted alphabetically by repository name
- All existing functionality preserved (filters, archive, compact mode, etc.)

## Implementation Steps

### 1. Create Repository Group Component
**File:** `components/sidebar/repository-group.tsx` (new)

**Purpose:** Reusable component for each repository group with collapsible behavior.

**Features:**
- Collapsible trigger with repository name and session count
- Chevron icon indicating open/closed state
- Collapsible content containing session list
- Support for compact mode (collapsed sidebar)

**API:**
```typescript
interface RepositoryGroupProps {
  repoSlug: string;
  sessions: SandboxSession[];
  compact?: boolean;
  onArchiveOptimistic?: (sessionId: string) => void;
  defaultOpen?: boolean;
}
```

### 2. Modify SessionList Component
**File:** `components/sidebar/session-list.tsx`

**Changes:**
- Import and use `RepositoryGroup` component
- Group sessions by `repoSlug` using `useMemo`
- Sort repository groups alphabetically
- Handle loading states (show skeleton groups)
- Handle empty states per group
- Preserve compact mode logic

**Grouping Logic:**
```typescript
const groupedSessions = useMemo(() => {
  const groups = sessions.reduce((acc, session) => {
    const repoSlug = resolveRepoSlug(session);
    if (!acc[repoSlug]) acc[repoSlug] = [];
    acc[repoSlug].push(session);
    return acc;
  }, {} as Record<string, SandboxSession[]>);
  
  // Sort repositories alphabetically
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([repoSlug, sessions]) => ({ repoSlug, sessions }));
}, [sessions]);
```

### 3. Update Repository Resolution
**Enhance `resolveRepoSlug` function in `SessionListItem`**
- Move to shared utility if needed
- Ensure consistent repository identification across components

### 4. Handle Compact Mode
**In RepositoryGroup:**
- When `compact=true`, show collapsed groups with repo initials or icon
- Maintain collapsible behavior even in compact mode
- Show session count as badge

### 5. Preserve Existing Features
- All filters (status, PR status, archived) work as before
- Archive functionality remains intact
- Optimistic UI updates for archiving
- Loading states and skeletons
- Responsive behavior (desktop/mobile)

### 6. UI/UX Considerations
- Repository headers: Use `Folder` or `GitBranch` icon from lucide-react
- Default state: First repository group open, others closed
- Visual hierarchy: Clear distinction between groups and individual sessions
- Accessibility: Proper ARIA labels for collapsible regions

## Files to Modify
1. `components/sidebar/session-list.tsx` - Main grouping logic
2. `components/sidebar/repository-group.tsx` - New group component
3. Potentially `components/sidebar/session-list-item.tsx` - Extract repo resolution utility

## Files to Create
1. `components/sidebar/repository-group.tsx`

## Testing
- Verify grouping works with multiple repositories
- Test collapsible behavior
- Ensure filters still work correctly
- Check compact mode functionality
- Test archive functionality within groups
- Verify loading and empty states

## Edge Cases
- Sessions with missing or invalid repoSlug
- Single repository with multiple sessions
- Empty groups (shouldn't occur but handle gracefully)
- Very long repository names (truncation)
- Sessions from same repo with different branches (group by repoSlug, not branch)

## Rollback Plan
- Changes are isolated to SessionList component
- Can revert to flat list by modifying SessionList render logic
- No database schema changes required</content>
<parameter name="filePath">.opencode/plans/repository-grouping-session-list.md