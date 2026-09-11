create table if not exists public.daily_bug_settings (
  id boolean primary key default true check (id),
  publish_time time not null default '00:05:00',
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.daily_bug_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.daily_bug_settings enable row level security;

create policy "Authenticated users can view daily bug schedule"
on public.daily_bug_settings for select
to authenticated
using (true);

create policy "Admins can manage daily bug schedule"
on public.daily_bug_settings for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
