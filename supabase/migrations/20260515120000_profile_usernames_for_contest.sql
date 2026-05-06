-- Public usernames for contest results (profile links) — same visibility rules as display names.

create or replace function public.profile_usernames_for_contest(p_contest_id uuid)
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
        p.username::text
      )
      from public.profiles p
      where p.id in (
        select s.user_id
        from public.submissions s
        where s.contest_id = p_contest_id
          and s.user_id is not null
      )
      and p.username is not null
    ),
    '{}'::jsonb
  );
end;
$$;

grant execute on function public.profile_usernames_for_contest(uuid) to anon, authenticated;
