create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  role text not null default 'student' check (role in ('student', 'developer', 'teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null,
  description text not null default '',
  level text not null default 'Beginner',
  repo_url text,
  is_free boolean not null default true,
  price numeric(10,2) not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.courses add column if not exists repo_url text;
alter table public.courses add column if not exists is_free boolean not null default true;
alter table public.courses add column if not exists price numeric(10,2) not null default 0;

create table if not exists public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  content text not null default '',
  position integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (course_id, student_id)
);
alter table public.course_enrollments add column if not exists status text not null default 'pending';

alter table public.courses enable row level security;
alter table public.course_lessons enable row level security;
alter table public.course_enrollments enable row level security;
grant select, insert, update, delete on public.courses, public.course_lessons, public.course_enrollments to authenticated;

drop policy if exists "published courses readable" on public.courses;
create policy "published courses readable" on public.courses for select to authenticated using (published or teacher_id = auth.uid());
drop policy if exists "teachers create courses" on public.courses;
create policy "teachers create courses" on public.courses for insert to authenticated with check (teacher_id = auth.uid() and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('teacher', 'developer')));
drop policy if exists "teachers update courses" on public.courses;
create policy "teachers update courses" on public.courses for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
drop policy if exists "teachers delete courses" on public.courses;
create policy "teachers delete courses" on public.courses for delete to authenticated using (teacher_id = auth.uid());
drop policy if exists "lessons readable" on public.course_lessons;
create policy "lessons readable" on public.course_lessons for select to authenticated using (
  exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())
  or exists (select 1 from public.courses c join public.course_enrollments e on e.course_id = c.id where c.id = course_lessons.course_id and e.student_id = auth.uid() and e.status = 'accepted')
);
drop policy if exists "teachers manage lessons" on public.course_lessons;
create policy "teachers manage lessons" on public.course_lessons for all to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())) with check (exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid()));
drop policy if exists "students manage enrollments" on public.course_enrollments;
create policy "students manage enrollments" on public.course_enrollments for insert to authenticated with check (student_id = auth.uid() and exists (select 1 from public.courses c where c.id = course_id and (c.is_free or c.published)));
create policy "students view own enrollments" on public.course_enrollments for select to authenticated using (student_id = auth.uid());
create policy "teachers view course enrollments" on public.course_enrollments for select to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid()));
create policy "teachers approve enrollments" on public.course_enrollments for update to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())) with check (exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), case when new.raw_user_meta_data ->> 'role' = 'teacher' then 'teacher' else 'student' end)
  on conflict (user_id) do update set display_name = excluded.display_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
