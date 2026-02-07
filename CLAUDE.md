# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
pnpm run dev              # Start dev server (localhost:3000)
pnpm run build            # Production build
pnpm run typecheck        # TypeScript type checking
```

### Testing
```bash
pnpm run test             # Run tests in watch mode
pnpm test:coverage        # Run tests with coverage report
pnpm run test -- path/to/file.test.ts  # Run specific test file
```

### Code Quality
```bash
pnpm run check            # Lint & format (write mode)
pnpm run ci               # Lint & format (check mode)
pnpm run ci:all           # Full CI pipeline (lint, typecheck, build, test)
```

### Database
```bash
pnpm run db:push          # Apply schema changes to database
pnpm run db:generate      # Generate migration after schema changes
pnpm run db:studio        # Open Drizzle Studio (database GUI)
```

### Vercel Auth Setup (Local Dev)
```bash
vercel link               # Link to Vercel project (first time only)
vercel env pull           # Pull OIDC token to .env.local
```

## Architecture Overview

### Core Concepts

This is a **Vercel Sandbox SDK integration** app that creates isolated Linux microVMs for running agent tasks. Sessions are tracked in PostgreSQL, logs are streamed in real-time via SSE, and snapshots enable reproducible environments.

### Key Layers

1. **App Router (`app/`)** - Next.js 16 pages and API routes
2. **Sandbox Layer (`lib/sandbox/`)** - Vercel SDK integration and lifecycle management
3. **Database Layer (`lib/db/`)** - Drizzle ORM with PostgreSQL
4. **API Layer (`lib/api/`)** - Request validators and config builders
5. **Components (`components/`)** - React components (shadcn/ui based)
6. **Hooks (`hooks/`)** - TanStack Query hooks for API calls

### Sandbox Architecture

The sandbox system is decomposed into specialized services:

- **SandboxManager** (`lib/sandbox/manager.ts`) - Main facade coordinating all services
- **SandboxLifecycleManager** (`lib/sandbox/sandbox-lifecycle-manager.ts`) - Create, execute, stop sandboxes
- **LogStreamService** (`lib/sandbox/log-stream-service.ts`) - Stream logs and detect PR URLs
- **SandboxFileService** (`lib/sandbox/sandbox-file-service.ts`) - File operations (read/write)
- **SnapshotService** (`lib/sandbox/snapshot-service.ts`) - Create and manage snapshots

**Active sandbox tracking**: `activeSandboxes` Map in `SandboxLifecycleManager` stores running Sandbox instances by sessionId for log streaming and management.

### Database Schema (`lib/db/schema.ts`)

Key tables:
- **sessions** - Sandbox execution sessions (status, config, runtime, PR info, memo, archive flag)
- **logs** - Timestamped log entries (linked to sessions)
- **snapshots** - Vercel snapshot metadata (expires in 7 days)
- **environmentPresets** - User-defined environment configs
- **userSettings** - Per-user defaults (OpenCode auth, code review flag)

All queries are in `lib/db/queries.ts`. Use Drizzle ORM, not raw SQL.

### API Routes Pattern

API routes follow RESTful conventions:
- `POST /api/sandbox/create` - Create sandbox session
- `GET /api/sandbox/[sessionId]/status` - Get status
- `GET /api/sandbox/[sessionId]/logs` - Stream logs (SSE)
- `POST /api/sandbox/[sessionId]/stop` - Stop sandbox
- `POST /api/sandbox/[sessionId]/snapshot` - Create snapshot

Request validation uses Zod schemas in `lib/api/` (e.g., `sandbox-config-builder.ts`).

### Frontend State Management

- **TanStack Query** for server state (see `hooks/use-sandbox.ts`)
- **LocalStorage** for persistence (repository URL, directory, plan path) via `lib/storage.ts`
- **Common Config** from env vars (`COMMON_*`) auto-fills forms

### Testing Strategy

**Test helpers** (`test/helpers/`) provide:
- Mock factories (`createMockSession`, `createMockSandbox`, etc.)
- Database mocking (`setupMockDatabase`, `createMockQueries`)
- Sandbox SDK mocking (`createMockSandboxModule`, `createMockCommand`)

Use these to avoid test duplication. See `test/helpers/README.md` for full documentation.

**Vitest config**: Uses happy-dom environment, global test utilities, `@/` path alias.

## Important Implementation Notes

### Sandbox Runtime & Timeout
- Default runtime: `node24` (configurable via `VERCEL_SANDBOX_RUNTIME`)
- Supported: `node24`, `node22`, `python3.13`
- Default timeout: 10 minutes (600000ms, max 45 minutes)
- Configure via `VERCEL_SANDBOX_TIMEOUT_MS`

### Authentication
Sandbox creation requires Vercel authentication:
- **Production**: Auto-set `VERCEL_OIDC_TOKEN`
- **Local dev**: Run `vercel env pull` to get token
- Helper: `requireAuthentication()` in `lib/sandbox/auth.ts`

### Session Lifecycle
1. Create session (status: `pending`) in database
2. Create Vercel sandbox via SDK
3. Update session with `sandboxId` (status: `running`)
4. Stream logs to database + detect PR URLs
5. Mark complete/failed when sandbox exits
6. Set `endedAt` timestamp and final status

### Log Streaming & PR Detection
`LogStreamService` monitors command output for GitHub PR URLs and extracts them via regex. When detected, updates session `prUrl` and `prStatus` fields.

### Snapshot Management
- Snapshots expire after 7 days (Vercel limitation)
- Creating snapshot removes sandbox from `activeSandboxes` (cleanup)
- Track snapshot metadata in database for UI display
- Use `snapshotId` in create request to restore from snapshot

### File Operations
`SandboxFileService` provides:
- `writeFiles()` - Batch write files to sandbox
- `readFile()` - Read file from sandbox
- Used for writing plan files before execution

### Common Configuration Pattern
Environment variables prefixed with `COMMON_` provide defaults:
- `COMMON_GITHUB_TOKEN` - Auto-fill GitHub token
- `COMMON_OPENCODE_AUTH_JSON_B64` - Auto-fill OpenCode auth
- `COMMON_GIST_URL` - Auto-fill script URL
- `COMMON_MODEL_PROVIDER`, `COMMON_MODEL_ID` - AI model defaults

Forms show "(Using common config)" when using these defaults.

### Session Archiving
Sessions can be archived to reduce clutter:
- Archive flag in database (default: false)
- UI filters archived sessions by default
- Archive/unarchive via API endpoints

### Rate Limiting
API routes use `@upstash/redis` for rate limiting:
- Default: 10 requests/minute (configurable via `RATE_LIMIT_REQUESTS_PER_MINUTE`)
- Implemented in `lib/rate-limit.ts`

## Code Style & Patterns

### React Components
- Use shadcn/ui components from `components/ui/`
- Server Components by default (use `"use client"` only when needed)
- TanStack Query hooks for data fetching in Client Components

### Error Handling
- Return `NextResponse.json()` with proper status codes in API routes
- Use `toast.error()` for user-facing errors (via sonner)
- Log errors to console for debugging

### Type Safety
- Import types from `@/types/sandbox` for shared types
- Use Drizzle schema inference for database types
- Zod schemas for runtime validation

### Testing
- One test file per source file (e.g., `manager.test.ts` for `manager.ts`)
- Use test helpers to reduce boilerplate
- Mock at module boundaries (database, Vercel SDK, auth)
- Focus on behavior, not implementation details

## Project-Specific Notes

### AI Model Configuration
Sessions can specify AI model provider and ID:
- Providers: `anthropic`, `openai`, `gemini`
- Default: `anthropic` / `claude-sonnet-4-5`
- Used by agent scripts running in sandbox

### GitHub Integration
- GitHub session via OAuth (login page, middleware)
- Token validation in `lib/api/github-validator.ts`
- Repository fetching via Octokit (`lib/api/github-repos.ts`)

### Plan Mode (Development Only)
**AI-powered implementation plan generation using OpenCode SDK**

**Components**:
- `lib/opencode/plan-agent.ts` - Core service for plan generation
- `app/api/plan/generate/route.ts` - Development-only API endpoint (404 in production)
- `hooks/use-plan-generation.ts` - TanStack Query mutation hook
- `scripts/test-opencode-plan.ts` - Standalone debugging script

**Setup Requirements**:
1. Set `COMMON_OPENCODE_AUTH_JSON_B64` (base64-encoded JSON with Anthropic API key)
2. OpenCode config at `~/.config/opencode/config.json` with plan agent enabled
3. `NODE_ENV=development` (feature disabled in production)

**How It Works**:
1. User enters task description in sandbox config form
2. Frontend calls `POST /api/plan/generate` with prompt
3. Backend uses OpenCode SDK:
   - `createOpencode()` - Start server (port: 0 for auto-assignment, timeout: 30s)
   - `client.auth.set()` - Set Anthropic auth
   - `client.session.create()` - Create session
   - `client.session.prompt()` - Send prompt with `agent: 'plan'`
   - `client.session.messages()` - Get generated plan
   - `extractPlanFromMessages()` - Extract text from assistant message
   - `server.close()` - Cleanup
4. Generated plan auto-populates planText field

**Debugging**:
```bash
# Test OpenCode integration standalone
tsx scripts/test-opencode-plan.ts

