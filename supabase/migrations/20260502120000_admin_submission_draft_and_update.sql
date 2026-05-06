create or replace function public.admin_get_submission_draft(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contestant_name text;
  v_contest_id uuid;
  v_guesses jsonb;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  select s.contestant_name, s.contest_id
  into v_contestant_name, v_contest_id
  from public.submissions s
  where s.id = p_submission_id;

  if v_contestant_name is null then
    raise exception 'Submission not found';
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
  where sg.submission_id = p_submission_id;

  return jsonb_build_object(
    'submission_id', p_submission_id::text,
    'contestant_name', v_contestant_name,
    'contest_id', v_contest_id::text,
    'guesses', v_guesses
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

  delete from public.grading_marks where submission_id = p_submission_id;
  delete from public.submission_guesses where submission_id = p_submission_id;

  for r in
    select * from jsonb_to_recordset(p_guesses) as x(track_id uuid, text text)
  loop
    if not exists (
      select 1 from public.tracks t
      where t.id = r.track_id and t.contest_id = v_contest_id
    ) then
      raise exception 'Invalid track';
    end if;

    insert into public.submission_guesses (submission_id, track_id, guess_text)
    values (
      p_submission_id,
      r.track_id,
      left(trim(coalesce(r.text, '')), 500)
    );
  end loop;

  update public.submissions
  set
    review_status = 'open',
    updated_at = now()
  where id = p_submission_id;
end;
$$;

grant execute on function public.admin_get_submission_draft(uuid) to authenticated;
grant execute on function public.admin_update_submission_guesses(uuid, jsonb) to authenticated;
