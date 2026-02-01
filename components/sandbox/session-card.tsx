'use client';

import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './status-badge';
import type { SandboxSession } from '@/types/sandbox';
import { ExternalLink, Clock, GitBranch, GitPullRequest, FileText } from 'lucide-react';

interface SessionCardProps {
  session: SandboxSession;
}

export function SessionCard({ session }: SessionCardProps) {
  const formattedDate = new Date(session.createdAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium truncate">
            {session.config.repoSlug}
          </CardTitle>
          <StatusBadge status={session.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>{formattedDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          <span className="truncate">{session.config.frontDir}</span>
        </div>
        {session.memo && (
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-xs line-clamp-2 text-muted-foreground/80">
              {session.memo}
            </p>
          </div>
        )}
        {session.prUrl && (
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-4 w-4" />
            <a 
              href={session.prUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline truncate flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              PR Link
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        {session.sandboxId && (
          <div className="text-xs font-mono bg-muted px-2 py-1 rounded truncate">
            {session.sandboxId}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2">
        <Link href={`/sandbox/${session.id}`} className="w-full">
          <Button variant="outline" className="w-full">
            View Details
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
