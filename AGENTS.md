# AGENTS.md - Coding Agent Guide

Guidelines for AI coding agents working in this Next.js 16 + Vercel Sandbox SDK project.

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript 5
- Drizzle ORM + PostgreSQL
- Tailwind CSS 4 + shadcn/ui
- Zod for validation
- TanStack Query for server state

## Commands

```bash
pnpm dev              # Start dev server (localhost:3000)
pnpm build            # Production build
pnpm lint             # Run Biome linter
pnpm format           # Run Biome formatter (write)
pnpm check            # Run Biome linter + formatter (write)
pnpm ci               # Run Biome linter + formatter (check mode)
pnpm db:generate      # Generate Drizzle migrations
pnpm db:push          # Push schema to database
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio
```

### Testing

**Note:** No test runner is configured yet. When adding tests:
- Use Vitest (recommended) or Jest
- Add to `package.json`: `"test": "vitest"`, `"test:ui": "vitest --ui"`
- Run single test: `npx vitest run src/utils.test.ts` or `npx vitest --testNamePattern="test name"`
- Place tests adjacent to source files: `*.test.ts` or `*.spec.ts`
- Use React Testing Library for component tests

## Code Style

### Import Order

```typescript
// 1. External packages
import { NextResponse } from 'next/server';
import { useState } from 'react';

// 2. @/ aliases
import { db } from '@/lib/db/client';

// 3. Relative imports
import { helper } from './utils';

// 4. Type imports last
import type { Session } from '@/types/sandbox';
```

### Naming

- **Files:** kebab-case (`sandbox-manager.ts`, `config-form.tsx`)
- **Components:** PascalCase function declarations (`export function ConfigForm()`)
- **Functions:** camelCase (`createSession`, `getSandboxManager`)
- **Constants:** UPPER_SNAKE_CASE (`RUNTIME_OPTIONS`)
- **Types:** PascalCase (`SandboxConfig`, `SessionStatus`)
- **Database tables:** lowercase with underscores (`sessions`, `sandbox_logs`)

### React Components

- Use **function declarations**, not arrow functions
- Client components: `'use client'` at top
- Props interface with `Props` suffix

```typescript
interface ConfigFormProps {
  onSubmit: (data: FormData) => void;
  isLoading?: boolean;
}

export function ConfigForm({ onSubmit, isLoading }: ConfigFormProps) {
  // ...
}
```

### TypeScript

- **Strict mode enabled** (see `tsconfig.json`)
- Prefer `interface` for public APIs, `type` for unions
- Use explicit return types on exported functions
- Import types with `type` keyword
- Use Drizzle's type inference: `export type Session = typeof sessions.$inferSelect`
- Never use `any` - use `unknown` or proper types

### Error Handling

```typescript
// API Routes - structured error responses
return NextResponse.json<ApiError>(
  {
    error: 'Failed to create sandbox',
    code: 'INTERNAL_ERROR',
    details: { message: error.message },
  },
  { status: 500 }
);

// Try-catch with context
async function createSandbox() {
  try {
    await sandbox.start();
  } catch (error) {
    console.error('Failed to start sandbox:', error);
    throw error;
  }
}
```

### Validation (Zod)

- Define schemas in `lib/validators/`
- Use `.safeParse()` for user input, `.parse()` for internal

```typescript
const result = SomeSchema.safeParse(data);
if (!result.success) {
  return NextResponse.json<ApiError>({
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: { errors: result.error.flatten().fieldErrors },
  }, { status: 400 });
}
```

### Async Patterns

- Always use `async/await` over Promise chains
- Use `Promise.all()` for parallel operations

```typescript
const [sessions, count] = await Promise.all([
  db.select().from(sessions).limit(10),
  db.select().from(sessions),
]);
```

### Styling

- Use Tailwind CSS classes
- Utilize `cn()` utility for conditional classes
- shadcn/ui components in `components/ui/`

## Project Structure

```
app/                      # Next.js App Router
  api/                    # API routes
  sandbox/                # Sandbox pages
  history/                # Session history
components/
  ui/                     # shadcn/ui components
  sandbox/                # Feature components
lib/
  db/                     # Database (schema, queries, client)
  sandbox/                # Sandbox logic (manager, auth)
  validators/             # Zod schemas
types/                    # TypeScript types
```

## Key Patterns

### API Routes

```typescript
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const data = await fetchData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

### Singleton Pattern

```typescript
let manager: SandboxManager | null = null;

export function getSandboxManager(): SandboxManager {
  if (!manager) manager = new SandboxManager();
  return manager;
}
```

### Database Queries

All queries in `lib/db/queries.ts` using Drizzle ORM:

```typescript
export async function getSession(id: string): Promise<Session | undefined> {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  return session;
}
```

## Environment Variables

- Required: `DATABASE_URL`, `VERCEL_OIDC_TOKEN` or `VERCEL_ACCESS_TOKEN`
- Optional: `COMMON_*` for defaults, `VERCEL_SANDBOX_*` for config
- Never commit `.env.local` files with secrets

## Common Mistakes

1. ❌ Arrow functions for components (use function declarations)
2. ❌ Forgetting `'use client'` for hooks/interactivity
3. ❌ Using relative imports across features (use `@/`)
4. ❌ Skipping error handling in async functions
5. ❌ Using `any` type
6. ❌ Mixing import order

## Git

- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`
- Keep commits focused and atomic

## Notes

- Code comments/docs in English, UI text in Japanese (`lang="ja"`)
- Icons from `lucide-react`
- Forms use `react-hook-form` + Zod resolver
