# AGENTS.md - Coding Agent Guide

This document provides essential guidelines for AI coding agents working in this repository.

## Project Overview

**Sandbox Agent Space** - A Next.js 16 application that manages Vercel Sandbox SDK integration for running isolated coding agent tasks in secure Linux microVMs.

**Tech Stack:**
- Next.js 16 (App Router), React 19, TypeScript 5
- Drizzle ORM + PostgreSQL
- Vercel Sandbox SDK, TanStack Query
- shadcn/ui + Tailwind CSS 4
- Zod for validation

## Build, Lint & Test Commands

### Development
```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm start                # Start production server
npm run lint             # Run ESLint
```

### Database
```bash
npm run db:generate      # Generate migrations after schema changes
npm run db:push          # Push schema to database
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio GUI
```

### Testing
**Note:** This project does not have test files yet. When adding tests, use:
- Jest/Vitest for unit tests
- React Testing Library for component tests
- Place tests adjacent to source files with `.test.ts(x)` or `.spec.ts(x)` extension

## Code Style Guidelines

### Import Organization
Order imports as follows:
1. External packages (React, Next.js, third-party)
2. Aliases starting with `@/` (project imports)
3. Relative imports (`./`, `../`)
4. Type imports last with `type` keyword

```typescript
// ✅ Good
import { NextResponse } from 'next/server';
import { Sandbox } from '@vercel/sandbox';
import { createSession } from '@/lib/db/queries';
import { getSandboxManager } from '@/lib/sandbox/manager';
import type { SandboxConfig } from '@/types/sandbox';

// ❌ Bad - mixed ordering
import type { SandboxConfig } from '@/types/sandbox';
import { createSession } from '@/lib/db/queries';
import { NextResponse } from 'next/server';
```

### TypeScript & Types

**Always use TypeScript with strict mode enabled.**

1. **Prefer interfaces for public APIs, type aliases for unions/intersections:**
   ```typescript
   // ✅ Good
   export interface SandboxSession { ... }
   export type SessionStatus = 'pending' | 'running' | 'completed' | 'failed';
   ```

2. **Use explicit return types for functions:**
   ```typescript
   // ✅ Good
   export async function getSession(sessionId: string): Promise<Session | undefined> {
     // ...
   }
   ```

3. **Import types with `type` keyword:**
   ```typescript
   import type { SandboxConfig, SessionStatus } from '@/types/sandbox';
   ```

4. **Use Drizzle's type inference:**
   ```typescript
   export type Session = typeof sessions.$inferSelect;
   export type NewSession = typeof sessions.$inferInsert;
   ```

### Naming Conventions

- **Files:** kebab-case (`sandbox-manager.ts`, `config-form.tsx`)
- **Components:** PascalCase files and exports (`ConfigForm.tsx`, `export function ConfigForm`)
- **Functions:** camelCase (`createSession`, `getSandboxManager`)
- **Constants:** UPPER_SNAKE_CASE (`RUNTIME_OPTIONS`, `MAX_TIMEOUT`)
- **Types/Interfaces:** PascalCase (`SandboxConfig`, `SessionStatus`)
- **Database tables:** lowercase with underscores (`sessions`, `sandbox_logs`)

### React Components

1. **Use function declarations, not arrow functions:**
   ```typescript
   // ✅ Good
   export function ConfigForm({ onSubmit }: ConfigFormProps) { ... }
   
   // ❌ Bad
   export const ConfigForm = ({ onSubmit }: ConfigFormProps) => { ... };
   ```

2. **Client components:** Add `'use client'` directive at top
3. **Server components:** Default (no directive needed)
4. **Props:** Define explicit interface with `Props` suffix
   ```typescript
   interface ConfigFormProps {
     onSubmit: (data: FormData) => void;
     isLoading?: boolean;
   }
   ```

### Error Handling

1. **API Routes:** Return structured error responses
   ```typescript
   return NextResponse.json<ApiError>(
     {
       error: 'Failed to create sandbox',
       code: 'INTERNAL_ERROR',
       details: { message: errorMessage },
     },
     { status: 500 }
   );
   ```

2. **Try-catch blocks:** Always handle errors explicitly
   ```typescript
   try {
     await sandbox.stop();
   } catch (error) {
     console.error('Failed to stop sandbox:', error);
     throw error; // or handle gracefully
   }
   ```

