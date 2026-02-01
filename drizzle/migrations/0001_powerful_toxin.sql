CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" text NOT NULL,
	"session_id" uuid,
	"source_sandbox_id" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "snapshots_snapshot_id_unique" UNIQUE("snapshot_id")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "runtime" text DEFAULT 'node24' NOT NULL;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;