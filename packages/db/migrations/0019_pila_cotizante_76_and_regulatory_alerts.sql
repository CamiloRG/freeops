CREATE TABLE "regulatory_config_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"regulatory_config_version_id" uuid NOT NULL,
	"country" text NOT NULL,
	"effective_from" date NOT NULL,
	"source_reference" text,
	"status" text DEFAULT 'open' NOT NULL,
	"acknowledged_by_user_id" uuid,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regulatory_config_alerts_status_check" CHECK ("regulatory_config_alerts"."status" in ('open','acknowledged'))
);
--> statement-breakpoint
ALTER TABLE "pila_records" ALTER COLUMN "health_contribution" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pila_records" ADD COLUMN "arl_ibc" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "pila_records" ADD COLUMN "cotizante_type" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "pila_records" ADD COLUMN "days_worked_in_period" integer;--> statement-breakpoint
ALTER TABLE "pila_records" ADD COLUMN "arl_risk_class" text;--> statement-breakpoint
ALTER TABLE "pila_records" ADD COLUMN "compensation_fund_rate" numeric(6, 4);--> statement-breakpoint
ALTER TABLE "pila_records" ADD COLUMN "compensation_fund_contribution" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "regulatory_config_alerts" ADD CONSTRAINT "regulatory_config_alerts_regulatory_config_version_id_regulatory_config_versions_id_fk" FOREIGN KEY ("regulatory_config_version_id") REFERENCES "public"."regulatory_config_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_config_alerts" ADD CONSTRAINT "regulatory_config_alerts_acknowledged_by_user_id_users_id_fk" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_regulatory_config_alerts_status" ON "regulatory_config_alerts" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "pila_records" ADD CONSTRAINT "pila_records_cotizante_type_check" CHECK ("pila_records"."cotizante_type" in ('standard','76'));--> statement-breakpoint
ALTER TABLE "pila_records" ADD CONSTRAINT "pila_records_days_worked_check" CHECK ("pila_records"."days_worked_in_period" is null or "pila_records"."days_worked_in_period" between 1 and 30);--> statement-breakpoint
ALTER TABLE "pila_records" ADD CONSTRAINT "pila_records_arl_risk_class_check" CHECK ("pila_records"."arl_risk_class" is null or "pila_records"."arl_risk_class" in ('I','II','III','IV','V'));