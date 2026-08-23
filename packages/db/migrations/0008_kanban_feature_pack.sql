CREATE TABLE "kanban_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kanban_labels_board_name_unique" UNIQUE("board_id","name"),
	CONSTRAINT "kanban_labels_color_check" CHECK ("kanban_labels"."color" in ('blue','teal','plum','clay','olive','slate','accent','success','warning','danger'))
);
--> statement-breakpoint
CREATE TABLE "kanban_task_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"text" text NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kanban_task_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	CONSTRAINT "kanban_task_labels_task_label_unique" UNIQUE("task_id","label_id")
);
--> statement-breakpoint
ALTER TABLE "kanban_boards" ADD COLUMN "next_task_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "kanban_tasks" ADD COLUMN "task_number" integer;--> statement-breakpoint
ALTER TABLE "kanban_labels" ADD CONSTRAINT "kanban_labels_board_id_kanban_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_task_checklist_items" ADD CONSTRAINT "kanban_task_checklist_items_task_id_kanban_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."kanban_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_task_labels" ADD CONSTRAINT "kanban_task_labels_task_id_kanban_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."kanban_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_task_labels" ADD CONSTRAINT "kanban_task_labels_label_id_kanban_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."kanban_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_kanban_checklist_items_task_position" ON "kanban_task_checklist_items" USING btree ("task_id","position");
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- Kanban feature pack — card numbering (item 7) backfill.
--
-- `task_number` was added nullable (see business.ts's doc comment on
-- `kanbanTasks.taskNumber` for why: a NOT NULL column with no literal
-- default, added to a possibly-non-empty table, needs either a constant
-- default or an interactive drizzle-kit prompt this non-interactive
-- environment can't answer — so it's backfilled here instead and left
-- DB-nullable, guaranteed-populated only by application convention
-- (`createTask` always sets it for new rows).
--
-- Backfills every EXISTING task's `task_number` using creation order per
-- board (row_number() partitioned by board_id, ordered by created_at),
-- and sets each board's `next_task_number` to one past its highest
-- existing task_number (or leaves the column-default `1` for a board with
-- no tasks at all, via the COALESCE fallback). Correct in general,
-- including for today's zero-existing-rows case — not written as a
-- today-only no-op.
-- ---------------------------------------------------------------------
with numbered as (
  select
    id,
    row_number() over (partition by board_id order by created_at, id) as rn
  from public.kanban_tasks
)
update public.kanban_tasks kt
set task_number = numbered.rn
from numbered
where kt.id = numbered.id;
--> statement-breakpoint

update public.kanban_boards kb
set next_task_number = coalesce(
  (select max(kt.task_number) + 1 from public.kanban_tasks kt where kt.board_id = kb.id),
  1
);
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- Row-Level Security — same pattern as 0004_row_level_security.sql /
-- 0007_ai_provider_connections.sql: hand-written, appended to this same
-- migration rather than a separate numbered file, since it's additive to
-- the exact tables `drizzle-kit generate` just created above and there is
-- no intervening schema change to interleave with.
--
-- `kanban_labels` is transitively owned one hop through `kanban_boards`
-- (same depth/shape as `kanban_columns_owner_access` in 0004).
-- `kanban_task_labels` and `kanban_task_checklist_items` are both owned
-- transitively through `task_id` -> `kanban_tasks.board_id` (denormalized,
-- same shortcut `kanban_tasks_owner_access` already uses) ->
-- `kanban_boards` -> `projects.user_id` — one hop deeper than
-- `kanban_tasks` itself.
-- ---------------------------------------------------------------------
alter table public.kanban_labels enable row level security;
create policy "kanban_labels_owner_access" on public.kanban_labels
  for all to authenticated
  using (
    exists (
      select 1 from public.kanban_boards b
      join public.projects p on p.id = b.project_id
      where b.id = kanban_labels.board_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.kanban_boards b
      join public.projects p on p.id = b.project_id
      where b.id = kanban_labels.board_id
        and p.user_id = auth.uid()
    )
  );

alter table public.kanban_task_labels enable row level security;
create policy "kanban_task_labels_owner_access" on public.kanban_task_labels
  for all to authenticated
  using (
    exists (
      select 1 from public.kanban_tasks t
      join public.kanban_boards b on b.id = t.board_id
      join public.projects p on p.id = b.project_id
      where t.id = kanban_task_labels.task_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.kanban_tasks t
      join public.kanban_boards b on b.id = t.board_id
      join public.projects p on p.id = b.project_id
      where t.id = kanban_task_labels.task_id
        and p.user_id = auth.uid()
    )
  );

alter table public.kanban_task_checklist_items enable row level security;
create policy "kanban_task_checklist_items_owner_access" on public.kanban_task_checklist_items
  for all to authenticated
  using (
    exists (
      select 1 from public.kanban_tasks t
      join public.kanban_boards b on b.id = t.board_id
      join public.projects p on p.id = b.project_id
      where t.id = kanban_task_checklist_items.task_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.kanban_tasks t
      join public.kanban_boards b on b.id = t.board_id
      join public.projects p on p.id = b.project_id
      where t.id = kanban_task_checklist_items.task_id
        and p.user_id = auth.uid()
    )
  );