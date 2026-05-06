do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'track_answers'
      and column_name = 'franchise'
  ) then
    alter table public.track_answers rename column franchise to song_title;
  end if;
end $$;
