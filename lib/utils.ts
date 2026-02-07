import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { SandboxSession } from '@/types/sandbox';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts the repository name from a full "org/repo" slug.
 * @param slug - The full repository slug in "org/repo" format
 * @returns The repository name only (without the org prefix)
 */
export function extractRepoName(slug: string): string {
  const parts = slug.split('/').filter(Boolean);
  return parts.pop() || slug;
}

/**
 * Formats a duration in milliseconds to a human-readable string
 * @param durationMs - Duration in milliseconds
 * @returns Formatted duration string (e.g., "2h 30m", "45m", "30s")
 */
export function formatDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  } else if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Calculates and formats the duration between two dates
 * @param startDate - Start date
 * @param endDate - End date (defaults to current time if not provided)
 * @returns Formatted duration string
 */
export function calculateSessionDuration(startDate: Date, endDate?: Date | null): string {
  const end = endDate || new Date();
  const durationMs = end.getTime() - startDate.getTime();
  return formatDuration(durationMs);
}

/**
 * Resolves the repository slug from a session configuration
 * @param session - The sandbox session
 * @returns The repository slug in "owner/repo" format
 */
export function resolveRepoSlug(session: SandboxSession): string {
  if (session.config.repoSlug) return session.config.repoSlug;

  if (session.config.repoUrl) {
    try {
      const url = new URL(session.config.repoUrl);
      const [owner, repo] = url.pathname.split('/').filter(Boolean);
      if (owner && repo) return `${owner}/${repo}`;
    } catch {
      return 'unknown/repo';
    }
  }

  return 'unknown/repo';
}
