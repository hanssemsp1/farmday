-- 셀러 다이어리에 「오늘 한 일」 글 칸을 하나 더 둔다.
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요. 한 번만 하면 됩니다.
--
-- 이 칸을 만들기 전에도 다른 칸은 그대로 저장됩니다.
-- 「오늘 한 일」에 적은 것만 이 칸이 생긴 뒤부터 저장됩니다.

alter table public.seller_diary
  add column if not exists did text default '';
