grant delete on public.course_enrollments to authenticated;

drop policy if exists "students delete own enrollments" on public.course_enrollments;
create policy "students delete own enrollments"
on public.course_enrollments for delete to authenticated
using (student_id = (select auth.uid()));

drop policy if exists "teachers delete course enrollments" on public.course_enrollments;
create policy "teachers delete course enrollments"
on public.course_enrollments for delete to authenticated
using (
  exists (
    select 1 from public.courses c
    where c.id = course_id and c.teacher_id = (select auth.uid())
  )
);

create index if not exists course_enrollments_student_course_idx
  on public.course_enrollments (student_id, course_id);
