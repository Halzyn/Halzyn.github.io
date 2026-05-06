update public.tracks t
set sort_order = t.sort_order + 1
from (
  select distinct contest_id
  from public.tracks
  where sort_order = 0
) z
where t.contest_id = z.contest_id;
