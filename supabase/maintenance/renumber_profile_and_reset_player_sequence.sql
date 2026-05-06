-- One-off maintenance: fix a profile’s public “Player #” and resync
-- public.profiles_player_number_seq so the next new account gets the next free number.
--
-- Run in the Supabase SQL Editor (or psql) as a role that can update public.profiles.
-- Replace the UUID below with your friend’s auth user id (same as profiles.id).

begin;

-- 1) See current assignments (optional – run in a read-only query first if you prefer):
--    select id, username, display_name, player_number, created_at
--    from public.profiles
--    order by player_number nulls last;

-- 2) Ensure no one else is using player #2, then assign it to the target user.
--    (If 2 is still taken, pick another free number or swap in a second update.)
update public.profiles
set player_number = 2
where id = '705bd491-2cd3-4070-8b44-8049e1ab14b7'::uuid;

-- 3) Resync the sequence: next nextval() will be max(player_number) + 1
select setval(
  'public.profiles_player_number_seq',
  (select coalesce(max(player_number), 0) from public.profiles)
);

commit;

-- Verify:
--   select id, username, player_number from public.profiles order by player_number;
--   select last_value from public.profiles_player_number_seq;
--   -- last_value should equal the current max player_number; the *next* signup gets last_value + 1.
