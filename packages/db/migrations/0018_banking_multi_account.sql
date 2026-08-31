ALTER TABLE "ai_extraction_log" DROP CONSTRAINT "ai_extraction_log_document_type_check";--> statement-breakpoint
ALTER TABLE "banking_details" ADD COLUMN "currency" text DEFAULT 'COP' NOT NULL;--> statement-breakpoint
ALTER TABLE "banking_details" ADD COLUMN "certificate_file_key" text;--> statement-breakpoint
ALTER TABLE "banking_details" ADD COLUMN "certificate_file_name" text;--> statement-breakpoint
ALTER TABLE "ai_extraction_log" ADD CONSTRAINT "ai_extraction_log_document_type_check" CHECK ("ai_extraction_log"."document_type" in ('resume','bank_certificate'));