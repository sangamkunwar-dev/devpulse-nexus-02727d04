create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(user_id) on delete cascade,
  actor_id uuid references public.profiles(user_id) on delete set null,
  kind text not null check (kind in ('message', 'follow', 'course_created', 'enrollment_request', 'enrollment_status')),
  title text not null,
  body text not null default '',
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
grant select, update on public.notifications to authenticated;

create policy "Users can read their notifications"
on public.notifications for select to authenticated
using ((select auth.uid()) = recipient_id);

create policy "Users can mark their notifications read"
on public.notifications for update to authenticated
using ((select auth.uid()) = recipient_id)
with check ((select auth.uid()) = recipient_id);

create index if not exists notifications_recipient_created_idx
on public.notifications (recipient_id, created_at desc);

create or replace function public.notify_message_recipient()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind, title, body, href)
  values (new.recipient_id, new.sender_id, 'message', 'New message', left(new.body, 140), '/messages?userId=' || new.sender_id::text);
  return new;
end;
$$;

drop trigger if exists direct_message_notification on public.direct_messages;
create trigger direct_message_notification after insert on public.direct_messages
for each row execute function public.notify_message_recipient();

create or replace function public.notify_follow_recipient()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind, title, body, href)
  values (new.following_id, new.follower_id, 'follow', 'New follower', 'Someone started following you.', '/u/' || coalesce((select username from public.profiles where user_id = new.follower_id), ''));
  return new;
end;
$$;

drop trigger if exists user_follow_notification on public.user_follows;
create trigger user_follow_notification after insert on public.user_follows
for each row execute function public.notify_follow_recipient();

create or replace function public.notify_course_created()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind, title, body, href)
  select f.follower_id, new.teacher_id, 'course_created', 'New course from someone you follow', new.title, '/courses/' || new.id::text
  from public.user_follows f
  where f.following_id = new.teacher_id;
  return new;
end;
$$;

drop trigger if exists course_created_notification on public.courses;
create trigger course_created_notification after insert on public.courses
for each row execute function public.notify_course_created();

create or replace function public.notify_enrollment_event()
returns trigger language plpgsql security definer set search_path = public
as $$
declare course_title text;
begin
  select title into course_title from public.courses where id = new.course_id;
  if tg_op = 'INSERT' then
    insert into public.notifications (recipient_id, actor_id, kind, title, body, href)
    select teacher_id, new.student_id, 'enrollment_request', 'New course join request', coalesce(course_title, 'A student requested access.'), '/teacher/courses/' || new.course_id::text
    from public.courses where id = new.course_id;
  elsif new.status is distinct from old.status then
    insert into public.notifications (recipient_id, actor_id, kind, title, body, href)
    values (new.student_id, (select teacher_id from public.courses where id = new.course_id), 'enrollment_status', 'Course request updated', coalesce(course_title, 'Your course request was updated.'), '/courses/' || new.course_id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists enrollment_notification on public.course_enrollments;
create trigger enrollment_notification after insert or update of status on public.course_enrollments
for each row execute function public.notify_enrollment_event();

alter table public.notifications replica identity full;
DO $$ BEGIN
  alter publication supabase_realtime add table public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
