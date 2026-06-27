'use client'
// components/orders/OrderTimeline.tsx — timeline ngang theo workflow thật (tông olive)

import { PIPELINE, statusToStep, isCancelled, isPaused, isCompleted } from '@/lib/orderFlow'

export function OrderTimeline({ status, size = 'full' }: { status: string; size?: 'mini' | 'full' }) {
  const cancelled = isCancelled(status)
  const completed = isCompleted(status)
  const cur = statusToStep(status)
  const paused = isPaused(status)
  const mini = size === 'mini'

  return (
    <div className={'timeline' + (mini ? ' mini' : '') + (cancelled ? ' tl-cancel' : '')}>
      {PIPELINE.map((s, i) => {
        const state = cancelled ? 'todo' : completed || i < cur ? 'done' : i === cur ? 'current' : 'todo'
        const lineOn = !cancelled && (completed || i <= cur)
        return (
          <div className="tl-step" key={s.key}>
            {i > 0 && <span className={'tl-line' + (lineOn ? ' on' : '')} />}
            <span className={`tl-dot ${state}` + (paused && i === cur ? ' paused' : '')}>
              {mini ? '' : state === 'done' ? '✓' : s.icon}
            </span>
            {!mini && <span className="tl-label">{paused && i === cur ? 'Tạm dừng' : s.label}</span>}
          </div>
        )
      })}
    </div>
  )
}
