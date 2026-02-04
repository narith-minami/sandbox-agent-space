import type { PrStatus } from '@/types/sandbox';

interface PullRequestIdentifier {
  owner: string;
  repo: string;
  number: number;
}

export function parsePullRequestUrl(prUrl: string): PullRequestIdentifier | null {
  try {
    const url = new URL(prUrl);
    if (url.hostname !== 'github.com') return null;

    const [owner, repo, marker, number] = url.pathname.split('/').filter(Boolean);
    if (!owner || !repo || marker !== 'pull' || !number) return null;

    const prNumber = Number.parseInt(number, 10);
    if (Number.isNaN(prNumber)) return null;

    return { owner, repo, number: prNumber };
  } catch {
    return null;
  }
}

export async function fetchPrStatus(prUrl: string, accessToken: string): Promise<PrStatus | null> {
  const identifier = parsePullRequestUrl(prUrl);
  if (!identifier) return null;

  const response = await fetch(
    `https://api.github.com/repos/${identifier.owner}/${identifier.repo}/pulls/${identifier.number}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'sandbox-agent-space',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    state: 'open' | 'closed';
    merged_at: string | null;
  };

  if (data.merged_at) return 'merged';
  if (data.state === 'open') return 'open';
  return 'closed';
}
