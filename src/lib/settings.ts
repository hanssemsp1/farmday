import { supabase } from './supabaseClient'
import { SiteSettings } from '../types/settings'

interface DbSettings {
  company_name: string
  ceo_name: string
  business_reg_no: string
  address: string
  phone: string
}

function fromDb(row: DbSettings): SiteSettings {
  return {
    companyName: row.company_name,
    ceoName: row.ceo_name,
    businessRegNo: row.business_reg_no,
    address: row.address,
    phone: row.phone,
  }
}

export async function fetchSiteSettings(): Promise<{ data: SiteSettings | null; error: string | null }> {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).single()
  return { data: data ? fromDb(data as DbSettings) : null, error: error?.message ?? null }
}

export async function updateSiteSettings(input: SiteSettings) {
  const { error } = await supabase
    .from('site_settings')
    .update({
      company_name: input.companyName,
      ceo_name: input.ceoName,
      business_reg_no: input.businessRegNo,
      address: input.address,
      phone: input.phone,
    })
    .eq('id', 1)
  return { error: error?.message ?? null }
}
