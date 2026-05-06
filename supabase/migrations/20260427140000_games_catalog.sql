create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  primary_title text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_primary_title_len check (char_length(trim(primary_title)) between 1 and 300),
  constraint games_slug_len check (char_length(trim(slug)) between 1 and 320)
);

create unique index if not exists games_slug_key on public.games (lower(slug));
create index if not exists games_primary_title_lower_idx on public.games (lower(primary_title));

create table if not exists public.game_alternate_titles (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  constraint game_alt_title_len check (char_length(trim(title)) between 1 and 300)
);

create unique index if not exists game_alt_title_norm_uidx
  on public.game_alternate_titles (game_id, (lower(trim(title))));

create index if not exists game_alternate_titles_game_idx on public.game_alternate_titles (game_id);

create table if not exists public.track_game (
  track_id uuid not null references public.tracks (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  link_kind text not null check (link_kind in ('primary', 'shared_music')),
  primary key (track_id, game_id)
);

create unique index if not exists track_game_one_primary_per_track
  on public.track_game (track_id)
  where link_kind = 'primary';

create index if not exists track_game_game_idx on public.track_game (game_id);


create or replace function public.rebuild_track_answer_game_names(p_track_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prim_id uuid;
  parts text[] := array[]::text[];
  primary_title text;
  r record;
begin
  select tg.game_id
  into prim_id
  from public.track_game tg
  where tg.track_id = p_track_id
    and tg.link_kind = 'primary'
  limit 1;

  if prim_id is null then
    insert into public.track_answers (track_id, game_names)
    values (p_track_id, '["Unknown"]'::jsonb)
    on conflict (track_id) do update
      set game_names = excluded.game_names;
    return;
  end if;

  select trim(g.primary_title)
  into primary_title
  from public.games g
  where g.id = prim_id;

  parts := array_append(parts, primary_title);

  for r in
    select trim(gat.title) as tit
    from public.game_alternate_titles gat
    where gat.game_id = prim_id
    order by lower(gat.title)
  loop
    parts := array_append(parts, r.tit);
  end loop;

  for r in
    select trim(g.primary_title) as tit
    from public.track_game tg
    join public.games g on g.id = tg.game_id
    where tg.track_id = p_track_id
      and tg.link_kind = 'shared_music'
    order by lower(g.primary_title)
  loop
    parts := array_append(parts, r.tit);
  end loop;

  insert into public.track_answers (track_id, game_names)
  values (p_track_id, to_jsonb(parts))
  on conflict (track_id) do update
    set game_names = excluded.game_names;
end;
$$;

create or replace function public.track_game_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  tid := coalesce(new.track_id, old.track_id);
  if tid is not null then
    perform public.rebuild_track_answer_game_names(tid);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists track_game_rebuild_names on public.track_game;
create trigger track_game_rebuild_names
  after insert or update or delete on public.track_game
  for each row execute function public.track_game_after_change();

create or replace function public.game_alternate_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
  tid uuid;
begin
  gid := coalesce(new.game_id, old.game_id);
  for tid in
    select tg.track_id
    from public.track_game tg
    where tg.game_id = gid
      and tg.link_kind = 'primary'
  loop
    perform public.rebuild_track_answer_game_names(tid);
  end loop;
  return coalesce(new, old);
end;
$$;

drop trigger if exists game_alternate_rebuild_names on public.game_alternate_titles;
create trigger game_alternate_rebuild_names
  after insert or update or delete on public.game_alternate_titles
  for each row execute function public.game_alternate_after_change();

create or replace function public.games_title_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  if tg_op = 'UPDATE' and new.primary_title is not distinct from old.primary_title then
    return new;
  end if;
  for tid in
    select tg.track_id
    from public.track_game tg
    where tg.game_id = new.id
  loop
    perform public.rebuild_track_answer_game_names(tid);
  end loop;
  return new;
end;
$$;

drop trigger if exists games_title_rebuild_names on public.games;
create trigger games_title_rebuild_names
  after update of primary_title on public.games
  for each row execute function public.games_title_after_change();


alter table public.games enable row level security;
alter table public.game_alternate_titles enable row level security;
alter table public.track_game enable row level security;

create policy "games public read if used in published contest"
  on public.games for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.track_game tg
      join public.tracks t on t.id = tg.track_id
      join public.contests c on c.id = t.contest_id
      where tg.game_id = games.id
        and c.published = true
    )
  );

