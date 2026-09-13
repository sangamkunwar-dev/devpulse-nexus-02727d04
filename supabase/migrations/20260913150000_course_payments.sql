-- Course payment records and teacher platform earnings.
create table if not exists public.course_payments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'usd',
  provider text not null check (provider in ('stripe','khalti')),
  provider_session_id text unique,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.teacher_earnings (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  payment_id uuid not null unique references public.course_payments(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'usd',
  created_at timestamptz not null default now()
);

alter table public.course_payments enable row level security;
alter table public.teacher_earnings enable row level security;
create policy "students view own payments" on public.course_payments for select to authenticated using ((select auth.uid()) = student_id);
create policy "teachers view course payments" on public.course_payments for select to authenticated using ((select auth.uid()) = teacher_id);
create policy "teachers view own earnings" on public.teacher_earnings for select to authenticated using ((select auth.uid()) = teacher_id);
create index if not exists course_payments_teacher_idx on public.course_payments(teacher_id, status);
create index if not exists teacher_earnings_teacher_idx on public.teacher_earnings(teacher_id);
