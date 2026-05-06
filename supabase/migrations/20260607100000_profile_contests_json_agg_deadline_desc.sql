-- Profile stats payload: contests newest-first (deadline descending), matching list/home ordering.

create or replace function public.get_public_profile_page_data(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trim text := trim(coalesce(p_username, ''));
  r record;
  v_uid uuid;
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
    exists (select 1 from public.contest_moderators m where m.user_id = p.id) as is_contest_moderator,
    fg.cover_image_url as favorite_soundtrack_cover_url
  into r
  from public.profiles p
  left join public.games fg on fg.id = p.favorite_soundtrack_game_id
  where lower(p.username::text) = lower(v_trim)
    and p.username is not null;

  if r.id is null then
    return null;
  end if;

  v_uid := r.id;

  return jsonb_build_object(
    'profile',
    jsonb_build_object(
      'id', r.id,
      'username', r.username,
      'display_name', r.display_name,
      'bio', r.bio,
      'player_number', r.player_number,
      'created_at', r.created_at,
      'avatar_path', r.avatar_path,
      'is_admin', r.is_admin,
      'is_contest_moderator', r.is_contest_moderator,
      'favorite_soundtrack_cover_url', r.favorite_soundtrack_cover_url
    ),
    'stats',
    (
      with
      cids as (
        select distinct s.contest_id as cid
        from public.submissions s
        inner join public.contests c on c.id = s.contest_id
        where s.user_id = v_uid
          and c.deadline < now()
      ),
      contest_submissions as (
        select s.*
        from public.submissions s
        where s.contest_id in (select cid from cids)
      ),
      contest_sub_ids as (
        select cs.id from contest_submissions cs
      )
      select jsonb_build_object(
        'my_submissions',
        coalesce(
          (
            select jsonb_agg(to_jsonb(s) order by s.created_at)
            from public.submissions s
            inner join public.contests c on c.id = s.contest_id
            where s.user_id = v_uid
              and c.deadline < now()
          ),
          '[]'::jsonb
        ),
        'contests',
        coalesce(
          (
            select jsonb_agg(to_jsonb(c) order by c.deadline desc)
            from public.contests c
            where c.id in (select cid from cids)
          ),
          '[]'::jsonb
        ),
        'tracks',
        coalesce(
          (
            select jsonb_agg(to_jsonb(t) order by t.contest_id, t.sort_order)
            from public.tracks t
            where t.contest_id in (select cid from cids)
          ),
          '[]'::jsonb
        ),
        'submissions',
        coalesce(
          (
            select jsonb_agg(to_jsonb(cs) order by cs.contest_id, cs.created_at)
            from contest_submissions cs
          ),
          '[]'::jsonb
        ),
        'marks',
        coalesce(
          (
            select jsonb_agg(to_jsonb(m))
            from public.grading_marks m
            where m.submission_id in (select id from contest_sub_ids)
          ),
          '[]'::jsonb
        ),
        'guesses',
        coalesce(
          (
            select jsonb_agg(to_jsonb(g) order by g.submission_id, g.track_id)
            from public.submission_guesses g
            inner join public.submissions s on s.id = g.submission_id
            inner join public.contests c on c.id = s.contest_id
            where s.user_id = v_uid
              and c.deadline < now()
          ),
          '[]'::jsonb
        )
      )
    )
  );
end;
$$;
