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
