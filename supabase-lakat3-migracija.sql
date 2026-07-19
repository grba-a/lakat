-- LAKAT 3.0 (2/2): MIGRACIJA ZA PRODUKCIJU — pokreće se u Fazi G (cutover),
-- PRIJE supabase-lakat3-1.sql. Auto-frendovi: svi koji su ikad bili skupa
-- u grupi postaju međusobno prihvaćeni frendovi (odluka korisnika —
-- nitko se ne budi u praznoj aplikaciji). Na DEV bazi NIJE potrebna
-- (nema grupa s članovima), ali je bezopasna (no-op).

-- 1. Postojeći PENDING zahtjevi među ko-članovima → accepted
update public.friendships f
set status = 'accepted', responded_at = now()
where f.status = 'pending'
  and exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = f.requester and b.user_id = f.addressee
  );

-- 2. Novi frendovi za sve parove ko-članova koji još nemaju red
-- (friendships_pair_idx je unique na least/greatest pa smjer nije bitan)
insert into public.friendships (requester, addressee, status, responded_at)
select distinct
  least(a.user_id, b.user_id),
  greatest(a.user_id, b.user_id),
  'accepted',
  now()
from public.group_members a
join public.group_members b
  on a.group_id = b.group_id and a.user_id < b.user_id
where not exists (
  select 1 from public.friendships f
  where least(f.requester, f.addressee) = least(a.user_id, b.user_id)
    and greatest(f.requester, f.addressee) = greatest(a.user_id, b.user_id)
);
