ALTER TABLE "kanban_tasks" DROP CONSTRAINT "kanban_tasks_column_id_kanban_columns_id_fk";
--> statement-breakpoint
ALTER TABLE "kanban_tasks" ALTER COLUMN "column_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kanban_tasks" ADD CONSTRAINT "kanban_tasks_column_id_kanban_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."kanban_columns"("id") ON DELETE set null ON UPDATE no action;