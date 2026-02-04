'use client';

import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Control, UseFormSetValue } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGitHubBranches } from '@/hooks/use-github-branches';
import { useGitHubRepos } from '@/hooks/use-github-repos';
import { cn } from '@/lib/utils';
import type { SandboxConfigFormData } from '../config-form';

interface RepositorySectionProps {
  control: Control<SandboxConfigFormData>;
  setValue: UseFormSetValue<SandboxConfigFormData>;
}

interface LoginUrlError {
  loginUrl?: string;
}

function getLoginUrl(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  if (!('loginUrl' in error)) return null;
  const loginUrl = (error as LoginUrlError).loginUrl;
  return typeof loginUrl === 'string' ? loginUrl : null;
}

export function RepositorySection({ control, setValue }: RepositorySectionProps) {
  const { data: repos = [], isLoading: reposLoading, error: reposError } = useGitHubRepos();
  const repoUrl = useWatch({ control, name: 'repoUrl' });

  const [selectedRepo, setSelectedRepo] = useState<{
    owner: string;
    repo: string;
    defaultBranch: string;
  } | null>(null);

  const {
    data: branches = [],
    isLoading: branchesLoading,
    error: branchesError,
  } = useGitHubBranches({
    owner: selectedRepo?.owner || '',
    repo: selectedRepo?.repo || '',
    enabled: !!selectedRepo,
  });

  useEffect(() => {
    if (!repos.length || !repoUrl || selectedRepo) return;
    const initialRepo = repos.find((repo) => repo.htmlUrl === repoUrl);
    if (!initialRepo) return;
    setSelectedRepo({
      owner: initialRepo.owner,
      repo: initialRepo.name,
      defaultBranch: initialRepo.defaultBranch,
    });
  }, [repoUrl, repos, selectedRepo]);

  useEffect(() => {
    const loginUrl = getLoginUrl(reposError) || getLoginUrl(branchesError);
    if (loginUrl) {
      window.location.href = loginUrl;
    }
  }, [branchesError, reposError]);

  return (
    <div className='space-y-4 p-4 border rounded-lg bg-muted/30'>
      <h3 className='font-semibold text-sm'>Repository Information</h3>

      {/* Repository Selector */}
      <FormField
        control={control}
        name='repoUrl'
        render={({ field }) => (
          <FormItem className='flex flex-col'>
            <FormLabel>
              Repository <span className='text-destructive'>*</span>
            </FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant='outline'
                    role='combobox'
                    className={cn(
                      'w-full justify-between',
                      !field.value && 'text-muted-foreground'
                    )}
                    disabled={reposLoading}
                  >
                    {reposLoading ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        Loading repositories...
                      </>
                    ) : field.value ? (
                      repos.find((repo) => repo.htmlUrl === field.value)?.fullName ||
                      'Select repository'
                    ) : (
                      'Select repository'
                    )}
                    <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className='w-full p-0' align='start'>
                <Command>
                  <CommandInput placeholder='Search repositories...' />
                  <CommandList>
                    <CommandEmpty>
                      {reposError instanceof Error ? reposError.message : 'No repositories found.'}
                    </CommandEmpty>
                    <CommandGroup>
                      {repos.map((repo) => (
                        <CommandItem
                          key={repo.id}
                          value={repo.fullName}
                          onSelect={() => {
                            field.onChange(repo.htmlUrl);
                            // Also update repoSlug and baseBranch fields
                            setValue('repoSlug', repo.fullName);
                            setValue('baseBranch', repo.defaultBranch);
                            // Update selected repo for branches
                            setSelectedRepo({
                              owner: repo.owner,
                              repo: repo.name,
                              defaultBranch: repo.defaultBranch,
                            });
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              repo.htmlUrl === field.value ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className='flex flex-col'>
                            <span className='font-medium'>{repo.fullName}</span>
                            {repo.description && (
                              <span className='text-xs text-muted-foreground line-clamp-1'>
                                {repo.description}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <FormDescription>
              Select a GitHub repository from your accessible repositories
            </FormDescription>
          </FormItem>
        )}
      />

      {/* Branch Selector */}
      <FormField
        control={control}
        name='baseBranch'
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Base Branch <span className='text-destructive'>*</span>
            </FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value}
              disabled={!selectedRepo || branchesLoading}
            >
              <FormControl>
                <SelectTrigger>
                  {branchesLoading ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Loading branches...
                    </>
                  ) : (
                    <SelectValue placeholder='Select branch' />
                  )}
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.name} value={branch.name}>
                    {branch.name}
                    {branch.protected && (
                      <span className='ml-2 text-xs text-muted-foreground'>(protected)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              Git branch to clone (default: {selectedRepo?.defaultBranch || 'main'})
            </FormDescription>
          </FormItem>
        )}
      />

      {/* Hidden field for repoSlug - auto-populated */}
      <FormField
        control={control}
        name='repoSlug'
        render={({ field }) => <input type='hidden' {...field} />}
      />
    </div>
  );
}
