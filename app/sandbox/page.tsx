import { redirect } from 'next/navigation';

interface SandboxPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SandboxPage({ searchParams }: SandboxPageProps) {
  const params = (await searchParams) || {};
  const clone = params.clone;
  const cloneValue = Array.isArray(clone) ? clone[0] : clone;
  const query = cloneValue ? `?clone=${encodeURIComponent(cloneValue)}` : '';
  redirect(`/${query}`);
}
