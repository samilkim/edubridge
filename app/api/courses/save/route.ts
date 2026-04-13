import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { course_name, institution, location, homepage_url } = await req.json()

  // 중복 저장 방지
  const { data: existing } = await supabase
    .from('saved_courses')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_name', course_name)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: '이미 저장된 강좌입니다.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('saved_courses')
    .insert({ user_id: user.id, course_name, institution, location, homepage_url })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ course: data })
}
