create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(user_id) on delete cascade,
  recipient_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint direct_messages_no_self check (sender_id <> recipient_id)
);

alter table public.direct_messages enable row level security;
grant select, insert, update on public.direct_messages to authenticated;

create policy "Users can read their messages"
on public.direct_messages for select to authenticated
using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);

create policy "Users can send messages"
on public.direct_messages for insert to authenticated
with check ((select auth.uid()) = sender_id);

create policy "Recipients can mark messages read"
on public.direct_messages for update to authenticated
using ((select auth.uid()) = recipient_id)
with check ((select auth.uid()) = recipient_id);

create index if not exists direct_messages_participants_created_idx
on public.direct_messages (sender_id, recipient_id, created_at desc);

create index if not exists direct_messages_recipient_created_idx
on public.direct_messages (recipient_id, created_at desc);

alter table public.direct_messages replica identity full;

DO $$ BEGIN
  alter publication supabase_realtime add table public.direct_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
