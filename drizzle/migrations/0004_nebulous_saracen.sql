CREATE TABLE "environment_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_login" text NOT NULL,
	"name" text NOT NULL,
	"gist_url" text NOT NULL,
	"snapshot_id" text,
	"workdir" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_login" text NOT NULL,
	"opencode_auth_json_b64" text,
	"enable_code_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "model_provider" text DEFAULT 'anthropic';--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "model_id" text DEFAULT 'claude-sonnet-4-5';--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pr_status" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ended_at" timestamp with time zone;