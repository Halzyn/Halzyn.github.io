-- Email preference: notify when a contest is first published (goes live).

alter table public.profiles
  add column if not exists notify_new_contest_email boolean not null default false;

comment on column public.profiles.notify_new_contest_email is
  'When true, user receives an email when a contest they can see is newly published (managed via Edge Function + Resend).';
