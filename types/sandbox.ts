import type { SandboxRuntime } from '@/lib/sandbox/auth';

// Sandbox configuration types
export interface SandboxConfig {
  gistUrl: string;
  repoUrl: string;
  repoSlug: string;
  baseBranch: string;
  frontDir: string;
  // Plan source: either file path or direct text
  planFile: string;
  planText: string;
  planSource: 'file' | 'text';
  githubToken: string;
  opencodeAuthJsonB64: string;
  // New: runtime selection
  runtime?: SandboxRuntime;
  // New: optional snapshot ID to create from
  snapshotId?: string;
}

// Session status types - aligned with Vercel Sandbox SDK status
export type SessionStatus = 'pending' | 'running' | 'stopping' | 'completed' | 'failed';

// Vercel Sandbox status (from SDK)
export type VercelSandboxStatus =
  | 'pending'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | 'snapshotting';

// Log entry types
export type LogLevel = 'info' | 'error' | 'debug' | 'stdout' | 'stderr';

export interface LogEntry {
  id: string;
  sessionId: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

// Session types
export interface SandboxSession {
  id: string;
  sandboxId: string | null;
  status: SessionStatus;
  config: SandboxConfig;
  runtime: SandboxRuntime;
  prUrl?: string | null; // Pull Request URL
  memo?: string | null; // Optional memo/notes
  archived?: boolean; // Archive flag
  createdAt: Date;
  updatedAt: Date;
}

export interface SandboxSessionWithLogs extends SandboxSession {
  logs: LogEntry[];
}

// Snapshot types
export interface SnapshotRecord {
  id: string;
  snapshotId: string;
  sessionId: string;
  sourceSandboxId: string;
  status: 'created' | 'deleted' | 'failed';
  sizeBytes: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface SnapshotSummary {
  snapshotId: string;
  sourceSandboxId: string;
  status: 'created' | 'deleted' | 'failed';
  sizeBytes: number;
  createdAt: Date;
  expiresAt: Date;
}

// API response types
export interface CreateSandboxResponse {
  sessionId: string;
  sandboxId: string;
  runtime: SandboxRuntime;
}

export interface SessionListResponse {
  sessions: SandboxSession[];
  total: number;
  page: number;
  limit: number;
}

export interface SnapshotListResponse {
  snapshots: SnapshotSummary[];
  total: number;
}

export interface CreateSnapshotResponse {
  snapshotId: string;
  sessionId: string;
  sourceSandboxId: string;
  expiresAt: Date;
}

// Sandbox status response with real-time data from Vercel SDK
export interface SandboxStatusResponse {
  sessionId: string;
  sandboxId: string | null;
  status: SessionStatus;
  vercelStatus?: VercelSandboxStatus;
  timeout?: number;
  createdAt: Date;
  updatedAt: Date;
}

// API error types
export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

// Git source configuration for Vercel Sandbox
export interface GitSourceConfig {
  type: 'git';
  url: string;
  username: string;
  password: string;
  depth?: number;
  revision?: string;
}

// Snapshot source configuration for Vercel Sandbox
export interface SnapshotSourceConfig {
  type: 'snapshot';
  snapshotId: string;
}

// Union type for sandbox source
export type SandboxSource = GitSourceConfig | SnapshotSourceConfig;

// Sandbox creation options for the manager
export interface SandboxCreateOptions {
  sessionId: string;
  config: SandboxConfig;
  runtime: SandboxRuntime;
  source: SandboxSource;
  timeout?: number;
  env?: Record<string, string>;
  command?: string;
  args?: string[];
  cwd?: string;
  planText?: string;
  planFilePath?: string;
}

// Command execution options
export interface CommandOptions {
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  sudo?: boolean;
  detached?: boolean;
}

// Log stream entry from Vercel Sandbox SDK
export interface StreamLogEntry {
  stream: 'stdout' | 'stderr';
  data: string;
}
