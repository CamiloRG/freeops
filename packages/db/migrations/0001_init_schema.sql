CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"password_hash" text,
	"auth_provider" text DEFAULT 'email' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"locale" text DEFAULT 'es-CO' NOT NULL,
	"timezone" text DEFAULT 'America/Bogota' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_auth_provider_check" CHECK ("users"."auth_provider" in ('email','google','microsoft'))
);
--> statement-breakpoint
CREATE TABLE "banking_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"account_type" text NOT NULL,
	"account_number_encrypted" "bytea" NOT NULL,
	"account_holder_name" text NOT NULL,
	"account_holder_tax_id_encrypted" "bytea",
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "banking_details_account_type_check" CHECK ("banking_details"."account_type" in ('savings','checking'))
);
--> statement-breakpoint
CREATE TABLE "freelancer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"display_name" text,
	"phone" text,
	"country" text DEFAULT 'CO' NOT NULL,
	"city" text,
	"profile_photo_key" text,
	"headline" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "freelancer_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "tax_info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tax_id_type" text NOT NULL,
	"tax_id_number_encrypted" "bytea" NOT NULL,
	"tax_regime" text,
	"is_gran_contribuyente" boolean DEFAULT false NOT NULL,
	"is_iva_responsible" boolean DEFAULT false NOT NULL,
	"ciiu_code" text,
	"fiscal_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tax_info_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "tax_info_tax_id_type_check" CHECK ("tax_info"."tax_id_type" in ('CC','NIT','CE','Pasaporte')),
	CONSTRAINT "tax_info_tax_regime_check" CHECK ("tax_info"."tax_regime" in ('regimen_simple','regimen_ordinario','no_responsable'))
);
--> statement-breakpoint
CREATE TABLE "tax_info_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_info_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "branding_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"logo_file_key" text,
	"primary_color" text,
	"secondary_color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "branding_assets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "resume_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"client_name" text,
	"description" text,
	"start_date" date,
	"end_date" date,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "resume_entries_source_check" CHECK ("resume_entries"."source" in ('manual','project'))
);
--> statement-breakpoint
CREATE TABLE "resume_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"skill_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"headline" text,
	"summary" text,
	"template_id" text DEFAULT 'default',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "resumes_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "booking_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text DEFAULT 'Book time with me' NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"availability_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "booking_links_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_link_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"guest_name" text NOT NULL,
	"guest_email" "citext" NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"calendar_provider" text,
	"calendar_event_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "bookings_status_check" CHECK ("bookings"."status" in ('confirmed','cancelled','completed','no_show')),
	CONSTRAINT "bookings_calendar_provider_check" CHECK ("bookings"."calendar_provider" in ('google','microsoft'))
);
--> statement-breakpoint
CREATE TABLE "calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_email" text NOT NULL,
	"access_token_encrypted" "bytea" NOT NULL,
	"refresh_token_encrypted" "bytea" NOT NULL,
	"token_expires_at" timestamp with time zone,
	"scope" text,
	"external_calendar_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "calendar_connections_user_provider_unique" UNIQUE("user_id","provider"),
	CONSTRAINT "calendar_connections_provider_check" CHECK ("calendar_connections"."provider" in ('google','microsoft')),
	CONSTRAINT "calendar_connections_status_check" CHECK ("calendar_connections"."status" in ('active','revoked','error'))
);
--> statement-breakpoint
CREATE TABLE "contract_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"title" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_document_id" uuid,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"file_size_bytes" bigint,
	"effective_date" date,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "contract_documents_document_type_check" CHECK ("contract_documents"."document_type" in ('executed_contract','amendment','appendix','change_order'))
);
--> statement-breakpoint
CREATE TABLE "kanban_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "kanban_boards_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "kanban_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"wip_limit" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kanban_columns_board_position_unique" UNIQUE("board_id","position")
);
--> statement-breakpoint
CREATE TABLE "kanban_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"column_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"position" integer NOT NULL,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"client_name" text NOT NULL,
	"client_email" "citext",
	"client_tax_id" text,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"scope_notes" text,
	"deal_value" numeric(14, 2),
	"currency" char(3) DEFAULT 'COP' NOT NULL,
	"expected_start_date" date,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "projects_status_check" CHECK ("projects"."status" in ('active','completed','archived','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "crm_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"client_name" text NOT NULL,
	"client_email" "citext",
	"client_phone" text,
	"deal_value" numeric(14, 2),
	"currency" char(3) DEFAULT 'COP' NOT NULL,
	"expected_close_date" date,
	"notes" text,
	"source" text,
	"closed_at" timestamp with time zone,
	"converted_project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"is_won_stage" boolean DEFAULT false NOT NULL,
	"is_lost_stage" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_pipeline_stages_user_position_unique" UNIQUE("user_id","position")
);
--> statement-breakpoint
CREATE TABLE "cuentas_de_cobro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"number" text NOT NULL,
	"client_name" text NOT NULL,
	"client_tax_id" text,
	"concept" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" char(3) DEFAULT 'COP' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"requires_withholding_certificate" boolean DEFAULT false NOT NULL,
	"pdf_file_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "cuentas_de_cobro_user_number_unique" UNIQUE("user_id","number"),
	CONSTRAINT "cuentas_de_cobro_status_check" CHECK ("cuentas_de_cobro"."status" in ('draft','issued','paid','overdue','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"cuenta_de_cobro_id" uuid,
	"number" text NOT NULL,
	"client_name" text NOT NULL,
	"client_tax_id" text,
	"amount" numeric(14, 2) NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"currency" char(3) DEFAULT 'COP' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"e_invoicing_status" text DEFAULT 'not_applicable' NOT NULL,
	"pdf_file_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "invoices_user_number_unique" UNIQUE("user_id","number"),
	CONSTRAINT "invoices_status_check" CHECK ("invoices"."status" in ('draft','issued','paid','overdue','cancelled')),
	CONSTRAINT "invoices_e_invoicing_status_check" CHECK ("invoices"."e_invoicing_status" in ('not_applicable','pending','submitted','accepted','rejected'))
);
--> statement-breakpoint
CREATE TABLE "payment_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_reminders_channel_check" CHECK ("payment_reminders"."channel" in ('email','whatsapp')),
	CONSTRAINT "payment_reminders_status_check" CHECK ("payment_reminders"."status" in ('sent','failed'))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cuenta_de_cobro_id" uuid,
	"invoice_id" uuid,
	"amount_paid" numeric(14, 2),
	"currency" char(3) DEFAULT 'COP' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"payment_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "payments_exactly_one_payable_check" CHECK (num_nonnulls("payments"."cuenta_de_cobro_id", "payments"."invoice_id") = 1),
	CONSTRAINT "payments_status_check" CHECK ("payments"."status" in ('pending','partial','paid','overdue','failed'))
);
--> statement-breakpoint
CREATE TABLE "pila_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"total_income_base" numeric(14, 2) NOT NULL,
	"ibc" numeric(14, 2) NOT NULL,
	"health_contribution" numeric(14, 2) NOT NULL,
	"pension_contribution" numeric(14, 2) NOT NULL,
	"arl_contribution" numeric(14, 2),
	"total_amount_owed" numeric(14, 2) NOT NULL,
	"operator" text DEFAULT 'other' NOT NULL,
	"regulatory_config_version_id" uuid,
	"status" text DEFAULT 'calculated' NOT NULL,
	"paid_at" date,
	"deep_link_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "pila_records_user_period_unique" UNIQUE("user_id","period_year","period_month"),
	CONSTRAINT "pila_records_period_month_check" CHECK ("pila_records"."period_month" between 1 and 12),
	CONSTRAINT "pila_records_operator_check" CHECK ("pila_records"."operator" in ('miplanilla','soi','aportes_en_linea','simple','other')),
	CONSTRAINT "pila_records_status_check" CHECK ("pila_records"."status" in ('calculated','paid','overdue'))
);
--> statement-breakpoint
CREATE TABLE "regulatory_config_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" text DEFAULT 'CO' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"config" jsonb NOT NULL,
	"source_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_vault_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_vault_documents_document_type_check" CHECK ("tax_vault_documents"."document_type" in ('cuenta_de_cobro','invoice','pila_record','withholding_certificate','contract_document'))
);
--> statement-breakpoint
CREATE TABLE "tax_vault_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period_type" text NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"generated_at" timestamp with time zone,
	"archive_file_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tax_vault_packages_period_type_check" CHECK ("tax_vault_packages"."period_type" in ('month','year')),
	CONSTRAINT "tax_vault_packages_period_month_check" CHECK ("tax_vault_packages"."period_month" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "withholding_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"cuenta_de_cobro_id" uuid,
	"invoice_id" uuid,
	"client_name" text NOT NULL,
	"tax_year" integer NOT NULL,
	"period" text,
	"required" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"received_at" date,
	"file_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "withholding_certificates_status_check" CHECK ("withholding_certificates"."status" in ('pending','received','not_applicable'))
);
--> statement-breakpoint
CREATE TABLE "app_subscription_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"stripe_invoice_id" text NOT NULL,
	"amount_due" numeric(10, 2) NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" char(3) DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"invoice_pdf_url" text,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_subscription_invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id"),
	CONSTRAINT "app_subscription_invoices_status_check" CHECK ("app_subscription_invoices"."status" in ('paid','open','void','uncollectible'))
);
--> statement-breakpoint
CREATE TABLE "app_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"plan" text DEFAULT 'monthly' NOT NULL,
	"status" text DEFAULT 'incomplete' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "app_subscriptions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "app_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "app_subscriptions_plan_check" CHECK ("app_subscriptions"."plan" in ('monthly','annual')),
	CONSTRAINT "app_subscriptions_status_check" CHECK ("app_subscriptions"."status" in ('trialing','active','past_due','canceled','incomplete'))
);
--> statement-breakpoint
CREATE TABLE "deletion_warnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"within_dian_window" boolean NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deletion_warnings_action_check" CHECK ("deletion_warnings"."action" in ('soft_delete_requested','soft_delete_confirmed','restore'))
);
--> statement-breakpoint
ALTER TABLE "banking_details" ADD CONSTRAINT "banking_details_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD CONSTRAINT "freelancer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_info" ADD CONSTRAINT "tax_info_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_info_documents" ADD CONSTRAINT "tax_info_documents_tax_info_id_tax_info_id_fk" FOREIGN KEY ("tax_info_id") REFERENCES "public"."tax_info"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branding_assets" ADD CONSTRAINT "branding_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_entries" ADD CONSTRAINT "resume_entries_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_entries" ADD CONSTRAINT "resume_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_skills" ADD CONSTRAINT "resume_skills_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booking_link_id_booking_links_id_fk" FOREIGN KEY ("booking_link_id") REFERENCES "public"."booking_links"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_parent_document_id_contract_documents_id_fk" FOREIGN KEY ("parent_document_id") REFERENCES "public"."contract_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_boards" ADD CONSTRAINT "kanban_boards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_columns" ADD CONSTRAINT "kanban_columns_board_id_kanban_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_tasks" ADD CONSTRAINT "kanban_tasks_column_id_kanban_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."kanban_columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_tasks" ADD CONSTRAINT "kanban_tasks_board_id_kanban_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_opportunity_id_crm_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_stage_id_crm_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."crm_pipeline_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_converted_project_id_projects_id_fk" FOREIGN KEY ("converted_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_de_cobro" ADD CONSTRAINT "cuentas_de_cobro_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_de_cobro" ADD CONSTRAINT "cuentas_de_cobro_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cuenta_de_cobro_id_cuentas_de_cobro_id_fk" FOREIGN KEY ("cuenta_de_cobro_id") REFERENCES "public"."cuentas_de_cobro"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_cuenta_de_cobro_id_cuentas_de_cobro_id_fk" FOREIGN KEY ("cuenta_de_cobro_id") REFERENCES "public"."cuentas_de_cobro"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pila_records" ADD CONSTRAINT "pila_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pila_records" ADD CONSTRAINT "pila_records_regulatory_config_version_id_regulatory_config_versions_id_fk" FOREIGN KEY ("regulatory_config_version_id") REFERENCES "public"."regulatory_config_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_vault_documents" ADD CONSTRAINT "tax_vault_documents_package_id_tax_vault_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."tax_vault_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_vault_packages" ADD CONSTRAINT "tax_vault_packages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_cuenta_de_cobro_id_cuentas_de_cobro_id_fk" FOREIGN KEY ("cuenta_de_cobro_id") REFERENCES "public"."cuentas_de_cobro"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_subscription_invoices" ADD CONSTRAINT "app_subscription_invoices_subscription_id_app_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."app_subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_subscriptions" ADD CONSTRAINT "app_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_warnings" ADD CONSTRAINT "deletion_warnings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_banking_details_user" ON "banking_details" USING btree ("user_id") WHERE "banking_details"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_tax_info_documents_tax_info" ON "tax_info_documents" USING btree ("tax_info_id");--> statement-breakpoint
CREATE INDEX "idx_resume_entries_resume" ON "resume_entries" USING btree ("resume_id","display_order");--> statement-breakpoint
CREATE INDEX "idx_bookings_user_start" ON "bookings" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "idx_bookings_link" ON "bookings" USING btree ("booking_link_id");--> statement-breakpoint
CREATE INDEX "idx_contract_documents_project" ON "contract_documents" USING btree ("project_id","document_type");--> statement-breakpoint
CREATE INDEX "idx_kanban_tasks_column_position" ON "kanban_tasks" USING btree ("column_id","position");--> statement-breakpoint
CREATE INDEX "idx_projects_user_status" ON "projects" USING btree ("user_id","status") WHERE "projects"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_user_stage" ON "crm_opportunities" USING btree ("user_id","stage_id") WHERE "crm_opportunities"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_cdc_user_status_due" ON "cuentas_de_cobro" USING btree ("user_id","status","due_date") WHERE "cuentas_de_cobro"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_invoices_user_status_due" ON "invoices" USING btree ("user_id","status","due_date") WHERE "invoices"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_payment_reminders_payment" ON "payment_reminders" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_payments_user_status" ON "payments" USING btree ("user_id","status") WHERE "payments"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_payments_cdc" ON "payments" USING btree ("cuenta_de_cobro_id");--> statement-breakpoint
CREATE INDEX "idx_payments_invoice" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_pila_user_period" ON "pila_records" USING btree ("user_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "idx_regulatory_config_country_effective" ON "regulatory_config_versions" USING btree ("country","effective_from");--> statement-breakpoint
CREATE INDEX "idx_tax_vault_documents_package" ON "tax_vault_documents" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "idx_tax_vault_user_period" ON "tax_vault_packages" USING btree ("user_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "idx_wh_certs_user_year_status" ON "withholding_certificates" USING btree ("user_id","tax_year","status") WHERE "withholding_certificates"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_app_sub_invoices_subscription" ON "app_subscription_invoices" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_deletion_warnings_entity" ON "deletion_warnings" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_deletion_warnings_user" ON "deletion_warnings" USING btree ("user_id","created_at");