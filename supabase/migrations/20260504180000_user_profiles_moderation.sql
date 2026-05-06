-- User profiles (username, display name, bio, player #), submission ownership, contest moderators.

create extension if not exists citext;

-- --- Profiles: public fields -------------------------------------------------
alter table public.profiles
  add column if not exists username citext,
  add column if not exists display_name text,
  add column if not exists bio text;

alter table public.profiles
  add column if not exists player_number int;

create unique index if not exists profiles_username_lower_key on public.profiles (lower(username::text));

update public.profiles p
set player_number = s.rn
from (
  select id, row_number() over (order by created_at asc) as rn
  from public.profiles
  where player_number is null
) s
where p.id = s.id;

create sequence if not exists public.profiles_player_number_seq;
select setval(
  'public.profiles_player_number_seq',
  coalesce((select max(player_number) from public.profiles), 0)
);

update public.profiles
set player_number = nextval('public.profiles_player_number_seq')
where player_number is null;

create unique index if not exists profiles_player_number_key on public.profiles (player_number);

-- Admins can load any profile row (user management)
drop policy if exists "profiles admin read all" on public.profiles;
create policy "profiles admin read all"
  on public.profiles for select
  using (public.is_admin());

create or replace function public.profiles_assign_player_number()
returns trigger
language plpgsql
as $$
begin
  if new.player_number is null then
    new.player_number := nextval('public.profiles_player_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_assign_player_number_trg on public.profiles;
create trigger profiles_assign_player_number_trg
  before insert on public.profiles
  for each row execute function public.profiles_assign_player_number();

-- --- Contest moderators -------------------------------------------------------
create table if not exists public.contest_moderators (
  contest_id uuid not null references public.contests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (contest_id, user_id)
);

create index if not exists contest_moderators_user_idx on public.contest_moderators (user_id);

alter table public.contest_moderators enable row level security;

drop policy if exists "contest_moderators read own or admin" on public.contest_moderators;
create policy "contest_moderators read own or admin"
  on public.contest_moderators for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "contest_moderators admin write" on public.contest_moderators;
create policy "contest_moderators admin write"
  on public.contest_moderators for all
  using (public.is_admin())
  with check (public.is_admin());

-- --- Submissions: optional owner ---------------------------------------------
alter table public.submissions
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists submissions_user_id_idx on public.submissions (user_id);

-- --- Helper functions ---------------------------------------------------------
create or replace function public.is_contest_mod(p_contest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.contest_moderators m
    where m.contest_id = p_contest_id
      and m.user_id = auth.uid()
  );
$$;

grant execute on function public.is_contest_mod(uuid) to authenticated, anon;

create or replace function public.can_manage_contest(p_contest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_contest_mod(p_contest_id);
$$;

grant execute on function public.can_manage_contest(uuid) to authenticated, anon;

create or replace function public.login_identifier_to_email(p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trim text := trim(coalesce(p_identifier, ''));
  v_email text;
begin
  if v_trim = '' then
    return null;
  end if;

  if v_trim like '%@%' then
    select u.email into v_email
    from auth.users u
    where lower(u.email) = lower(v_trim)
    limit 1;
    return v_email;
  end if;

  select u.email into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username::text) = lower(v_trim)
  limit 1;

  return v_email;
end;
$$;

grant execute on function public.login_identifier_to_email(text) to anon, authenticated;

create or replace function public.username_is_available(p_username text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_clean citext := nullif(lower(trim(coalesce(p_username, ''))), '');
begin
  if v_clean is null or length(v_clean::text) < 2 then
    return false;
  end if;

  return not exists (
    select 1 from public.profiles p where lower(p.username::text) = v_clean::text
  );
end;
$$;

grant execute on function public.username_is_available(text) to anon, authenticated;

create or replace function public.list_players_public()
returns table (
  id uuid,
  username citext,
  display_name text,
  bio text,
  player_number int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    coalesce(nullif(trim(p.display_name), ''), p.username::text) as display_name,
    p.bio,
    p.player_number,
    p.created_at
  from public.profiles p
  where p.username is not null
  order by p.player_number asc nulls last, p.created_at asc;
$$;

grant execute on function public.list_players_public() to anon, authenticated;

create or replace function public.get_public_profile_by_username(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trim text := trim(coalesce(p_username, ''));
  r record;
begin
  if v_trim = '' then
    return null;
  end if;

  select
    p.id,
    p.username,
    coalesce(nullif(trim(p.display_name), ''), p.username::text) as display_name,
    p.bio,
    p.player_number,
    p.created_at
  into r
  from public.profiles p
  where lower(p.username::text) = lower(v_trim)
    and p.username is not null;

  if r.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', r.id,
    'username', r.username,
    'display_name', r.display_name,
    'bio', r.bio,
    'player_number', r.player_number,
    'created_at', r.created_at
  );
end;
$$;

grant execute on function public.get_public_profile_by_username(text) to anon, authenticated;

-- New user: fill profile from auth metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := nullif(trim(lower(coalesce(new.raw_user_meta_data->>'username', ''))), '');
  v_disp text := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
begin
  insert into public.profiles (id, username, display_name, bio)
  values (
    new.id,
    case when v_user = '' then null else v_user::citext end,
    case
      when v_disp <> '' then v_disp
      when v_user <> '' then v_user
      else null
    end,
    null
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- --- RLS: contests -----------------------------------------------------------
drop policy if exists "contests public read published" on public.contests;
create policy "contests public read published"
  on public.contests for select
  using (
    published = true
    or public.is_admin()
    or public.is_contest_mod(id)
  );

drop policy if exists "contests admin write" on public.contests;
create policy "contests insert admin only"
  on public.contests for insert
  with check (public.is_admin());

create policy "contests update managers"
  on public.contests for update
  using (public.can_manage_contest(id))
  with check (public.can_manage_contest(id));

create policy "contests delete admin only"
  on public.contests for delete
  using (public.is_admin());

-- --- RLS: tracks -------------------------------------------------------------
drop policy if exists "tracks public read if contest visible" on public.tracks;
create policy "tracks public read if contest visible"
  on public.tracks for select
  using (
    exists (
      select 1
      from public.contests c
      where c.id = tracks.contest_id
        and (
          c.published = true
          or public.is_admin()
          or public.is_contest_mod(c.id)
        )
    )
  );

drop policy if exists "tracks admin write" on public.tracks;
create policy "tracks managers write"
  on public.tracks for all
  using (public.can_manage_contest(contest_id))
  with check (public.can_manage_contest(contest_id));

-- --- RLS: track_answers ------------------------------------------------------
drop policy if exists "track_answers read after deadline or admin" on public.track_answers;
create policy "track_answers read after deadline or admin"
  on public.track_answers for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.tracks t
      join public.contests c on c.id = t.contest_id
      where t.id = track_answers.track_id
        and public.is_contest_mod(c.id)
    )
    or exists (
      select 1
      from public.tracks t
      join public.contests c on c.id = t.contest_id
      where t.id = track_answers.track_id
        and c.published = true
        and c.deadline < now()
        and c.results_published = true
    )
  );

drop policy if exists "track_answers admin write" on public.track_answers;
create policy "track_answers managers write"
  on public.track_answers for all
  using (
    exists (
      select 1
      from public.tracks t
      where t.id = track_answers.track_id
        and public.can_manage_contest(t.contest_id)
    )
  )
  with check (
    exists (
      select 1
      from public.tracks t
      where t.id = track_answers.track_id
        and public.can_manage_contest(t.contest_id)
    )
  );

-- --- RLS: submissions --------------------------------------------------------
drop policy if exists "submissions admin read" on public.submissions;
create policy "submissions admin read"
  on public.submissions for select
  using (public.is_admin());

drop policy if exists "submissions public read after deadline" on public.submissions;
create policy "submissions public read after deadline"
  on public.submissions for select
  using (
    exists (
      select 1 from public.contests c
      where c.id = submissions.contest_id
        and c.published = true
        and c.deadline < now()
        and c.results_published = true
    )
  );

create policy "submissions contest managers read"
  on public.submissions for select
  using (public.can_manage_contest(contest_id));

create policy "submissions public profile history"
  on public.submissions for select
  using (
    user_id is not null
    and exists (
      select 1 from public.contests c
      where c.id = submissions.contest_id
        and c.published = true
        and c.deadline < now()
        and c.results_published = true
    )
  );

-- --- RLS: submission_guesses -------------------------------------------------
drop policy if exists "submission_guesses admin read" on public.submission_guesses;
create policy "submission_guesses admin read"
  on public.submission_guesses for select
  using (public.is_admin());

create policy "submission_guesses managers read"
  on public.submission_guesses for select
  using (
    exists (
      select 1
      from public.submissions s
      where s.id = submission_guesses.submission_id
        and public.can_manage_contest(s.contest_id)
    )
  );

-- --- RLS: grading_marks ------------------------------------------------------
drop policy if exists "grading_marks public read after deadline" on public.grading_marks;
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
        and c.results_published = true
    )
  );

drop policy if exists "grading_marks admin read" on public.grading_marks;
create policy "grading_marks admin read"
  on public.grading_marks for select
  using (public.is_admin());

create policy "grading_marks managers read"
  on public.grading_marks for select
  using (
    exists (
      select 1
      from public.submissions s
      where s.id = grading_marks.submission_id
        and public.can_manage_contest(s.contest_id)
    )
  );

drop policy if exists "grading_marks admin write" on public.grading_marks;
create policy "grading_marks managers insert"
  on public.grading_marks for insert
  with check (
    exists (
      select 1
      from public.submissions s
      where s.id = grading_marks.submission_id
        and public.can_manage_contest(s.contest_id)
    )
  );

drop policy if exists "grading_marks admin update" on public.grading_marks;
create policy "grading_marks managers update"
  on public.grading_marks for update
  using (
    exists (
      select 1
      from public.submissions s
      where s.id = grading_marks.submission_id
        and public.can_manage_contest(s.contest_id)
    )
  )
  with check (
    exists (
      select 1
      from public.submissions s
      where s.id = grading_marks.submission_id
        and public.can_manage_contest(s.contest_id)
    )
  );

drop policy if exists "grading_marks admin delete" on public.grading_marks;
create policy "grading_marks managers delete"
  on public.grading_marks for delete
  using (
    exists (
      select 1
      from public.submissions s
      where s.id = grading_marks.submission_id
        and public.can_manage_contest(s.contest_id)
    )
  );

-- --- Games / track_game: mods see contest games -------------------------------
drop policy if exists "games public read if used in published contest" on public.games;
create policy "games public read if used in published contest"
  on public.games for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.track_game tg
      join public.tracks t on t.id = tg.track_id
      join public.contests c on c.id = t.contest_id
      where tg.game_id = games.id
        and public.is_contest_mod(c.id)
    )
    or exists (
      select 1
      from public.track_game tg
      join public.tracks t on t.id = tg.track_id
      join public.contests c on c.id = t.contest_id
      where tg.game_id = games.id
        and c.published = true
        and c.deadline < now()
        and c.results_published = true
    )
  );

