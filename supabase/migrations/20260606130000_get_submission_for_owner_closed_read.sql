-- Let signed-in owners load their guesses after the deadline (read-only in the app). Editing still
-- goes through submit_contest_entry, which rejects past-deadline updates for non-admins.

create or replace function public.get_submission_for_owner(p_contest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_published boolean;
  v_submission_id uuid;
  v_name text;
  v_guesses jsonb;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in required.';
  end if;

  select c.published
  into v_published
  from public.contests c
  where c.id = p_contest_id;

  if not found then
    raise exception 'Contest not found.';
  end if;

  if v_published is distinct from true then
    raise exception 'Contest is not open.';
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
