alter table public.games
  add column if not exists igdb_id bigint,
  add column if not exists cover_image_url text,
  add column if not exists genres text[],
  add column if not exists platforms text[],
  add column if not exists release_date date,
  add column if not exists description text;

comment on column public.games.igdb_id is 'IGDB game id when metadata was imported.';
comment on column public.games.cover_image_url is 'HTTPS URL to cover art (typically IGDB image CDN).';
comment on column public.games.genres is 'Display names from IGDB.';
comment on column public.games.platforms is 'Display names from IGDB.';
comment on column public.games.release_date is 'First release date from IGDB (UTC date).';
comment on column public.games.description is 'Short description / summary from IGDB.';
