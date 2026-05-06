-- Signed-in submit: allow owners to update without an edit token; require profile display name when
-- submitting without a token. Add RPCs to load an owned draft and list a user's contest entries.

create or replace function public.get_submission_for_owner(p_contest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deadline timestamptz;
  v_published boolean;
  v_submission_id uuid;
  v_name text;
  v_guesses jsonb;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in required.';
  end if;

  select c.deadline, c.published
  into v_deadline, v_published
  from public.contests c
  where c.id = p_contest_id;

  if not found then
    raise exception 'Contest not found.';
  end if;

  if v_published is distinct from true then
    raise exception 'Contest is not open.';
  end if;

  if v_deadline <= now() and not public.is_admin() then
    raise exception 'Submissions are closed.';
  end if;

  select s.id, s.contestant_name
  into v_submission_id, v_name
  from public.submissions s
  where s.contest_id = p_contest_id
    and s.user_id = v_uid
  limit 1;

  if v_submission_id is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('track_id', sg.track_id::text, 'text', sg.guess_text)
      order by t.sort_order
    ),
    '[]'::jsonb
  )
  into v_guesses
  from public.submission_guesses sg
  join public.tracks t on t.id = sg.track_id
  where sg.submission_id = v_submission_id;

  return jsonb_build_object(
    'submission_id', v_submission_id::text,
    'contestant_name', v_name,
    'guesses', v_guesses
  );
end;
$$;

grant execute on function public.get_submission_for_owner(uuid) to authenticated;

create or replace function public.list_my_contest_submissions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in required.';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'submission_id', s.id::text,
          'contest_id', c.id::text,
          'contest_slug', c.slug,
          'contest_title', c.title,
          'deadline', c.deadline,
          'results_published', c.results_published
        )
        order by c.deadline desc nulls last
      )
      from public.submissions s
      join public.contests c on c.id = s.contest_id
      where s.user_id = v_uid
        and c.published = true
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.list_my_contest_submissions() to authenticated;

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
  v_row_user_id uuid;
  v_owner_edit boolean := false;
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
  v_profile_dn text;
  v_token_empty boolean;
begin
  v_token_empty := p_edit_token is null or trim(p_edit_token) = '';

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

  if v_uid is not null and not public.is_admin() and v_token_empty then
    select nullif(trim(display_name), '') into v_profile_dn from public.profiles where id = v_uid;
    if v_profile_dn is null then
      raise exception 'Add a display name under your profile before submitting while signed in.';
    end if;
    if lower(v_name) is distinct from lower(v_profile_dn) then
      raise exception 'When signed in, your entry name must match your profile display name.';
    end if;
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
    select user_id into v_row_user_id from public.submissions where id = v_submission_id;

    if v_existing_hash is not null then
      v_owner_edit := v_uid is not null and v_row_user_id is not distinct from v_uid;
      if not v_owner_edit then
        if v_token_empty then
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
