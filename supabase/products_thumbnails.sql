-- 상품 화면 맨 위에서 넘겨 보는 추가 썸네일(썸네일2~N). 대표 썸네일(thumbnail 칸)은 그대로.
alter table public.products add column if not exists thumbnails text[] not null default '{}';
