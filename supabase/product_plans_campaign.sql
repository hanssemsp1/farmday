-- 상품기획서에 「체험단」 칸을 둔다.
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요. 한 번만 하면 됩니다.
--
-- ⚠️ 이 칸이 없으면 기획서 저장이 통째로 막힙니다
--    ("Could not find the 'campaign' column"). 바로 실행해 주세요.

alter table public.product_plans
  add column if not exists campaign jsonb default '{}'::jsonb;   -- 체험단 리뷰양식·송장
