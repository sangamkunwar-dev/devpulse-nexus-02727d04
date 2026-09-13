-- Allow students to leave their own course enrollment.
-- Teachers already have delete access to their courses through the existing course policy.

grant delete on public.course_enrollments to authenticated;

drop policy if exists "students delete own enrollments" on public.course_enrollments;
create policy "students delete own enrollments"
on public.course_enrollments
for delete
to authenticated
using ((select auth.uid()) = student_id);
