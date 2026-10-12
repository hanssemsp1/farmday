-- 상품기획 사진 보관함
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요. 한 번만 하면 됩니다.
--
-- 사진은 글자와 달리 파일이라 따로 둘 곳(버킷)이 필요합니다.
-- 읽기는 누구나(상품 사진이라 어차피 공개될 것), 올리고 지우는 건 관리자만.

insert into storage.buckets (id, name, public)
values ('plan-images', 'plan-images', true)
on conflict (id) do nothing;

-- 보기: 누구나
drop policy if exists "plan_images_read" on storage.objects;
create policy "plan_images_read" on storage.objects
  for select
  using (bucket_id = 'plan-images');

-- 올리기: 관리자만
drop policy if exists "plan_images_write" on storage.objects;
create policy "plan_images_write" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'plan-images'
    and (auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com'
  );

-- 지우기: 관리자만
drop policy if exists "plan_images_delete" on storage.objects;
create policy "plan_images_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'plan-images'
    and (auth.jwt() ->> 'email') = 'farmday.testuser02@gmail.com'
  );
