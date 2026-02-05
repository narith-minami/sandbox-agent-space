ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "model_provider" text DEFAULT 'anthropic';
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "model_id" text DEFAULT 'claude-3-5-sonnet-20241022';
