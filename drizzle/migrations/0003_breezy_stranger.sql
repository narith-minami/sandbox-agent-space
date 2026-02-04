ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "memo" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "archived" boolean DEFAULT false NOT NULL;
