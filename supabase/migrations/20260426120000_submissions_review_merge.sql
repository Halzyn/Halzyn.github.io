alter table public.submissions
  add column if not exists review_status text not null default 'open'
    constraint submissions_review_status_check check (review_status in ('open', 'reviewed'));

alter table public.submissions
  add column if not exists updated_at timestamptz not null default now();

create policy "submissions admin update"
  on public.submissions for update
  using (public.is_admin())
  with check (public.is_admin());

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
  v_name text := trim(p_contestant_name);
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

  select s.id into v_submission_id
  from public.submissions s
  where s.contest_id = p_contest_id
    and lower(trim(s.contestant_name)) = lower(v_name)
  order by s.created_at asc
  limit 1;

  if v_submission_id is not null then
    update public.submissions
    set
      contestant_name = v_name,
      review_status = 'open',
      updated_at = now()
    where id = v_submission_id;

    delete from public.grading_marks where submission_id = v_submission_id;
    delete from public.submission_guesses where submission_id = v_submission_id;
  else
    insert into public.submissions (contest_id, contestant_name, review_status, updated_at)
    values (p_contest_id, v_name, 'open', now())
    returning id into v_submission_id;
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

  return v_submission_id;
end;
$$;

grant execute on function public.submit_contest_entry(uuid, text, jsonb) to anon, authenticated;

create or replace function public.admin_add_contestant(
  p_contest_id uuid,
  p_contestant_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id uuid;
  v_name text := trim(p_contestant_name);
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'Invalid name';
  end if;

  if not exists (select 1 from public.contests where id = p_contest_id) then
    raise exception 'Contest not found';
  end if;

  select s.id into v_submission_id
  from public.submissions s
  where s.contest_id = p_contest_id
    and lower(trim(s.contestant_name)) = lower(v_name)
  limit 1;

  if v_submission_id is not null then
    return v_submission_id;
  end if;

  insert into public.submissions (contest_id, contestant_name, review_status, updated_at)
  values (p_contest_id, v_name, 'open', now())
  returning id into v_submission_id;

  insert into public.submission_guesses (submission_id, track_id, guess_text)
  select v_submission_id, t.id, ''
  from public.tracks t
  where t.contest_id = p_contest_id;

  return v_submission_id;
end;
$$;

grant execute on function public.admin_add_contestant(uuid, text) to authenticated;

create or replace function public.admin_merge_submissions(
  p_target_id uuid,
  p_source_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contest_target uuid;
  v_contest_source uuid;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if p_target_id = p_source_id then
    raise exception 'Cannot merge a submission into itself';
  end if;

  select contest_id into v_contest_target from public.submissions where id = p_target_id;
  select contest_id into v_contest_source from public.submissions where id = p_source_id;

  if v_contest_target is null or v_contest_source is null then
    raise exception 'Submission not found';
  end if;

  if v_contest_target is distinct from v_contest_source then
    raise exception 'Submissions must belong to the same contest';
  end if;

  update public.submission_guesses tg
  set guess_text = left(trim(coalesce(sg.guess_text, '')), 500)
  from public.submission_guesses sg
  where tg.submission_id = p_target_id
    and sg.submission_id = p_source_id
    and tg.track_id = sg.track_id
    and trim(coalesce(tg.guess_text, '')) = ''
    and trim(coalesce(sg.guess_text, '')) <> '';

  insert into public.grading_marks (submission_id, track_id, mark)
  select p_target_id, gm.track_id, gm.mark
  from public.grading_marks gm
  where gm.submission_id = p_source_id
    and not exists (
      select 1 from public.grading_marks x
      where x.submission_id = p_target_id and x.track_id = gm.track_id
    );

  update public.submissions
  set review_status = 'open', updated_at = now()
  where id = p_target_id;

  delete from public.submissions where id = p_source_id;
end;
$$;

grant execute on function public.admin_merge_submissions(uuid, uuid) to authenticated;
