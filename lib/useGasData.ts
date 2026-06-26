// lib/useGasData.ts — hook SWR-like (PRD Section 20.5): hiện cache cũ ngay, fetch nền, swap.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { gasApi, GasError } from './gasApi'
import { cache } from './cache'

interface Options {
  ttlMs?: number | null
  enabled?: boolean
}

export function useGasData<T = any>(
  action: string,
  params: Record<string, unknown> = {},
  opts: Options = {}
) {
  const { ttlMs = 60_000, enabled = true } = opts
  const cacheKey = action + ':' + JSON.stringify(params)

  const [data, setData] = useState<T | null>(() => (enabled ? cache.get<T>(cacheKey) : null))
  const [loading, setLoading] = useState<boolean>(enabled && !cache.get<T>(cacheKey))
  const [error, setError] = useState<GasError | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const refetch = useCallback(() => {
    if (!enabled) return
    gasApi<T>(action, params)
      .then((fresh) => {
        if (!mounted.current) return
        setData(fresh)
        setError(null)
        if (ttlMs !== undefined) cache.set(cacheKey, fresh, ttlMs)
      })
      .catch((e: GasError) => {
        if (!mounted.current) return
        setError(e)
      })
      .finally(() => {
        if (mounted.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled])

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    const cached = cache.get<T>(cacheKey)
    if (cached) { setData(cached); setLoading(false) } else { setLoading(true) }
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled])

  return { data, loading, error, refetch, setData }
}
