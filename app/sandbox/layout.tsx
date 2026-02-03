import { requireGitHubSession } from '@/lib/auth/require-github-session';

interface SandboxLayoutProps {
  children: React.ReactNode;
}

export default async function SandboxLayout({ children }: SandboxLayoutProps) {
  await requireGitHubSession('/sandbox');
  return <>{children}</>;
}