3. **Error messages:** Clear, actionable, include context

### Async/Await

- **Always use async/await** over Promise chains
- Use `Promise.all()` for parallel operations
- Handle errors with try-catch blocks

```typescript
// ✅ Good
const [sessionList, countResult] = await Promise.all([
  db.select().from(sessions).orderBy(desc(sessions.createdAt)),
  db.select().from(sessions),
]);
```

### Path Aliases

Use `@/` for absolute imports (configured in `tsconfig.json`):
```typescript
import { db } from '@/lib/db/client';
import { Button } from '@/components/ui/button';
import type { SandboxConfig } from '@/types/sandbox';
```

### Comments & Documentation

1. **JSDoc for exported functions:**
   ```typescript
   /**
    * Create and start a new sandbox using Vercel Sandbox SDK
    */
   async createSandbox(sessionId: string, options: SandboxCreateOptions) {
   ```

2. **Inline comments:** Explain "why", not "what"
3. **TODO comments:** Include context and owner if possible

### Validation with Zod

- Use Zod v4 for all data validation
- Define schemas in `lib/validators/`
- Use `.safeParse()` for user input, `.parse()` for internal validation

```typescript
const validationResult = safeParseSandboxConfig(body);
if (!validationResult.success) {
  return NextResponse.json<ApiError>({
    error: 'Invalid configuration',
    code: 'VALIDATION_ERROR',
    details: { errors: validationResult.error.flatten().fieldErrors },
  }, { status: 400 });
}
```

### Database Queries

- All queries in `lib/db/queries.ts`
- Use Drizzle ORM query builder
- Return typed results from schema inference
- Always handle undefined/null results

```typescript
export async function getSession(sessionId: string): Promise<Session | undefined> {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  return session;
}
```

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API routes (/api/*)
│   ├── sandbox/           # Sandbox pages
│   ├── history/           # Session history
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/
│   ├── sandbox/           # Feature components
│   ├── ui/                # shadcn/ui components
│   └── providers/         # React providers
├── hooks/                 # Custom React hooks
├── lib/
│   ├── db/               # Database (schema, queries, client)
│   ├── sandbox/          # Sandbox logic (manager, auth, snapshots)
│   ├── validators/       # Zod schemas
│   └── utils.ts          # Utilities (cn helper)
├── types/                # TypeScript types
└── drizzle/              # Database migrations
```

## Key Patterns

### API Routes (Next.js App Router)
- Export `GET`, `POST`, `DELETE` etc. as named functions
- Use `NextResponse.json()` for responses
- Include proper status codes and headers
- Validate inputs with Zod

### Singleton Pattern for Managers
```typescript
let sandboxManager: SandboxManager | null = null;

export function getSandboxManager(): SandboxManager {
  if (!sandboxManager) {
    sandboxManager = new SandboxManager();
  }
  return sandboxManager;
}
```

### Environment Variables
- Required: `DATABASE_URL`, `VERCEL_OIDC_TOKEN` or `VERCEL_ACCESS_TOKEN`
- Optional: `COMMON_*` for defaults, `VERCEL_SANDBOX_*` for config
- Access via `process.env.VAR_NAME`
- Never commit `.env.local` files

## Common Mistakes to Avoid

1. ❌ Don't mix arrow functions and function declarations for components
2. ❌ Don't forget `'use client'` for hooks/interactivity
3. ❌ Don't use relative imports across feature boundaries (use `@/`)
4. ❌ Don't commit environment files with secrets
5. ❌ Don't skip error handling in async functions
6. ❌ Don't mutate props or state directly
7. ❌ Don't forget to validate external inputs
8. ❌ Don't use `any` type - use `unknown` or proper types

## Git Commit Guidelines

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
- Keep commits focused and atomic
- Write clear, descriptive messages

## Additional Notes

- **Language:** Code comments/docs in English, UI text in Japanese (as seen in layout.tsx `lang="ja"`)
- **Styling:** Use Tailwind CSS classes, utilize `cn()` utility for conditional classes
- **Forms:** Use react-hook-form with Zod resolver
- **State:** TanStack Query for server state, React state for UI
- **Icons:** Use lucide-react icon library
