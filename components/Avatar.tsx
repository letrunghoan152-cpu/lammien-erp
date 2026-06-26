'use client'
// components/Avatar.tsx — avatar KH với initials fallback (PRD Section 15.17B)

import { useState } from 'react'
import { getInitials } from '@/lib/format'

interface Props {
  name?: string | null
  url?: string | null
  size?: 'sm' | 'md' | '' | 'lg' | 'xl'
}

export default function Avatar({ name, url, size = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const cls = 'avatar' + (size ? ' ' + size : '')
  if (url && !failed) {
    return <img className={cls} src={url} alt={name || ''} onError={() => setFailed(true)} />
  }
  return <span className={cls} title={name || ''}>{getInitials(name)}</span>
}
