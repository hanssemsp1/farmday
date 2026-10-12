-- 셀러 다이어리 — 등록상품 · 판매된 상품을 여러 개 담을 수 있게
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요. 한 번만 하면 됩니다.
--
-- 예전에 쓰던 uploaded / sold(한 줄 글)는 그대로 둡니다.
-- 지난 기록이 사라지지 않게 하기 위해서입니다.

alter table public.seller_diary
  add column if not exists registered  jsonb default '[]'::jsonb,   -- 등록상품  [{name, channel}]
  add column if not exists sold_items  jsonb default '[]'::jsonb;   -- 판매된 상품 [{name, channel, qty}]
