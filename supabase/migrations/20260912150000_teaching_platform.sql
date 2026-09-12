create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  level text not null default 'Beginner',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, student_id)
);

alter table public.courses enable row level security;
alter table public.course_lessons enable row level security;
alter table public.course_enrollments enable row level security;
grant select, insert, update, delete on public.courses, public.course_lessons, public.course_enrollments to authenticated;

create policy "published courses readable" on public.courses for select to authenticated using (published or teacher_id = auth.uid());
create policy "teachers create courses" on public.courses for insert to authenticated with check (teacher_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));
create policy "teachers update courses" on public.courses for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "teachers delete courses" on public.courses for delete to authenticated using (teacher_id = auth.uid());
create policy "lessons readable" on public.course_lessons for select to authenticated using (exists (select 1 from public.courses c where c.id = course_id and (c.published or c.teacher_id = auth.uid())));
create policy "teachers manage lessons" on public.course_lessons for all to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid())) with check (exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid()));
create policy "students manage enrollments" on public.course_enrollments for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), coalesce(new.raw_user_meta_data ->> 'role', 'student'))
  on conflict (id) do update set display_name = excluded.display_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
