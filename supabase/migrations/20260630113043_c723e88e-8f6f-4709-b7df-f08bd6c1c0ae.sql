ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS task_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pending_tasks jsonb NOT NULL DEFAULT '[]'::jsonb;