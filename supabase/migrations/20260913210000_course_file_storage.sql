alter table public.course_files add column if not exists storage_path text;
alter table public.course_files add column if not exists size_bytes bigint;
alter table public.course_files add column if not exists mime_type text;

create index if not exists course_files_parent_idx on public.course_files(course_id, parent_id, name);

-- Keep file metadata private to course members through the existing course_files RLS policies.
