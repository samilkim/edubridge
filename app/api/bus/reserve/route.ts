import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json()
  const { student_name, from_location, to_location, reserved_date, reserved_time, course_name, voucher_eligible } = body

  if (!student_name || !from_location || !to_location || !reserved_date || !reserved_time) {
    return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bus_reservations')
    .insert({
      user_id: user.id,
      student_name,
      from_location,
      to_location,
      reserved_date,
      reserved_time,
      course_name: course_name ?? '',
      voucher_eligible: voucher_eligible ?? false,
      status: 'confirmed',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reservation: data })
}
