alter table public.profiles
  add column if not exists region text not null default 'Global';

alter table public.profiles
  add constraint profiles_region_length check (char_length(region) between 2 and 40);
