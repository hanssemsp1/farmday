-- 결제가 시작된 주문은 내용을 못 바꾸게 (2026-10-14)
-- Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- 먼저 실행할 것: orders_guest.sql (실행됨)
--
-- 결제 승인 서버(toss-confirm)가 주문을 「승인 중」(payment_key)으로 잡은 뒤에는
--   · 상품 목록·금액·주문 상태 → 서버만
--   · 배송지 → 서버와 관리자만(관리자는 손님 요청으로 주소를 고칠 수 있게)
-- 결제 전(payment_key 없음)에는 손님이 자기 주문을 고칠 수 있지만, 서버가 승인할 때 다시 읽어 검사하고 DB 값으로 다시 쓴다.
-- 주문 상태(status)는 회원·비회원 모두 브라우저에서 바꾸지 않는다(관리자 포함 — 결제·취소는 서버 함수가 한다).

create or replace function public.orders_guard_payment()
returns trigger
language plpgsql
as $$
declare
  is_admin boolean := coalesce(auth.jwt() ->> 'email', '') = 'farmday.testuser02@gmail.com';
  locked boolean;
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
    if new.status is distinct from '결제대기' or new.paid_at is not null or new.payment_key is not null
       or coalesce(new.coupon_amount, 0) <> 0 or new.subtotal is not null or new.shipping_fee is not null
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

  -- 결제·취소 칸과 주문 상태: 서버만
  if new.status is distinct from old.status
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

  -- 결제가 시작된 주문(승인 중·결제완료): 상품·금액은 서버만, 배송지는 서버·관리자만
  locked := old.payment_key is not null or old.paid_at is not null;
  if locked and (new.items is distinct from old.items or new.total_amount is distinct from old.total_amount) then
    raise exception '결제가 시작된 주문의 상품·금액은 바꿀 수 없어요';
  end if;
  if locked and not is_admin and (
       new.buyer_name is distinct from old.buyer_name
       or new.buyer_phone is distinct from old.buyer_phone
       or new.recipient_name is distinct from old.recipient_name
       or new.recipient_phone is distinct from old.recipient_phone
       or new.zipcode is distinct from old.zipcode
       or new.address1 is distinct from old.address1
       or new.address2 is distinct from old.address2
       or new.delivery_memo is distinct from old.delivery_memo
       or new.supply_consent is distinct from old.supply_consent) then
    raise exception '결제가 시작된 주문의 배송지는 고객센터로 요청해 주세요';
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

-- 확인용(읽기만): 주문·상품 표에 걸린 정책 — 결과를 온대리에게 보여 주세요
-- select tablename, policyname, cmd, roles, qual, with_check from pg_policies where tablename in ('orders','products','product_options');
