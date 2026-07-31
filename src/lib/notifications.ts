import { supabase } from './supabaseClient'
import { DbNotification } from '../types/notification'

export async function fetchNotifications(): Promise<{ data: DbNotification[]; error: string | null }> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
  return { data: (data as DbNotification[]) ?? [], error: error?.message ?? null }
}

export async function createNotification(title: string, body: string, link?: string) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({ title, body, link: link ?? null })
    .select()
    .single()
  return { data: data as DbNotification | null, error: error?.message ?? null }
}

export async function markAsRead(id: string) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id)
  return { error: error?.message ?? null }
}

export async function markAllAsRead(ids: string[]) {
  const { error } = await supabase.from('notifications').update({ read: true }).in('id', ids)
  return { error: error?.message ?? null }
}
