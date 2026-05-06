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

    delete from public.grading_marks where submission_id = v_submission_id;
    delete from public.submission_guesses where submission_id = v_submission_id;
  else
    insert into public.submissions (contest_id, contestant_name, review_status, updated_at)
    values (p_contest_id, v_name, 'open', now())
    returning id into v_submission_id;

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

    insert into public.submission_guesses (submission_id, track_id, guess_text)
    values (
      v_submission_id,
      r.track_id,
      left(trim(coalesce(r.text, '')), 500)
    );
  end loop;

  return jsonb_build_object(
    'submission_id', v_submission_id::text,
    'edit_token', v_token_out
  );
end;
$$;

grant execute on function public.submit_contest_entry(uuid, text, jsonb, text) to anon, authenticated;

create or replace function public.admin_reset_submission_edit_token(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_token text;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  select c.slug
  into v_slug
  from public.submissions s
  join public.contests c on c.id = s.contest_id
  where s.id = p_submission_id;

  if v_slug is null then
    raise exception 'Submission not found';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.submissions
  set
    edit_token_hash = public._submission_edit_token_hash(v_token),
    updated_at = now()
  where id = p_submission_id;

  return jsonb_build_object(
    'edit_token', v_token,
    'submit_path', '/contests/' || v_slug || '/submit?edit=' || v_token
  );
end;
$$;

grant execute on function public.admin_reset_submission_edit_token(uuid) to authenticated;
