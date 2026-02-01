ALTER TABLE "sessions" ADD COLUMN "memo" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;