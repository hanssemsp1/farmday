import { supabase } from './supabaseClient'
import { DbPost } from '../types/post'

export async function fetchPosts(): Promise<{ data: DbPost[]; error: string | null }> {
  const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
  return { data: (data as DbPost[]) ?? [], error: error?.message ?? null }
}

export async function fetchPostById(id: string): Promise<{ data: DbPost | null; error: string | null }> {
  const { data, error } = await supabase.from('posts').select('*').eq('id', id).single()
  return { data: data as DbPost | null, error: error?.message ?? null }
}

export async function createPost(category: DbPost['category'], title: string, content: string, authorName: string) {
  const { data, error } = await supabase
    .from('posts')
    .insert({ category, title, content, author_name: authorName })
    .select()
    .single()
  return { data: data as DbPost | null, error: error?.message ?? null }
}

export async function deletePost(id: string) {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  return { error: error?.message ?? null }
}
