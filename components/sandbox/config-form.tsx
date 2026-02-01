'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ChevronDown } from 'lucide-react';
import { useState } from 'react';

// Runtime options with descriptions
const RUNTIME_OPTIONS = [
  { value: 'node24', label: 'Node.js 24', description: 'Latest Node.js with modern features' },
  { value: 'node22', label: 'Node.js 22 LTS', description: 'Long-term support version' },
  { value: 'python3.13', label: 'Python 3.13', description: 'Latest Python runtime' },
] as const;

// Form schema for react-hook-form
const formSchema = z.object({
  planSource: z.enum(['file', 'text']),
  planFile: z.string(),
  planText: z.string(),
  repoUrl: z.string(),
  repoSlug: z.string(),
  baseBranch: z.string(),
  memo: z.string().optional(),
  gistUrl: z.string(),
  frontDir: z.string(),
  githubToken: z.string(),
  opencodeAuthJsonB64: z.string(),
  runtime: z.enum(['node24', 'node22', 'python3.13']),
  snapshotId: z.string().optional(),
  enableCodeReview: z.boolean(),
}).refine(
  (data) => {
    // Validate that either planFile or planText is provided based on planSource
    if (data.planSource === 'file') {
      return data.planFile && data.planFile.length > 0;
    } else {
      return data.planText && data.planText.length > 0;
    }
  },
  {
    message: 'Plan is required (either file path or text content)',
    path: ['planFile'],
  }
);

export type SandboxConfigFormData = z.infer<typeof formSchema>;

interface ConfigFormProps {
  onSubmit: (data: SandboxConfigFormData) => void;
  isLoading?: boolean;
  defaultValues?: Partial<SandboxConfigFormData>;
  commonConfig?: {
    githubToken?: string;
    opencodeAuthJsonB64?: string;
    gistUrl?: string;
  };
}

