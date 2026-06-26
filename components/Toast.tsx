'use client'
// components/Toast.tsx — toast góc dưới-phải, auto-dismiss 3s (PRD Section 15.4)

import { createContext, useCallback, useContext, useState, ReactNode } from 'react'

type ToastKind = 'success' | 'error'
interface ToastItem { id: number; msg: string; kind: ToastKind }

const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

let _id = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const show = useCallback((msg: string, kind: ToastKind = 'success') => {
    const id = ++_id
    setItems((prev) => [...prev, { id, msg, kind }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3000)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap">
        {items.map((t) => (
          <div key={t.id} className={'toast anim-slide-right' + (t.kind === 'error' ? ' error' : '')}>
            {t.kind === 'success' ? '✓ ' : ''}{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
