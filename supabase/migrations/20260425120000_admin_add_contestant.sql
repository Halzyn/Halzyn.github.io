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
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if length(trim(p_contestant_name)) < 1 or length(trim(p_contestant_name)) > 80 then
    raise exception 'Invalid name';
  end if;

  if not exists (select 1 from public.contests where id = p_contest_id) then
    raise exception 'Contest not found';
  end if;

  insert into public.submissions (contest_id, contestant_name)
  values (p_contest_id, trim(p_contestant_name))
  returning id into v_submission_id;

  insert into public.submission_guesses (submission_id, track_id, guess_text)
  select v_submission_id, t.id, ''
  from public.tracks t
  where t.contest_id = p_contest_id;

  return v_submission_id;
end;
$$;

grant execute on function public.admin_add_contestant(uuid, text) to authenticated;
