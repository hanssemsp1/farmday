import { User } from '@supabase/supabase-js'

// TODO: farmfarmday@naver.com 계정 정리되면 이걸로 다시 바꾸세요
export const ADMIN_EMAIL = 'farmday.testuser02@gmail.com'

export function isAdmin(user: User | null): boolean {
  return user?.email === ADMIN_EMAIL
}