drop policy if exists "game_alternate_titles public read if parent listed" on public.game_alternate_titles;
create policy "game_alternate_titles public read if parent listed"
  on public.game_alternate_titles for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.track_game tg
      join public.tracks t on t.id = tg.track_id
      join public.contests c on c.id = t.contest_id
      join public.games g on g.id = game_alternate_titles.game_id
      where tg.game_id = g.id
        and public.is_contest_mod(c.id)
    )
    or exists (
      select 1
      from public.track_game tg
      join public.tracks t on t.id = tg.track_id
      join public.contests c on c.id = t.contest_id
      join public.games g on g.id = game_alternate_titles.game_id
      where tg.game_id = g.id
        and c.published = true
        and c.deadline < now()
        and c.results_published = true
    )
  );

drop policy if exists "track_game public read if track visible" on public.track_game;
create policy "track_game public read if track visible"
  on public.track_game for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.tracks t
      join public.contests c on c.id = t.contest_id
      where t.id = track_game.track_id
        and public.is_contest_mod(c.id)
    )
    or exists (
      select 1
      from public.tracks t
      join public.contests c on c.id = t.contest_id
      where t.id = track_game.track_id
        and c.published = true
        and c.deadline < now()
        and c.results_published = true
    )
  );

-- --- Storage: contest audio uploads for mods ----------------------------------
drop policy if exists "contest audio admin write" on storage.objects;
create policy "contest audio managers insert"
  on storage.objects for insert
  with check (
    bucket_id = 'contest-audio'
    and (
      public.is_admin()
      or public.can_manage_contest(split_part(objects.name, '/', 1)::uuid)
    )
  );

