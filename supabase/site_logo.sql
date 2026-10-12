-- 사이트 로고 — 관리자 화면에서 바꿀 수 있게
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요. 한 번만 하면 됩니다.
--
-- 로고를 안 올리면 지금처럼 글자(Farmday.)가 그대로 나옵니다.
-- 푸터는 바탕이 어두우므로 흰 로고를 따로 둘 수 있게 칸을 나눴습니다.

alter table public.site_settings
  add column if not exists logo_header text default '',   -- 위쪽(밝은 바탕)용
  add column if not exists logo_footer text default '',   -- 아래쪽(어두운 바탕)용
  add column if not exists tagline     text default '';   -- 푸터 한 줄 소개
