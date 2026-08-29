ALTER TABLE "users" ADD COLUMN "next_cuenta_de_cobro_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "next_invoice_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "cuentas_de_cobro" ADD COLUMN "items" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "items" jsonb;