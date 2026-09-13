-- Fix follow discovery and expose public follower counts safely.
create or replace function public.search_users(search_term text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_following boolean,
  follows_you boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    exists (
      select 1
      from public.user_follows f
      where f.follower_id = (select auth.uid())
        and f.following_id = p.user_id
    ) as is_following,
    exists (
      select 1
      from public.user_follows f
      where f.follower_id = p.user_id
        and f.following_id = (select auth.uid())
    ) as follows_you
  from public.profiles p
  join auth.users au on au.id = p.user_id
  where (select auth.uid()) is not null
    and p.user_id <> (select auth.uid())
    and length(trim(search_term)) >= 2
    and (
      lower(coalesce(p.username, '')) like '%' || lower(trim(search_term)) || '%'
      or lower(coalesce(p.display_name, '')) like '%' || lower(trim(search_term)) || '%'
      or lower(coalesce(au.email, '')) like '%' || lower(trim(search_term)) || '%'
    )
  order by p.username nulls last
  limit 12;
$$;

revoke execute on function public.search_users(text) from public, anon;
grant execute on function public.search_users(text) to authenticated;

create or replace function public.get_follow_counts(profile_user_id uuid)
returns table (followers_count bigint, following_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.user_follows where following_id = profile_user_id),
    (select count(*) from public.user_follows where follower_id = profile_user_id);
$$;

revoke execute on function public.get_follow_counts(uuid) from public, anon;
grant execute on function public.get_follow_counts(uuid) to anon, authenticated;
