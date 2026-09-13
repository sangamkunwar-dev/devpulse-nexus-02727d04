alter publication supabase_realtime add table public.course_enrollments;

create unique index if not exists course_payments_student_course_pending_idx
  on public.course_payments(student_id, course_id)
  where status = 'pending';
