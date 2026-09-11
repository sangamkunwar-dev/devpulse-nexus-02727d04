-- Ensures the Admin template pool exists even when the original seed migration was skipped.
create table if not exists public.challenge_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  language text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  prompt text not null,
  broken_code text not null,
  hint text,
  xp_reward integer not null default 50 check (xp_reward between 1 and 1000),
  answer_pattern text not null,
  explanation text not null,
  last_used_on date,
  created_at timestamptz not null default now()
);

alter table public.challenge_templates enable row level security;
grant select on public.challenge_templates to authenticated;
grant all on public.challenge_templates to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'challenge_templates'
      and policyname = 'admins manage templates'
  ) then
    create policy "admins manage templates"
      on public.challenge_templates
      for all
      to authenticated
      using (public.has_role(auth.uid(), 'admin'::public.app_role))
      with check (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end
$$;

insert into public.challenge_templates
  (title, language, difficulty, prompt, broken_code, hint, xp_reward, answer_pattern, explanation)
select
  'Off-by-one loop',
  'javascript',
  'easy',
  'This loop reads one item past the end of the array. Fix the loop condition.',
  'for (let i = 0; i <= arr.length; i++) {\n  console.log(arr[i]);\n}',
  'Array indexes stop at length - 1.',
  40,
  'for\\s*\\(\\s*let\\s+i\\s*=\\s*0\\s*;\\s*i\\s*<\\s*arr\\.length\\s*;\\s*i\\+\\+\\s*\\)',
  'Use < arr.length because the final valid index is length - 1.'
where not exists (select 1 from public.challenge_templates);
