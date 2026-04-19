-- VGM guessing contests: apply via Supabase CLI or paste into SQL editor (once).

create extension if not exists "pgcrypto";

-- Profiles (admin flag)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles update own"
  on public.profiles for update
  using (auth.uid() = id);

-- Must exist before policies reference it
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- Contests
create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  deadline timestamptz not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists contests_deadline_idx on public.contests (deadline desc);

alter table public.contests enable row level security;

create policy "contests public read published"
  on public.contests for select
  using (published = true or public.is_admin());

create policy "contests admin write"
  on public.contests for all
  using (public.is_admin())
  with check (public.is_admin());

-- Tracks
create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests (id) on delete cascade,
  sort_order int not null,
  difficulty text,
  audio_path text not null,
  unique (contest_id, sort_order)
);

create index if not exists tracks_contest_idx on public.tracks (contest_id);

alter table public.tracks enable row level security;

create policy "tracks public read if contest visible"
  on public.tracks for select
  using (
    exists (
      select 1 from public.contests c
      where c.id = tracks.contest_id
        and (c.published = true or public.is_admin())
    )
  );

create policy "tracks admin write"
  on public.tracks for all
  using (public.is_admin())
  with check (public.is_admin());

-- Answers (hidden until deadline passes)
create table if not exists public.track_answers (
  track_id uuid primary key references public.tracks (id) on delete cascade,
  game_title text not null,
  franchise text,
  notes text
);

alter table public.track_answers enable row level security;

create policy "track_answers read after deadline or admin"
  on public.track_answers for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.tracks t
      join public.contests c on c.id = t.contest_id
      where t.id = track_answers.track_id
        and c.published = true
        and c.deadline < now()
    )
  );

create policy "track_answers admin write"
  on public.track_answers for all
  using (public.is_admin())
  with check (public.is_admin());

-- Submissions
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests (id) on delete cascade,
  contestant_name text not null,
  created_at timestamptz not null default now(),
  constraint contestant_name_len check (
    char_length(trim(contestant_name)) between 1 and 80
  )
);

create index if not exists submissions_contest_idx on public.submissions (contest_id);

alter table public.submissions enable row level security;

create policy "submissions admin read"
  on public.submissions for select
  using (public.is_admin());

create policy "submissions public read after deadline"
  on public.submissions for select
  using (
    exists (
      select 1 from public.contests c
      where c.id = submissions.contest_id
        and c.published = true
        and c.deadline < now()
    )
  );

create policy "submissions admin delete"
  on public.submissions for delete
  using (public.is_admin());

-- Guesses (admin-only visibility)
create table if not exists public.submission_guesses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  guess_text text not null default '',
  unique (submission_id, track_id),
  constraint guess_text_len check (char_length(guess_text) <= 500)
);

alter table public.submission_guesses enable row level security;

create policy "submission_guesses admin read"
  on public.submission_guesses for select
  using (public.is_admin());

create policy "submission_guesses admin delete"
  on public.submission_guesses for delete
  using (public.is_admin());

-- Grading: 'game' = X, 'franchise' = ~
create table if not exists public.grading_marks (
  submission_id uuid not null references public.submissions (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  mark text not null check (mark in ('game', 'franchise')),
  primary key (submission_id, track_id)
);

alter table public.grading_marks enable row level security;

create policy "grading_marks public read after deadline"
  on public.grading_marks for select
  using (
    exists (
      select 1
      from public.submissions s
      join public.contests c on c.id = s.contest_id
      where s.id = grading_marks.submission_id
        and c.published = true
        and c.deadline < now()
    )
  );

create policy "grading_marks admin read"
  on public.grading_marks for select
  using (public.is_admin());

create policy "grading_marks admin write"
  on public.grading_marks for insert
  with check (public.is_admin());

create policy "grading_marks admin update"
  on public.grading_marks for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "grading_marks admin delete"
  on public.grading_marks for delete
  using (public.is_admin());

-- New user -> profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomic public submit (bypasses direct table grants)
create or replace function public.submit_contest_entry(
  p_contest_id uuid,
  p_contestant_name text,
  p_guesses jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id uuid;
  c_deadline timestamptz;
  c_published boolean;
  r record;
begin
  select deadline, published into c_deadline, c_published
  from public.contests
  where id = p_contest_id;

  if not found then
    raise exception 'Contest not found';
  end if;

  if c_published is distinct from true then
    raise exception 'Contest is not open';
  end if;

  if c_deadline <= now() then
    raise exception 'Submissions are closed';
  end if;

  if length(trim(p_contestant_name)) < 1 or length(trim(p_contestant_name)) > 80 then
    raise exception 'Invalid name';
  end if;

  insert into public.submissions (contest_id, contestant_name)
  values (p_contest_id, trim(p_contestant_name))
  returning id into v_submission_id;

  for r in
    select *
    from jsonb_to_recordset(p_guesses) as x(track_id uuid, text text)
  loop
    if not exists (
      select 1 from public.tracks t
      where t.id = r.track_id and t.contest_id = p_contest_id
    ) then
      raise exception 'Invalid track';
    end if;

    insert into public.submission_guesses (submission_id, track_id, guess_text)
    values (
      v_submission_id,
      r.track_id,
      left(trim(coalesce(r.text, '')), 500)
    );
  end loop;

  return v_submission_id;
end;
$$;

grant execute on function public.submit_contest_entry(uuid, text, jsonb) to anon, authenticated;

-- Storage
insert into storage.buckets (id, name, public)
values ('contest-audio', 'contest-audio', true)
on conflict (id) do nothing;

create policy "contest audio public read"
  on storage.objects for select
  using (bucket_id = 'contest-audio');

create policy "contest audio admin write"
  on storage.objects for insert
  with check (bucket_id = 'contest-audio' and public.is_admin());

create policy "contest audio admin update"
  on storage.objects for update
  using (bucket_id = 'contest-audio' and public.is_admin());

create policy "contest audio admin remove"
  on storage.objects for delete
  using (bucket_id = 'contest-audio' and public.is_admin());
