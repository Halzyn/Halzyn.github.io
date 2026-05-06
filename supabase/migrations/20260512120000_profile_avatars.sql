-- Profile pictures stored in public bucket avatars/{user_id}/avatar.jpg

alter table public.profiles
  add column if not exists avatar_path text;

-- Return type (OUT columns) changed; CREATE OR REPLACE cannot alter it — must drop first.
drop function if exists public.list_players_public();

create function public.list_players_public()
returns table (
  id uuid,
  username citext,
  display_name text,
  bio text,
  player_number int,
  created_at timestamptz,
  avatar_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    coalesce(nullif(trim(p.display_name), ''), p.username::text) as display_name,
    p.bio,
    p.player_number,
    p.created_at,
    p.avatar_path
  from public.profiles p
  where p.username is not null
  order by p.player_number asc nulls last, p.created_at asc;
$$;

grant execute on function public.list_players_public() to anon, authenticated;

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
    p.avatar_path
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
    'avatar_path', r.avatar_path
  );
end;
$$;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars insert own folder" on storage.objects;
create policy "avatars insert own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "avatars update own folder" on storage.objects;
create policy "avatars update own folder"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "avatars delete own folder" on storage.objects;
create policy "avatars delete own folder"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );
