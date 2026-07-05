-- LAKAT: avatari — zalijepi cijeli fajl u Supabase Dashboard > SQL Editor > Run
-- (nakon supabase-setup.sql; sigurno za produkciju: samo dodaje kolonu i bucket)

-- 1. Kolona za URL profilne slike
alter table public.profiles add column if not exists avatar_url text;

-- 2. Public bucket "avatars"
-- Ako ovaj insert padne (neki noviji Supabase projekti brane pisanje u
-- storage.buckets), kreiraj bucket ručno: Dashboard > Storage > New bucket,
-- ime "avatars", Public ON — a policyje ispod svejedno pokreni ovdje.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 3. Policyji na storage.objects
-- Čitaju svi (bucket je public)
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Piše se samo u vlastitu mapu: avatars/{auth.uid()}/...
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- UPDATE policy je obavezan: upload s upsert:true na istu putanju je UPDATE
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using  (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
