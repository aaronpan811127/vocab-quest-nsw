UPDATE public.generation_jobs
SET status='failed',
    error_message=COALESCE(error_message, 'Stalled — edge function timeout (auto-resolved)'),
    finished_at=COALESCE(finished_at, now())
WHERE status='running' AND updated_at < now() - interval '10 minutes';