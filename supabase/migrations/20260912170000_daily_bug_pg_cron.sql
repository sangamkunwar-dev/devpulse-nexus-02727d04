-- Run this SQL after enabling pg_cron and pg_net in Supabase.
-- Replace the two settings below with your deployed app URL and CRON_SECRET.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'daily-bug-publisher';

select cron.schedule(
  'daily-bug-publisher',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://devpulse.sangamkunwar.com.np/api/cron/daily-bug',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body := jsonb_build_object('source', 'supabase-pg-cron')
  );
  $$
);

select jobid, jobname, schedule, active
from cron.job
where jobname = 'daily-bug-publisher';
