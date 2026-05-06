-- Public profile JSON: staff badges for profile page only (via RPC).

create or replace function public.get_public_profile_by_username(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trim text := trim(coalesce(p_username, ''));
  r record;
begin
  if v_trim = '' then
    return null;
  end if;

  select
    p.id,
    p.username,
    coalesce(nullif(trim(p.display_name), ''), p.username::text) as display_name,
    p.bio,
    p.player_number,
    p.created_at,
    p.avatar_path,
    p.is_admin,
    exists (select 1 from public.contest_moderators m where m.user_id = p.id) as is_contest_moderator
  into r
  from public.profiles p
  where lower(p.username::text) = lower(v_trim)
    and p.username is not null;

  if r.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', r.id,
    'username', r.username,
    'display_name', r.display_name,
    'bio', r.bio,
    'player_number', r.player_number,
    'created_at', r.created_at,
    'avatar_path', r.avatar_path,
    'is_admin', r.is_admin,
    'is_contest_moderator', r.is_contest_moderator
  );
end;
$$;
