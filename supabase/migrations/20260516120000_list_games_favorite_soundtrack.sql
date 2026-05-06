-- Games eligible for “favorite soundtrack”: linked to at least one track in a published contest that has ended.

create or replace function public.list_games_for_favorite_soundtrack()
returns table (
  id uuid,
  primary_title text,
  slug text,
  cover_image_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    g.id,
    g.primary_title,
    g.slug,
    g.cover_image_url
  from public.games g
  join public.track_game tg on tg.game_id = g.id
  join public.tracks t on t.id = tg.track_id
  join public.contests c on c.id = t.contest_id
  where c.published = true
    and c.deadline < now()
  order by g.primary_title;
$$;

grant execute on function public.list_games_for_favorite_soundtrack() to authenticated;
