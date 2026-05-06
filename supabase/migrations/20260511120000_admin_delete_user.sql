-- Allow admins to remove a registered account (auth user + cascading profile data).

create or replace function public.admin_delete_auth_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception 'Cannot delete your own account from here.';
  end if;

  delete from auth.users where id = p_target_user_id;
end;
$$;

grant execute on function public.admin_delete_auth_user(uuid) to authenticated;
