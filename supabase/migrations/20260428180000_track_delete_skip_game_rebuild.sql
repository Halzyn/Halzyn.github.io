create or replace function public.tracks_before_delete_clear_rebuilds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('halzyn.deleting_track', 'true', true);
  return old;
end;
$$;

drop trigger if exists tracks_before_delete_skip_game_rebuild on public.tracks;
create trigger tracks_before_delete_skip_game_rebuild
  before delete on public.tracks
  for each row
  execute function public.tracks_before_delete_clear_rebuilds();

create or replace function public.track_game_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  if current_setting('halzyn.deleting_track', true) is not distinct from 'true' then
    return coalesce(new, old);
  end if;

  tid := coalesce(new.track_id, old.track_id);
  if tid is not null then
    perform public.rebuild_track_answer_game_names(tid);
  end if;
  return coalesce(new, old);
end;
$$;