drop policy if exists "contest audio admin update" on storage.objects;
create policy "contest audio managers update"
  on storage.objects for update
  using (
    bucket_id = 'contest-audio'
    and (
      public.is_admin()
      or public.can_manage_contest(split_part(objects.name, '/', 1)::uuid)
    )
  );

drop policy if exists "contest audio admin remove" on storage.objects;
create policy "contest audio managers remove"
  on storage.objects for delete
  using (
    bucket_id = 'contest-audio'
    and (
      public.is_admin()
      or public.can_manage_contest(split_part(objects.name, '/', 1)::uuid)
    )
  );

-- --- submit_contest_entry: attach auth user ----------------------------------
create or replace function public.submit_contest_entry(
  p_contest_id uuid,
  p_contestant_name text,
  p_guesses jsonb,
  p_edit_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id uuid;
  v_existing_hash text;
  c_deadline timestamptz;
  c_published boolean;
  r record;
  v_name text := trim(p_contestant_name);
  v_plain_token text;
  v_token_out text := null;
  v_new text;
  v_old_raw text;
  v_old_norm text;
  v_uid uuid := auth.uid();
begin
  select deadline, published into c_deadline, c_published
  from public.contests
  where id = p_contest_id;

  if not found then
    raise exception 'Contest not found';
  end if;

  if not public.is_admin() then
    if c_published is distinct from true then
      raise exception 'Contest is not open';
    end if;

    if c_deadline <= now() then
      raise exception 'Submissions are closed';
    end if;
  end if;

  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'Invalid name';
  end if;

  v_submission_id := null;

  if v_uid is not null then
    select s.id, s.edit_token_hash
    into v_submission_id, v_existing_hash
    from public.submissions s
    where s.contest_id = p_contest_id
      and s.user_id = v_uid
    order by s.created_at asc
    limit 1;
  end if;

  if v_submission_id is null then
    select s.id, s.edit_token_hash
    into v_submission_id, v_existing_hash
    from public.submissions s
    where s.contest_id = p_contest_id
      and lower(trim(s.contestant_name)) = lower(v_name)
    order by s.created_at asc
    limit 1;
  end if;

  if v_submission_id is not null then
    if v_existing_hash is not null then
      if p_edit_token is null or trim(p_edit_token) = '' then
        raise exception using
          errcode = 'P0001',
          message = 'That name is already in use for this contest. Someone else registered it first, so you need a different name. If you are that person, open the edit link from your first submit.';
      end if;
      if public._submission_edit_token_hash(p_edit_token) is distinct from v_existing_hash then
        raise exception using
          errcode = 'P0001',
          message = 'This edit link does not match that display name for this contest. Copy the full address from your browser after your last successful save, or start over with a new display name on the regular submit page.';
      end if;
    end if;

    update public.submissions
    set
      contestant_name = v_name,
      review_status = 'open',
      updated_at = now(),
      user_id = coalesce(user_id, v_uid)
    where id = v_submission_id;

    if v_existing_hash is null then
      v_plain_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      update public.submissions
      set edit_token_hash = public._submission_edit_token_hash(v_plain_token)
      where id = v_submission_id;
      v_token_out := v_plain_token;
    end if;

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

      v_new := left(trim(coalesce(r.text, '')), 500);

      select sg.guess_text into v_old_raw
      from public.submission_guesses sg
      where sg.submission_id = v_submission_id
        and sg.track_id = r.track_id;

      if not found then
        insert into public.submission_guesses (submission_id, track_id, guess_text)
        values (v_submission_id, r.track_id, v_new);
      else
        v_old_norm := left(trim(coalesce(v_old_raw, '')), 500);
        if v_old_norm is distinct from v_new then
          delete from public.grading_marks
          where submission_id = v_submission_id
            and track_id = r.track_id;
          update public.submission_guesses
          set guess_text = v_new
          where submission_id = v_submission_id
            and track_id = r.track_id;
        end if;
      end if;
    end loop;

    delete from public.grading_marks gm
    where gm.submission_id = v_submission_id
      and not exists (
        select 1
        from jsonb_to_recordset(p_guesses) as x(track_id uuid, text text)
        where x.track_id = gm.track_id
      );

    delete from public.submission_guesses sg
    where sg.submission_id = v_submission_id
      and not exists (
        select 1
        from jsonb_to_recordset(p_guesses) as x(track_id uuid, text text)
        where x.track_id = sg.track_id
      );
  else
    insert into public.submissions (contest_id, contestant_name, review_status, updated_at, user_id)
    values (p_contest_id, v_name, 'open', now(), v_uid)
    returning id into v_submission_id;

    v_plain_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update public.submissions
    set edit_token_hash = public._submission_edit_token_hash(v_plain_token)
    where id = v_submission_id;

    v_token_out := v_plain_token;

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
  end if;

  return jsonb_build_object(
    'submission_id', v_submission_id::text,
    'edit_token', v_token_out
  );
end;
$$;

create or replace function public.admin_update_submission_guesses(
  p_submission_id uuid,
  p_guesses jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contest_id uuid;
  r record;
  v_new text;
  v_old_raw text;
  v_old_norm text;
begin
  select contest_id into v_contest_id
  from public.submissions
  where id = p_submission_id;

  if v_contest_id is null then
    raise exception 'Submission not found';
  end if;

  if not public.can_manage_contest(v_contest_id) then
    raise exception 'Forbidden';
  end if;

  for r in
    select *
    from jsonb_to_recordset(p_guesses) as x(track_id uuid, text text)
  loop
    if not exists (
      select 1 from public.tracks t
      where t.id = r.track_id and t.contest_id = v_contest_id
    ) then
      raise exception 'Invalid track';
    end if;

    v_new := left(trim(coalesce(r.text, '')), 500);

    select sg.guess_text into v_old_raw
    from public.submission_guesses sg
    where sg.submission_id = p_submission_id
      and sg.track_id = r.track_id;

    if not found then
      insert into public.submission_guesses (submission_id, track_id, guess_text)
      values (p_submission_id, r.track_id, v_new);
    else
      v_old_norm := left(trim(coalesce(v_old_raw, '')), 500);
      if v_old_norm is distinct from v_new then
        delete from public.grading_marks
        where submission_id = p_submission_id
          and track_id = r.track_id;
        update public.submission_guesses
        set guess_text = v_new
        where submission_id = p_submission_id
          and track_id = r.track_id;
      end if;
    end if;
  end loop;

  delete from public.grading_marks gm
  where gm.submission_id = p_submission_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_guesses) as x(track_id uuid, text text)
      where x.track_id = gm.track_id
    );

  delete from public.submission_guesses sg
  where sg.submission_id = p_submission_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_guesses) as x(track_id uuid, text text)
      where x.track_id = sg.track_id
    );

  update public.submissions
  set
    review_status = 'open',
    updated_at = now()
  where id = p_submission_id;
end;
$$;

create or replace function public.admin_assign_submission_owner(p_submission_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  update public.submissions
  set user_id = p_user_id
  where id = p_submission_id;
end;
$$;

grant execute on function public.admin_assign_submission_owner(uuid, uuid) to authenticated;

-- track_game writes for contest managers (sync primary / shared games)
drop policy if exists "track_game admin write" on public.track_game;
create policy "track_game managers write"
  on public.track_game for all
  using (
    exists (
      select 1 from public.tracks t
      where t.id = track_game.track_id
        and public.can_manage_contest(t.contest_id)
    )
  )
  with check (
    exists (
      select 1 from public.tracks t
      where t.id = track_game.track_id
        and public.can_manage_contest(t.contest_id)
    )
  );

-- Allow contest managers to create/link games when editing a track
create or replace function public.ensure_game_by_title(p_title text, p_track_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
  t text := trim(p_title);
  sl text;
  v_cid uuid;
begin
  if p_track_id is not null then
    select tr.contest_id into v_cid
    from public.tracks tr
    where tr.id = p_track_id;

    if v_cid is null or not public.can_manage_contest(v_cid) then
      raise exception 'Forbidden';
    end if;
  elsif not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if length(t) < 1 then
    raise exception 'Invalid title';
  end if;

  select g.id
  into gid
  from public.games g
  where lower(trim(g.primary_title)) = lower(t)
  limit 1;

  if gid is not null then
    return gid;
  end if;

  sl := public._unique_game_slug(t);
  insert into public.games (primary_title, slug)
  values (t, sl)
  returning id into gid;
  return gid;
end;
$$;

-- Map auth user id -> public display name for a contest (grid / rankings) when results may be shown.
create or replace function public.profile_display_names_for_contest(p_contest_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
  allow boolean;
begin
  select * into c from public.contests where id = p_contest_id;
  if not found then
    return '{}'::jsonb;
  end if;

  allow :=
    public.is_admin()
    or public.is_contest_mod(p_contest_id)
    or (
      c.published = true
      and c.deadline < now()
      and coalesce(c.results_published, false) = true
    );

  if not allow then
    return '{}'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_object_agg(
        p.id::text,
        coalesce(nullif(trim(p.display_name), ''), p.username::text, 'Player')
      )
      from public.profiles p
      where p.id in (
        select s.user_id
        from public.submissions s
        where s.contest_id = p_contest_id
          and s.user_id is not null
      )
    ),
    '{}'::jsonb
  );
end;
$$;

grant execute on function public.profile_display_names_for_contest(uuid) to anon, authenticated;
