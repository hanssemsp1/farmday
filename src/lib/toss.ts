import { loadTossPayments } from '@tosspayments/tosspayments-sdk'

const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY

export async function requestTossPayment({
  orderId,
  orderName,
  amount,
  customerName,
  customerEmail,
}: {
  orderId: string
  orderName: string
  amount: number
  customerName: string
  customerEmail: string
}) {
  if (!clientKey) {
    throw new Error('Toss Payments 클라이언트 키가 설정되지 않았어요. .env의 VITE_TOSS_CLIENT_KEY를 확인해주세요.')
  }
  const tossPayments = await loadTossPayments(clientKey)
  const payment = tossPayments.payment({ customerKey: orderId })

  await payment.requestPayment({
    method: 'CARD',
    amount: { currency: 'KRW', value: amount },
    orderId,
    orderName,
    customerName,
    customerEmail,
    successUrl: `${window.location.origin}/checkout/success`,
    failUrl: `${window.location.origin}/checkout/fail`,
  })
}
