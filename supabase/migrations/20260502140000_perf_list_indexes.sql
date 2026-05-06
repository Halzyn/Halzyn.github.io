create index if not exists games_primary_title_sort_idx on public.games (primary_title);

drop index if exists public.submissions_contest_idx;
create index if not exists submissions_contest_created_at_idx on public.submissions (contest_id, created_at);

analyze public.games;
analyze public.submissions;
