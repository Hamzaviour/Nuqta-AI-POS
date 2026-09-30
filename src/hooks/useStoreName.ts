import { useEffect, useState } from 'react'

export const DEFAULT_STORE_NAME = 'My Store'

let cached: string | null = null

/** The shop's own name from System Setup (settings.company_name). */
export function useStoreName(): string {
  const [name, setName] = useState(cached ?? DEFAULT_STORE_NAME)

  useEffect(() => {
    let alive = true
    window.api.getAllSettings?.()
      .then(s => {
        cached = (s as unknown as Record<string, string>)['company_name'] || DEFAULT_STORE_NAME
        if (alive) setName(cached)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  return name
}
