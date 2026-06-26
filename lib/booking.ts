// lib/booking.ts — tính toán phía client cho Booking Form (mirror logic GAS)

import { Voucher } from './types'

export function minutesOf(hhmm: string): number | null {
  const m = (hhmm || '').match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

export function addMinutes(hhmm: string, minutes: number): string {
  const m = minutesOf(hhmm)
  if (m === null) return ''
  const total = m + (Number(minutes) || 0)
  const h = Math.floor(total / 60) % 24
  const mm = ((total % 60) + 60) % 60
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0')
}

export function voucherDiscount(v: Voucher | undefined, base: number): number {
  if (!v) return 0
  if (v.type === 'PERCENT') return Math.round((base * v.value) / 100)
  return Math.min(v.value, base)
}

export interface ConceptInput {
  service_id: string
  custom_price: number | string
  voucher_id: string | null
}
export interface AddonInput {
  addon_catalog_id: string
  quantity: number
  actual_price: number
}

/** Tổng đơn = Σ concept (− voucher concept 2+) + Σ addon − voucher đơn (Section 7.4) */
export function computeTotal(
  concepts: ConceptInput[],
  addons: AddonInput[],
  orderVoucherId: string | null,
  vouchers: Voucher[]
): { subtotal: number; total: number; conceptDiscount: number; orderDiscount: number; addonTotal: number } {
  const vmap = new Map(vouchers.map((v) => [v.voucher_id, v]))
  let conceptSum = 0
  let conceptDiscount = 0
  concepts.forEach((c, i) => {
    const price = Number(c.custom_price) || 0
    conceptSum += price
    if (i + 1 >= 2 && c.voucher_id) {
      conceptDiscount += voucherDiscount(vmap.get(c.voucher_id), price)
    }
  })
  let addonTotal = 0
  addons.forEach((a) => { addonTotal += (Number(a.actual_price) || 0) * (Number(a.quantity) || 1) })

  let subtotal = conceptSum - conceptDiscount + addonTotal
  let orderDiscount = 0
  if (orderVoucherId) {
    orderDiscount = voucherDiscount(vmap.get(orderVoucherId), subtotal)
    subtotal -= orderDiscount
  }
  return { subtotal: conceptSum + addonTotal, total: Math.max(subtotal, 0), conceptDiscount, orderDiscount, addonTotal }
}
