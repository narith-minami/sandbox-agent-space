import { requireGitHubSession } from '@/lib/auth/require-github-session';

interface HistoryLayoutProps {
  children: React.ReactNode;
}

export default async function HistoryLayout({ children }: HistoryLayoutProps) {
  await requireGitHubSession('/history');
  return <>{children}</>;
}
