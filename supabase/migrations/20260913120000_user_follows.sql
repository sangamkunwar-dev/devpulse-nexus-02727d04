create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.user_follows enable row level security;
grant select, insert, delete on public.user_follows to authenticated;

drop policy if exists "users can view their follows" on public.user_follows;
create policy "users can view their follows" on public.user_follows
  for select to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

drop policy if exists "users can follow others" on public.user_follows;
create policy "users can follow others" on public.user_follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()) and follower_id <> following_id);

drop policy if exists "users can unfollow others" on public.user_follows;
create policy "users can unfollow others" on public.user_follows
  for delete to authenticated
  using (follower_id = (select auth.uid()));

create or replace function public.search_users(search_term text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_following boolean
)
language sql
security definer
set search_path = public
as $$
  select p.user_id, p.username, p.display_name, p.avatar_url,
    exists (
      select 1 from public.user_follows f
      where f.follower_id = (select auth.uid()) and f.following_id = p.user_id
    ) as is_following
  from public.profiles p
  join auth.users au on au.id = p.user_id
  where (select auth.uid()) is not null
    and p.user_id <> (select auth.uid())
    and length(trim(search_term)) >= 2
    and (
      lower(coalesce(p.username, '')) like '%' || lower(trim(search_term)) || '%'
      or lower(coalesce(p.display_name, '')) like '%' || lower(trim(search_term)) || '%'
      or lower(au.email) like '%' || lower(trim(search_term)) || '%'
    )
  order by p.username nulls last
  limit 12;
$$;

revoke execute on function public.search_users(text) from public, anon;
grant execute on function public.search_users(text) to authenticated;
