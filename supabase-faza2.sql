-- LAKAT faza 2: slika kao dokaz — zalijepi u Supabase Dashboard > SQL Editor > Run
-- (Cmd+A, obriši staro iz editora, zalijepi ovo, Run)

-- 1. Kolona: URL dokazne slike na checkinu
alter table public.checkins add column if not exists photo_url text;

-- 2. Public bucket "dokazi"
insert into storage.buckets (id, name, public)
values ('dokazi', 'dokazi', true)
on conflict (id) do update set public = true;

-- 3. Policyji: čitaju svi, piše se samo u vlastitu mapu dokazi/{auth.uid()}/...
create policy "dokazi_public_read" on storage.objects
  for select using (bucket_id = 'dokazi');

create policy "dokazi_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dokazi' and (storage.foldername(name))[1] = auth.uid()::text);
