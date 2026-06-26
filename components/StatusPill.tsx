'use client'
// components/StatusPill.tsx — pill trạng thái đơn / thanh toán (PRD Section 15.6)

import { STATUS_META, PAYMENT_META, pillStyle } from '@/lib/status'

export function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status]
  return (
    <span className={'pill' + (meta?.dashed ? ' dashed' : '')} style={pillStyle(meta)}>
      {meta?.label || status}
    </span>
  )
}

export function PaymentPill({ status }: { status?: string }) {
  if (!status) return <span className="dim">—</span>
  const meta = PAYMENT_META[status]
  return <span className="pill" style={pillStyle(meta)}>{meta?.label || status}</span>
}

export function DeliveryPill({ type }: { type: string | null }) {
  if (!type) return null
  const isPrint = type === 'PRINT'
  return (
    <span className="pill" style={{ background: 'var(--panel-2)', color: 'var(--muted)' }}>
      {isPrint ? '🖨 In ấn' : '💾 Digital'}
    </span>
  )
}
