# Sandbox Agent Space

A Next.js 16 application that manages **Vercel Sandbox SDK** integration for running isolated coding agent tasks in secure Linux microVMs.

## Features

- 🚀 **Vercel Sandbox SDK Integration** - Run code in isolated Linux microVMs
- 🔄 **Session Management** - Track and manage sandbox execution sessions
- 📊 **Real-time Log Streaming** - Stream stdout/stderr logs via Server-Sent Events
- 💾 **Snapshot Support** - Create and restore sandbox snapshots
- 🔁 **Clone Sessions** - Clone previous configurations with one click
- ⚙️ **Common Configuration** - Set default values via environment variables
- 💾 **LocalStorage Persistence** - Remember last used repository settings
- 🎯 **Multiple Runtimes** - Support for Node.js 24, Node.js 22, Python 3.13
- ⏱️ **Configurable Timeout** - Default 10 minutes, configurable up to 45 minutes
- 🧪 **Comprehensive Testing** - 332 tests with 91%+ coverage
- 🔧 **Test Helpers** - Shared utilities for reducing test duplication

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Vercel account (for authentication)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sandbox-agent-space
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and configure:
- `DATABASE_URL` - PostgreSQL connection string
- `COMMON_GITHUB_TOKEN` (optional) - Default GitHub token
- `COMMON_OPENCODE_AUTH_JSON_B64` (optional) - Default OpenCode auth
- `COMMON_GIST_URL` (optional) - Default Gist script URL

4. Set up Vercel authentication (required for sandbox creation):

**For local development:**
```bash
vercel link          # Link to your Vercel project
vercel env pull      # Pull OIDC token to .env.local
```

**For production on Vercel:** 
Authentication is automatic via `VERCEL_OIDC_TOKEN`.

5. Initialize the database:
```bash
pnpm run db:push
```

6. Run the development server:
```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string

### Vercel Sandbox Authentication (one required)
- `VERCEL_OIDC_TOKEN` - Auto-set on Vercel, use `vercel env pull` for local dev
- `VERCEL_ACCESS_TOKEN` - Alternative authentication method

### Optional Configuration
- `VERCEL_SANDBOX_RUNTIME` - Default runtime: `node24`, `node22`, or `python3.13`
- `VERCEL_SANDBOX_TIMEOUT_MS` - Sandbox timeout in milliseconds (default: 600000 = 10 minutes)
- `COMMON_GITHUB_TOKEN` - Default GitHub personal access token
- `COMMON_OPENCODE_AUTH_JSON_B64` - Default OpenCode authentication (base64-encoded JSON)
- `COMMON_GIST_URL` - Default Gist script URL
- `RATE_LIMIT_REQUESTS_PER_MINUTE` - API rate limit (default: 10)

See `.env.example` for detailed configuration options.

## Usage

### Common Configuration (Recommended)

To avoid entering credentials every time, set environment variables:

```bash
# In .env.local
COMMON_GITHUB_TOKEN="ghp_your_token_here"
COMMON_OPENCODE_AUTH_JSON_B64="eyJ..."
COMMON_GIST_URL="https://gist.githubusercontent.com/user/id/raw/script.sh"
```

With common config set, the form will:
- ✅ Auto-fill these fields with "(Using common config)" indicator
- ✅ Allow leaving them empty to use defaults
- ✅ Allow overriding by entering custom values

### Creating a Sandbox

1. Navigate to `/sandbox`
2. Configure settings (or use defaults from common config):
   - **Runtime**: Select Node.js or Python version
   - **Gist URL**: Script to execute (uses common config if set)
   - **Repository**: GitHub repo to clone (remembered from last use)
   - **Directory**: Working directory (default: `frontend`)
   - **Credentials**: GitHub token and OpenCode auth (uses common config if set)
3. Click "Start Sandbox"
4. Watch real-time logs as the sandbox executes

### Cloning a Session

1. Go to a previous session detail page
2. Click "Clone This Session" button
3. Form auto-fills with previous configuration
4. Modify as needed and submit

### Using Snapshots

Create a snapshot of a running sandbox:
```bash
POST /api/sandbox/{sessionId}/snapshot
```

Restore from snapshot:
- Enter the snapshot ID in the "Snapshot ID" field when creating a sandbox
- Snapshots expire after 7 days

## Database Management

```bash
# Generate migration after schema changes
pnpm run db:generate

