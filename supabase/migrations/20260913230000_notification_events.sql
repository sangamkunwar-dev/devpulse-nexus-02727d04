-- Add lesson and course update notification kinds.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('message','follow','course_created','enrollment_request','enrollment_status','lesson_created','course_updated','student_removed'));

create or replace function public.notify_lesson_created()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind, title, body, href)
  select e.student_id, c.teacher_id, 'lesson_created', 'New lesson available', new.title, '/courses/' || new.course_id::text
  from public.course_enrollments e join public.courses c on c.id = new.course_id
  where e.course_id = new.course_id and e.status = 'accepted';
  return new;
end;
$$;
drop trigger if exists lesson_created_notification on public.course_lessons;
create trigger lesson_created_notification after insert on public.course_lessons for each row execute function public.notify_lesson_created();

create or replace function public.notify_course_updated()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.title is distinct from old.title or new.description is distinct from old.description or new.meeting_url is distinct from old.meeting_url or new.meeting_at is distinct from old.meeting_at or new.published is distinct from old.published then
    insert into public.notifications (recipient_id, actor_id, kind, title, body, href)
    select e.student_id, new.teacher_id, 'course_updated', 'Course updated', new.title, '/courses/' || new.id::text
    from public.course_enrollments e where e.course_id = new.id and e.status = 'accepted';
  end if;
  return new;
end;
$$;
drop trigger if exists course_updated_notification on public.courses;
create trigger course_updated_notification after update on public.courses for each row execute function public.notify_course_updated();

create or replace function public.notify_student_removed()
returns trigger language plpgsql security definer set search_path = public
as $$
declare course_title text; teacher uuid;
begin
  select c.title, c.teacher_id into course_title, teacher from public.courses c where c.id = old.course_id;
  insert into public.notifications (recipient_id, actor_id, kind, title, body, href)
  values (old.student_id, teacher, 'student_removed', 'Course access updated', coalesce(course_title, 'Your course access was removed.'), '/courses');
  return old;
end;
$$;
drop trigger if exists enrollment_removed_notification on public.course_enrollments;
create trigger enrollment_removed_notification after delete on public.course_enrollments for each row execute function public.notify_student_removed();
