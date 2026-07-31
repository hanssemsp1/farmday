import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { fetchSiteSettings } from '../lib/settings'
import { SiteSettings } from '../types/settings'

interface SiteSettingsContextValue {
  settings: SiteSettings | null
  loading: boolean
  refetch: () => void
}

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null)

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await fetchSiteSettings()
    setSettings(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, refetch: load }}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext)
  if (!ctx) throw new Error('useSiteSettings must be used within SiteSettingsProvider')
  return ctx
}
