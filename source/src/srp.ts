import { useEffect, useState } from 'react'

export type SrpProduct = {
  product: string
  unit: string
  srp: number
  date: string
}

export type SrpCategory = {
  category: string
  date: string
  count: number
  min: number
  median: number
  max: number
  products: SrpProduct[]
}

export type SrpData = {
  source: string
  note: string
  categories: SrpCategory[]
}

export const DEFAULT_SRP_CATEGORY = 'CANNED SARDINES IN TOMATO SAUCE'

export function useSrpData() {
  const [data, setData] = useState<SrpData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>(
    'loading',
  )

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 4000)

    fetch('./srp.json', { cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('SRP data request failed')
        return response.json()
      })
      .then((payload: SrpData) => {
        if (!active) return
        if (!Array.isArray(payload.categories) || payload.categories.length === 0) {
          throw new Error('SRP data is empty')
        }
        setData(payload)
        setStatus('ready')
      })
      .catch(() => {
        if (active) setStatus('fallback')
      })
      .finally(() => window.clearTimeout(timer))

    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [])

  return { data, status }
}