create policy "games admin write"
  on public.games for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "game_alternate_titles public read if parent listed"
  on public.game_alternate_titles for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.track_game tg
      join public.tracks t on t.id = tg.track_id
      join public.contests c on c.id = t.contest_id
      join public.games g on g.id = game_alternate_titles.game_id
      where tg.game_id = g.id
        and c.published = true
    )
  );

create policy "game_alternate_titles admin write"
  on public.game_alternate_titles for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "track_game public read if track visible"
  on public.track_game for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.tracks t
      join public.contests c on c.id = t.contest_id
      where t.id = track_game.track_id
        and c.published = true
    )
  );

create policy "track_game admin write"
  on public.track_game for all
  using (public.is_admin())
  with check (public.is_admin());


create or replace function public._slugify_game_title(p text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from regexp_replace(lower(trim(coalesce(p, ''))), '[^a-z0-9]+', '-', 'g')),
    ''
  );
$$;

create or replace function public._unique_game_slug(p_title text)
returns text
language plpgsql
as $$
declare
  base text;
  cand text;
  n int := 0;
begin
  base := coalesce(public._slugify_game_title(p_title), 'game');
  cand := base;
  while exists (select 1 from public.games g where lower(g.slug) = lower(cand)) loop
    n := n + 1;
    cand := base || '-' || n::text;
  end loop;
  return cand;
end;
$$;

create or replace function public._ensure_game_for_migration(p_title text)
returns uuid
language plpgsql
as $$
declare
  gid uuid;
  t text := trim(p_title);
  sl text;
begin
  if length(t) < 1 then
    t := 'Unknown';
  end if;

  select g.id
  into gid
  from public.games g
  where lower(trim(g.primary_title)) = lower(t)
  limit 1;

  if gid is not null then
    return gid;
  end if;

  sl := public._unique_game_slug(t);
  insert into public.games (primary_title, slug)
  values (t, sl)
  returning id into gid;
  return gid;
end;
$$;

do $$
declare
  r record;
  arr jsonb;
  gid uuid;
  i int;
  extra text;
begin
  for r in select ta.track_id, ta.game_names, ta.song_title, ta.notes from public.track_answers ta
  loop
    arr := r.game_names;
    if arr is null or jsonb_typeof(arr) <> 'array' or jsonb_array_length(arr) < 1 then
      continue;
    end if;

    gid := public._ensure_game_for_migration(arr->>0);

    insert into public.track_game (track_id, game_id, link_kind)
    values (r.track_id, gid, 'primary')
    on conflict (track_id, game_id) do nothing;

    for i in 1..jsonb_array_length(arr) - 1 loop
      extra := trim(arr->>i);
      if length(extra) < 1 then
        continue;
      end if;
      insert into public.game_alternate_titles (game_id, title)
      select gid, extra
      where not exists (
        select 1
        from public.game_alternate_titles x
        where x.game_id = gid
          and lower(trim(x.title)) = lower(extra)
      );
    end loop;
  end loop;
end;
$$;

do $$
declare
  tid uuid;
begin
  for tid in select distinct track_id from public.track_game
  loop
    perform public.rebuild_track_answer_game_names(tid);
  end loop;
end;
$$;

grant execute on function public.rebuild_track_answer_game_names(uuid) to authenticated;

create or replace function public.ensure_game_by_title(p_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
  t text := trim(p_title);
  sl text;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  if length(t) < 1 then
    raise exception 'Invalid title';
  end if;

  select g.id
  into gid
  from public.games g
  where lower(trim(g.primary_title)) = lower(t)
  limit 1;

  if gid is not null then
    return gid;
  end if;

  sl := public._unique_game_slug(t);
  insert into public.games (primary_title, slug)
  values (t, sl)
  returning id into gid;
  return gid;
end;
$$;

grant execute on function public.ensure_game_by_title(text) to authenticated;