export function ConfigForm({ onSubmit, isLoading = false, defaultValues, commonConfig }: ConfigFormProps) {
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  
  const form = useForm<SandboxConfigFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      planSource: 'file',
      planFile: '',
      planText: '',
      repoUrl: '',
      repoSlug: '',
      baseBranch: 'main',
      memo: '',
      gistUrl: commonConfig?.gistUrl || '',
      frontDir: 'frontend',
      githubToken: commonConfig?.githubToken || '',
      opencodeAuthJsonB64: commonConfig?.opencodeAuthJsonB64 || '',
      runtime: 'node24',
      snapshotId: '',
      enableCodeReview: false,
      ...defaultValues,
    },
  });

  const selectedRuntime = form.watch('runtime');
  const snapshotId = form.watch('snapshotId');
  const planSource = form.watch('planSource');
  
  // Check if common config provides the required values
  const hasCommonGithubToken = !!(commonConfig?.githubToken || form.watch('githubToken'));
  const hasCommonOpencode = !!(commonConfig?.opencodeAuthJsonB64 || form.watch('opencodeAuthJsonB64'));
  const hasCommonGistUrl = !!(commonConfig?.gistUrl || form.watch('gistUrl'));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sandbox Configuration</CardTitle>
        <CardDescription>
          Configure the coding agent sandbox with your repository settings.
          Powered by Vercel Sandbox SDK for isolated microVM execution.
          <br />
          <span className="text-sm text-muted-foreground mt-1">
            Pull Request URLs will be automatically detected from sandbox logs.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 1. Plan Source - TOP PRIORITY */}
            {!snapshotId && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="planSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Plan Source</FormLabel>
                      <FormControl>
                        <Tabs
                          value={field.value}
                          onValueChange={(value) => field.onChange(value as 'file' | 'text')}
                          className="w-full"
                        >
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="file">Use Repository File</TabsTrigger>
                            <TabsTrigger value="text">Enter Text Directly</TabsTrigger>
                          </TabsList>
                          <TabsContent value="file" className="mt-4">
                            <FormField
                              control={form.control}
                              name="planFile"
                              render={({ field: planField }) => (
                                <FormItem>
                                  <FormLabel>Plan File Path</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="docs/plan.md" 
                                      {...planField} 
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Path to the plan file in your repository (e.g., docs/plan.md)
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TabsContent>
                          <TabsContent value="text" className="mt-4">
                            <FormField
                              control={form.control}
                              name="planText"
                              render={({ field: textField }) => (
                                <FormItem>
                                  <FormLabel>Plan Text</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="Enter your plan content here in Markdown format..."
                                      rows={10}
                                      className="font-mono text-sm"
                                      {...textField} 
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Your plan content will be saved as a Markdown file in the sandbox
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TabsContent>
                        </Tabs>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* 2. Repository Information */}
            {!snapshotId && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="font-semibold text-sm">Repository Information</h3>
                
                <FormField
                  control={form.control}
                  name="repoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repository URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://github.com/owner/repo" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        GitHub repository URL - will be cloned using SDK git source
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="repoSlug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repository Slug</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="owner/repo" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Repository identifier in owner/repo format
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="baseBranch"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Branch</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="main" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Git branch to clone (default: main)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* 3. Memo Field */}
            <FormField
              control={form.control}
              name="memo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Memo (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add notes about this sandbox session..."
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Optional notes or description for this sandbox session
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 4. Optional Advanced Settings - Collapsible */}
            <Collapsible open={showOptionalFields} onOpenChange={setShowOptionalFields}>
              <CollapsibleTrigger asChild>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full justify-between"
                >
                  <span>Advanced Settings (Optional)</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showOptionalFields ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                {/* Runtime Selection */}
                <FormField
                  control={form.control}
                  name="runtime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Runtime Environment</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-3 gap-2">
                          {RUNTIME_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => field.onChange(option.value)}
                              className={`p-3 border rounded-lg text-left transition-all ${
                                field.value === option.value
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <div className="font-medium text-sm">{option.label}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {option.description}
                              </div>
                            </button>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Snapshot ID */}
                <FormField
                  control={form.control}
                  name="snapshotId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Snapshot ID</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="snap_..." 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Create sandbox from a saved snapshot for faster startup
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Gist URL */}
                {!snapshotId && (
                  <FormField
                    control={form.control}
                    name="gistUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Gist URL
                          {hasCommonGistUrl && <span className="ml-2 text-xs text-green-600">(Using common config)</span>}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={commonConfig?.gistUrl || "https://gist.githubusercontent.com/..."} 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Raw URL of the Gist containing the execution script
                          {hasCommonGistUrl && ' (override common config if needed)'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Frontend Directory */}
                {!snapshotId && (
                  <FormField
                    control={form.control}
                    name="frontDir"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frontend Directory</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="frontend" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Directory containing frontend code
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* GitHub Token */}
                <FormField
                  control={form.control}
                  name="githubToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        GitHub Token
                        {hasCommonGithubToken && <span className="ml-2 text-xs text-green-600">(Using common config)</span>}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          placeholder={hasCommonGithubToken ? "••••••••" : "ghp_..."} 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Personal access token with repo permissions
                        {hasCommonGithubToken && ' (leave empty to use common config)'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* OpenCode Auth */}
                <FormField
                  control={form.control}
                  name="opencodeAuthJsonB64"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        OpenCode Auth JSON (Base64)
                        {hasCommonOpencode && <span className="ml-2 text-xs text-green-600">(Using common config)</span>}
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={hasCommonOpencode ? "••••••••" : "eyJ..."} 
                          className="font-mono text-sm"
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Base64-encoded authentication JSON for OpenCode
                        {hasCommonOpencode && ' (leave empty to use common config)'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Code Review Checkbox */}
                <FormField
                  control={form.control}
                  name="enableCodeReview"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Enable Code Review
                        </FormLabel>
                        <FormDescription>
                          Run code review step after execution (default: disabled)
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Submit Button */}
            <div className="pt-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Sandbox...
                  </>
                ) : (
                  <>
                    Start Sandbox
                    {selectedRuntime && (
                      <span className="ml-2 text-xs opacity-75">
                        ({RUNTIME_OPTIONS.find(r => r.value === selectedRuntime)?.label})
                      </span>
                    )}
                  </>
                )}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              Sandbox will run in an isolated Linux microVM on Vercel infrastructure
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
