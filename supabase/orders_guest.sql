-- 비회원 주문 (2026-10-14)
-- Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- 먼저 실행할 것: orders_coupon.sql, orders_shipping.sql, orders_cancel.sql, orders_tracking.sql, find_id_limit.sql (모두 실행됨)
--
-- 비회원 주문은 브라우저가 직접 만들거나 읽지 못한다. 만들기·조회·결제 확인·취소는 모두 서버(Edge Function: guest-order,
-- toss-confirm, order-cancel)가 한다. 비회원 줄은 user_id 가 비어 있어서 「내 주문만 읽기」 정책(auth.uid() = user_id)에
-- 걸리지 않고, 관리자 정책(관리자 이메일)으로만 보인다 → 발주 엑셀·송장 매칭은 회원과 똑같이 된다.

-- 1) 회원 칸을 비울 수 있게 + 비회원 칸
alter table public.orders alter column user_id drop not null;
alter table public.orders add column if not exists guest            boolean not null default false;
alter table public.orders add column if not exists guest_phone      text; -- 숫자만 (조회 때 맞춰 보는 값)
alter table public.orders add column if not exists guest_email      text;
alter table public.orders add column if not exists guest_pw_hash    text; -- 주문 조회 비밀번호 (PBKDF2, 원문은 저장하지 않음)
alter table public.orders add column if not exists guest_token_hash text; -- 결제 확인용 일회용 표 (SHA-256), 결제 끝나면 지움
create index if not exists orders_guest_phone on public.orders (guest_phone) where guest;

-- 2) 지킴이 — 비회원 칸은 서버만. 브라우저에서 만드는 주문은 반드시 로그인한 본인 것
create or replace function public.orders_guard_payment()
returns trigger
language plpgsql
as $$
declare
  is_admin boolean := coalesce(auth.jwt() ->> 'email', '') = 'farmday.testuser02@gmail.com';
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is null or new.user_id is distinct from auth.uid() then
      raise exception '로그인한 본인 주문만 만들 수 있어요';
    end if;
    if new.guest or new.guest_phone is not null or new.guest_email is not null
       or new.guest_pw_hash is not null or new.guest_token_hash is not null then
      raise exception '비회원 주문은 서버에서만 만들 수 있어요';
    end if;
    if new.status in ('결제완료', '취소완료') or new.paid_at is not null or new.payment_key is not null
       or coalesce(new.coupon_amount, 0) <> 0
       or new.cancel_status is not null or new.canceled_at is not null
       or coalesce(new.supply_status, '미발주') <> '미발주' or new.supply_lines <> '[]'::jsonb
       or new.shipments <> '[]'::jsonb or new.delivery_status is not null then
      raise exception '결제·발주·배송 기록은 서버에서만 쓸 수 있어요';
    end if;
    return new;
  end if;

  -- 주인·비회원 칸: 서버만
  if new.user_id is distinct from old.user_id
     or new.guest is distinct from old.guest
     or new.guest_phone is distinct from old.guest_phone
     or new.guest_email is distinct from old.guest_email
     or new.guest_pw_hash is distinct from old.guest_pw_hash
     or new.guest_token_hash is distinct from old.guest_token_hash then
    raise exception '주문자 기록은 서버에서만 바꿀 수 있어요';
  end if;

  -- 결제·취소 칸: 서버만
  if (new.status in ('결제완료', '취소완료') and old.status is distinct from new.status)
     or new.paid_at is distinct from old.paid_at
     or new.payment_key is distinct from old.payment_key
     or new.coupon_amount is distinct from old.coupon_amount
     or new.subtotal is distinct from old.subtotal
     or new.shipping_fee is distinct from old.shipping_fee
     or new.cancel_status is distinct from old.cancel_status
     or new.cancel_reason is distinct from old.cancel_reason
     or new.cancel_requested_at is distinct from old.cancel_requested_at
     or new.canceled_at is distinct from old.canceled_at
     or new.cancel_note is distinct from old.cancel_note then
    raise exception '결제·취소 기록은 서버에서만 바꿀 수 있어요';
  end if;

  -- 발주·송장 칸: 관리자만
  if not is_admin and (
       new.supply_status is distinct from old.supply_status
       or new.supply_lines is distinct from old.supply_lines
       or new.supply_ordered_at is distinct from old.supply_ordered_at
       or new.shipments is distinct from old.shipments
       or new.delivery_status is distinct from old.delivery_status
       or new.shipped_at is distinct from old.shipped_at
       or new.delivered_at is distinct from old.delivered_at) then
    raise exception '발주·배송 기록은 관리자만 바꿀 수 있어요';
  end if;
  return new;
end;
$$;

-- 3) 비회원 조회 횟수 제한은 find_id_log 표를 같이 쓴다(열쇠 앞머리 guest-ip: / guest-phone:) — 새 표 없음

-- 확인용: 아래 한 줄을 따로 실행하면 guest 칸 5개가 보여야 한다
-- select column_name from information_schema.columns where table_name = 'orders' and column_name like 'guest%';