# Apply schema changes to database
pnpm run db:push

# Open Drizzle Studio (database GUI)
pnpm run db:studio
```

## API Routes

### Sandbox Management
- `POST /api/sandbox/create` - Create and start new sandbox
- `GET /api/sandbox/{sessionId}` - Get session details
- `GET /api/sandbox/{sessionId}/status` - Get sandbox status
- `GET /api/sandbox/{sessionId}/logs` - Stream logs (SSE)
- `POST /api/sandbox/{sessionId}/snapshot` - Create snapshot
- `POST /api/sandbox/{sessionId}/stop` - Stop sandbox

### Sessions & Snapshots
- `GET /api/sessions` - List all sessions (paginated)
- `GET /api/snapshots` - List all snapshots
- `GET /api/snapshots/{snapshotId}` - Get snapshot details
- `DELETE /api/snapshots/{snapshotId}` - Delete snapshot

### Configuration
- `GET /api/config` - Get common configuration (from env vars)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **UI**: React, TailwindCSS, shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Sandbox**: Vercel Sandbox SDK (@vercel/sandbox)
- **Authentication**: Vercel OIDC Token
- **Validation**: Zod

## Project Structure

```
 ├── app/
 │   ├── api/              # API routes
 │   ├── sandbox/          # Sandbox pages
 │   ├── history/          # Session history
 │   └── ...
 ├── components/
 │   ├── sandbox/          # Sandbox-specific components
 │   └── ui/               # shadcn/ui components
 ├── hooks/                # Custom React hooks
 ├── lib/
 │   ├── api/              # API utilities (validators, config builders)
 │   ├── db/               # Database schema & queries
 │   ├── sandbox/          # Sandbox manager & services
 │   ├── validators/       # Zod validation schemas
 │   └── storage.ts        # LocalStorage utilities
 ├── test/
 │   ├── helpers/          # Shared test utilities
 │   └── setup.ts          # Vitest global setup
 ├── types/                # TypeScript type definitions
 └── drizzle/              # Database migrations
```

## Key Features Explained

### LocalStorage Persistence
The app automatically remembers your last used:
- Repository URL
- Repository slug
- Frontend directory
- Plan file path

These are restored when you visit `/sandbox` again.

### Common Configuration
Set `COMMON_*` environment variables to avoid re-entering:
- GitHub tokens
- OpenCode authentication
- Gist URLs

Fields show "(Using common config)" when defaults are active.

### Session Cloning
Every session can be cloned with one click:
- Preserves all non-sensitive configuration
- Auto-fills form with previous values
- Ready to modify and re-run

## Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm start

# Lint & format code (check mode)
pnpm run ci

# Lint & format code (write mode)
pnpm run check

# Type checking
pnpm run typecheck

# Run tests
pnpm vitest

# Run tests with coverage
pnpm test:coverage

# Run all CI checks (lint, typecheck, build, test)
pnpm run ci:all
```

## Continuous Integration

This project uses GitHub Actions for automated CI checks. The workflow runs on:
- Push to `main`/`master` branches
- Pull requests to `main`/`master` branches

The CI pipeline includes:
1. **Lint** - Code quality checks with Biome
2. **Type Check** - TypeScript type checking
3. **Test** - Unit tests with Vitest
4. **Build** - Next.js production build

See `.github/workflows/ci.yml` for the full configuration.

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Import project to Vercel
3. Set environment variables in Vercel dashboard:
   - `DATABASE_URL`
   - `COMMON_GITHUB_TOKEN` (optional)
   - `COMMON_OPENCODE_AUTH_JSON_B64` (optional)
   - `COMMON_GIST_URL` (optional)
4. Deploy!

`VERCEL_OIDC_TOKEN` is automatically set by Vercel in production.

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
