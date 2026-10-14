-- 아이디 찾기 반복 조회 제한 (2026-10-14)
-- Supabase 대시보드 → SQL Editor → 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- find-id 함수가 「같은 접속(IP) 또는 같은 번호로 10분에 5번」을 넘으면 막는다. 서버만 읽고 쓴다(정책 없음 = 손님 접근 불가).

create table if not exists public.find_id_log (
  id   bigserial primary key,
  key  text not null,            -- 'ip:…' 또는 'phone:<해시>' — 번호 원문은 남기지 않는다
  at   timestamptz not null default now()
);
create index if not exists find_id_log_key_at on public.find_id_log (key, at desc);
alter table public.find_id_log enable row level security;

-- 하루 지난 기록은 함수가 지울 때 같이 지운다(쌓이지 않게)
