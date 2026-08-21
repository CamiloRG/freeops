CREATE TABLE "ai_extraction_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"tier" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_extraction_log_document_type_check" CHECK ("ai_extraction_log"."document_type" in ('resume')),
	CONSTRAINT "ai_extraction_log_tier_check" CHECK ("ai_extraction_log"."tier" in ('default','byok')),
	CONSTRAINT "ai_extraction_log_status_check" CHECK ("ai_extraction_log"."status" in ('succeeded','failed'))
);
--> statement-breakpoint
CREATE TABLE "ai_provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"api_key_encrypted" "bytea" NOT NULL,
	"api_key_hint" text NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ai_provider_connections_user_provider_unique" UNIQUE("user_id","provider"),
	CONSTRAINT "ai_provider_connections_provider_check" CHECK ("ai_provider_connections"."provider" in ('anthropic'))
);
--> statement-breakpoint
ALTER TABLE "ai_extraction_log" ADD CONSTRAINT "ai_extraction_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_connections" ADD CONSTRAINT "ai_provider_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_extraction_log_user_tier_created" ON "ai_extraction_log" USING btree ("user_id","tier","created_at");
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- Row-Level Security — same pattern as 0004_row_level_security.sql:
-- both tables carry a direct `user_id` column, so no transitive-ownership
-- subquery is needed. Hand-written (not drizzle-kit managed), appended to
-- this migration rather than a separate numbered file since it's additive
-- to the exact tables `drizzle-kit generate` just created above and there
-- is no intervening schema change to interleave with.
-- ---------------------------------------------------------------------
alter table public.ai_provider_connections enable row level security;
create policy "ai_provider_connections_owner_access" on public.ai_provider_connections
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
--> statement-breakpoint

alter table public.ai_extraction_log enable row level security;
create policy "ai_extraction_log_owner_access" on public.ai_extraction_log
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);