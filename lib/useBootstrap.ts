// lib/useBootstrap.ts — tải data tĩnh (locations/services/addons/vouchers/slots) 1 LẦN/phiên.
// Gộp 5–6 round-trip GAS thành 1 (endpoint `bootstrap`, cache server 10') + cache client cả phiên.
'use client'

import { useEffect, useState } from 'react'
import { gasApi } from './gasApi'
import { cache } from './cache'
import { TTL } from './config'
import { Service, AddonCatalog, Voucher, Location } from './types'

export interface BootstrapData {
  services: Service[]
  addons: AddonCatalog[]
  vouchers: Voucher[]
  locations: Location[]
  slot_times: string[]
}

const KEY = 'services:bootstrap'

export function useBootstrap() {
  const [data, setData] = useState<BootstrapData | null>(() => cache.get<BootstrapData>(KEY))
  const [loading, setLoading] = useState<boolean>(!cache.get<BootstrapData>(KEY))

  useEffect(() => {
    const cached = cache.get<BootstrapData>(KEY)
    if (cached) { setData(cached); setLoading(false); return } // tĩnh — không refetch trong phiên
    let alive = true
    gasApi<BootstrapData>('bootstrap')
      .then((d) => { if (!alive) return; setData(d); cache.set(KEY, d, TTL.STATIC) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return { data, loading }
}
