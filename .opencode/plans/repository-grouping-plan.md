# Implementation Plan: Group Session List by Repository

## Overview
Change the sidebar session list UI to group sessions by repository, with collapsible groups. Each group shows the repository name as header and contains all sessions for that repository.

## Current State Analysis
- Sessions are stored in `sessions` table with `config` JSONB containing `repoSlug`
- Current `SessionList` component renders sessions as a flat list
- Each `SessionListItem` displays repository name (truncated) and session details
- Sidebar uses `Collapsible` component for filters section

## Implementation Steps

### 1. Create Repository Group Component
- Create `components/sidebar/repo-group.tsx`
- Use `Collapsible` component with repository name as trigger
- Show session count in group header
- Default to open state for all groups
- Support compact mode (no grouping in compact view)

### 2. Modify SessionList Component
- Group sessions by `session.config.repoSlug`
- For each group, render `RepoGroup` component
- Sort groups by most recent session (latest `createdAt` or `updatedAt`)
- Within each group, sort sessions by `createdAt` descending
- Handle compact mode: show flat list without grouping when `compact=true`

### 3. Update Grouping Logic
- Extract `resolveRepoSlug` function from `SessionListItem` to shared utility
- Handle edge cases: sessions without `repoSlug` go to "Other" group
- Ensure grouping works with existing filters (status, PR status, archived)

### 4. UI/UX Considerations
- Group headers: Show full repo name (e.g., "owner/repo") or just repo name?
- Icons: Use folder/git icon for group headers
- Colors: Use muted colors for group headers to distinguish from session items
- Animation: Smooth expand/collapse with existing Collapsible styling

### 5. Compact Mode Handling
- When `compact=true` (sidebar collapsed), show flat session list
- No grouping in compact mode to save space
- Session items show status icons only in compact mode

### 6. Testing
- Test grouping with multiple repositories
- Test expand/collapse functionality
- Test compact mode behavior
- Test with filters applied
- Test edge cases (no repoSlug, single session per repo)

### 7. Code Quality
- Follow existing TypeScript patterns
- Add proper JSDoc comments
- Ensure accessibility (proper ARIA labels for collapsible groups)
- Run `pnpm lint` and `pnpm typecheck` after implementation

## Files to Modify
- `components/sidebar/session-list.tsx` - Add grouping logic
- `components/sidebar/repo-group.tsx` - New component for repository groups
- `lib/utils.ts` - Extract `resolveRepoSlug` utility if needed

## Potential Challenges
- Sorting groups by most recent session requires efficient grouping
- Handling compact mode without duplicating too much code
- Ensuring performance with large number of sessions/groups</content>
<parameter name="filePath">.opencode/plans/repository-grouping-plan.md