# Expected message structure:
# [{ info: { role: 'assistant' }, parts: [{ type: 'text', text: 'plan...' }] }]
```

**Documentation**:
- `docs/PLAN_MODE_GUIDE.md` - Detailed implementation guide
- `docs/PLAN_MODE_QUICKSTART.md` - Setup instructions (Japanese)
- `docs/PLAN_MODE_STATUS.md` - Current status and troubleshooting
- `docs/opencode-config-sample.json` - Sample OpenCode configuration

**Common Issues**:
- "No plan content found" → Check OpenCode config has `agents.plan.enabled: true`
- Timeout errors → Already configured with 30s timeout
- Port conflicts → Already configured with auto-assignment (`port: 0`)

### Scripts Directory
`scripts/` contains:
- `create-base-snapshot.sh` - Create baseline snapshot for environments
- `snapshot-id.txt` - Tracks current base snapshot ID

## Debugging Tips

### Check Sandbox Status
Use Drizzle Studio (`pnpm run db:studio`) to inspect sessions table and verify:
- `sandboxId` is set after creation
- `status` transitions correctly
- `prUrl` is detected from logs

### Log Streaming Issues
Check `activeSandboxes` Map has entry for sessionId. If missing, log streaming won't work.

### Authentication Errors
Verify `VERCEL_OIDC_TOKEN` or `VERCEL_ACCESS_TOKEN` is set. Run `vercel env pull` for local dev.

### Test Failures
Run `pnpm run test -- path/to/file.test.ts` to isolate failing test. Check mocks are properly set up using test helpers.
