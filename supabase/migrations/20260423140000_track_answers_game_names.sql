alter table public.track_answers add column if not exists game_names jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'track_answers'
      and column_name = 'game_title'
  ) then
    execute
      'update public.track_answers set game_names = jsonb_build_array(game_title)';
    execute 'alter table public.track_answers drop column game_title';
  end if;
end $$;

update public.track_answers
set game_names = '["Unknown"]'::jsonb
where game_names is null
   or jsonb_typeof(game_names) <> 'array'
   or jsonb_array_length(game_names) < 1;

alter table public.track_answers alter column game_names set default '["Unknown"]'::jsonb;
alter table public.track_answers alter column game_names set not null;

alter table public.track_answers drop constraint if exists track_answers_game_names_is_array;
alter table public.track_answers add constraint track_answers_game_names_is_array check (
  jsonb_typeof(game_names) = 'array'
  and jsonb_array_length(game_names) >= 1
);
