import { supabase } from './supabaseClient'

export async function uploadProductImage(file: File): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split('.').pop()
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('products').upload(path, file)
  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from('products').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
