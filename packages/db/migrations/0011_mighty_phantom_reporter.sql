ALTER TABLE "ai_extraction_log" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_extraction_log" ADD COLUMN "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_extraction_log" ADD COLUMN "api_call_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_extraction_log" ADD COLUMN "cost_usd" numeric(10, 6);