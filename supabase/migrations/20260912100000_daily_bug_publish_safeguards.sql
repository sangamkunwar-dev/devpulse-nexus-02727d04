-- Ensure one published daily bug per calendar date.
create unique index if not exists challenges_one_per_day
  on public.challenges (challenge_date);

-- Keep the scheduler able to read the admin-controlled schedule.
grant select on public.daily_bug_settings to service_role;
grant update on public.daily_bug_settings to authenticated;

-- The app server performs AI generation and publishes with the service role.
comment on table public.daily_bug_settings is
  'The app cron checks this schedule every minute and publishes once the configured local time has passed.';
