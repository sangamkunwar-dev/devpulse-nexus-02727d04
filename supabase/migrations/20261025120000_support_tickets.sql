create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

drop policy if exists "Users can create their own support tickets" on public.support_tickets;
create policy "Users can create their own support tickets"
  on public.support_tickets for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own support tickets" on public.support_tickets;
create policy "Users can view their own support tickets"
  on public.support_tickets for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Admins can view all support tickets" on public.support_tickets;
create policy "Admins can view all support tickets"
  on public.support_tickets for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'::public.app_role));

grant select, insert on public.support_tickets to authenticated;
