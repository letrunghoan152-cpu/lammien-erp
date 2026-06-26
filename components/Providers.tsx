'use client'
// components/Providers.tsx — gộp các context provider phía client

import { ReactNode } from 'react'
import { ToastProvider } from './Toast'
import { AuthProvider } from './AuthProvider'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  )
}
