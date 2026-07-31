export interface Post {
  id: number
  category: '공지' | '자유' | '후기'
  title: string
  author: string
  date: string
  views: number
  content: string
}

export interface DbPost {
  id: string
  author_id: string
  author_name: string
  category: '자유' | '후기'
  title: string
  content: string
  views: number
  created_at: string
}
