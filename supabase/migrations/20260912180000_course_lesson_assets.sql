alter table public.course_lessons
  add column if not exists asset_path text,
  add column if not exists asset_name text,
  add column if not exists asset_content_type text;

create index if not exists course_lessons_course_position_idx
  on public.course_lessons(course_id, position);
