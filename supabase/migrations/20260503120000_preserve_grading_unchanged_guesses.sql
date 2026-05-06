-- When resubmitting, only drop X/~ grades for tracks whose guess text actually changed.

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

  select s.id, s.edit_token_hash
  into v_submission_id, v_existing_hash
  from public.submissions s
  where s.contest_id = p_contest_id
    and lower(trim(s.contestant_name)) = lower(v_name)
  order by s.created_at asc
  limit 1;

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
      updated_at = now()
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
    insert into public.submissions (contest_id, contestant_name, review_status, updated_at)
    values (p_contest_id, v_name, 'open', now())
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
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  select contest_id into v_contest_id
  from public.submissions
  where id = p_submission_id;

  if v_contest_id is null then
    raise exception 'Submission not found';
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
