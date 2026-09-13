alter table public.notifications
  add column if not exists email_sent_at timestamptz;

create index if not exists notifications_pending_email_idx
  on public.notifications (created_at)
  where email_sent_at is null;

grant update (email_sent_at) on public.notifications to service_role;
