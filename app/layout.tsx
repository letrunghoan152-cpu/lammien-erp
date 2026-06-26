import './globals.css'
import type { Metadata, Viewport } from 'next'
import Providers from '@/components/Providers'

export const metadata: Metadata = {
  title: 'Studio LẠM MIÊN — Quản lý',
  description: 'Hệ thống quản lý vận hành Studio LẠM MIÊN',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6d8150',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
