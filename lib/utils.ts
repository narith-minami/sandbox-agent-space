import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts the repository name from a full "org/repo" slug.
 * @param slug - The full repository slug in "org/repo" format
 * @returns The repository name only (without the org prefix)
 */
export function extractRepoName(slug: string): string {
  const parts = slug.split('/');
  return parts.length >= 2 ? parts[parts.length - 1] : slug;
}
