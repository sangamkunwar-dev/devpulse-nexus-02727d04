-- Allow the teacher role used by the application.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'teacher', 'developer'));

-- Keep profile creation reliable for email and Google signups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  requested_role text;
begin
  base_username := lower(regexp_replace(split_part(coalesce(new.email, 'dev'), '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  requested_role := case
    when new.raw_user_meta_data->>'role' in ('student', 'teacher', 'developer') then new.raw_user_meta_data->>'role'
    else 'student'
  end;

  insert into public.profiles (user_id, username, display_name, avatar_url, role)
  values (
    new.id,
    coalesce(nullif(base_username, ''), 'user') || '_' || substr(replace(new.id::text, '-', ''), 1, 6),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'Dev'), '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    requested_role
  )
  on conflict (user_id) do update set
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

-- Repair existing auth users that were created without a profile.
insert into public.profiles (user_id, username, display_name, avatar_url, role)
select
  u.id,
  coalesce(nullif(lower(regexp_replace(split_part(coalesce(u.email, 'dev'), '@', 1), '[^a-zA-Z0-9_]', '', 'g')), ''), 'user') || '_' || substr(replace(u.id::text, '-', ''), 1, 6),
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(coalesce(u.email, 'Dev'), '@', 1)),
  u.raw_user_meta_data->>'avatar_url',
  case when u.raw_user_meta_data->>'role' in ('student', 'teacher', 'developer') then u.raw_user_meta_data->>'role' else 'student' end
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;

notify pgrst, 'reload schema';
