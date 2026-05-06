-- Separate "results visible to the public" from "deadline has passed" so grading can finish first.

alter table public.contests
  add column if not exists results_published boolean not null default false;

-- Past contests that already showed answers under the old rules should stay public.
update public.contests
set results_published = true
where deadline < now();

drop policy if exists "track_answers read after deadline or admin" on public.track_answers;
create policy "track_answers read after deadline or admin"
  on public.track_answers for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.tracks t
      join public.contests c on c.id = t.contest_id
      where t.id = track_answers.track_id
        and c.published = true
        and c.deadline < now()
        and c.results_published = true
    )
  );

drop policy if exists "submissions public read after deadline" on public.submissions;
create policy "submissions public read after deadline"
  on public.submissions for select
  using (
    exists (
      select 1 from public.contests c
      where c.id = submissions.contest_id
        and c.published = true
        and c.deadline < now()
        and c.results_published = true
    )
  );

drop policy if exists "grading_marks public read after deadline" on public.grading_marks;
create policy "grading_marks public read after deadline"
  on public.grading_marks for select
  using (
    exists (
      select 1
      from public.submissions s
      join public.contests c on c.id = s.contest_id
      where s.id = grading_marks.submission_id
        and c.published = true
        and c.deadline < now()
        and c.results_published = true
    )
  );

drop policy if exists "games public read if used in published contest" on public.games;
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
        and c.deadline < now()
        and c.results_published = true
    )
  );

drop policy if exists "game_alternate_titles public read if parent listed" on public.game_alternate_titles;
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
        and c.deadline < now()
        and c.results_published = true
    )
  );

drop policy if exists "track_game public read if track visible" on public.track_game;
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
        and c.deadline < now()
        and c.results_published = true
    )
  );
