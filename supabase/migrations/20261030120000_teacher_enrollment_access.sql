drop policy if exists "teachers view enrollment requests" on public.course_enrollments;
create policy "teachers view enrollment requests"
  on public.course_enrollments for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid()));

drop policy if exists "teachers remove enrollment requests" on public.course_enrollments;
create policy "teachers remove enrollment requests"
  on public.course_enrollments for delete to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid()));
