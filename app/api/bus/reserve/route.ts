import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json()
  const { student_name, from_location, to_location, reserved_date, reserved_time, course_name, voucher_eligible, use_voucher, voucher_code } = body

  if (!student_name || !from_location || !to_location || !reserved_date || !reserved_time) {
    return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 })
  }

  // 입력 길이 검증
  if (String(student_name).length > 50 || String(from_location).length > 100 || String(to_location).length > 100) {
    return NextResponse.json({ error: '입력값이 너무 깁니다.' }, { status: 400 })
  }

  if (use_voucher && !String(voucher_code ?? '').trim()) {
    return NextResponse.json({ error: '바우처 번호를 입력해주세요.' }, { status: 400 })
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
      use_voucher: use_voucher ?? false,
      voucher_code: use_voucher ? String(voucher_code ?? '').trim().slice(0, 30) : '',
      status: 'confirmed',
    })
    .select()
    .single()

  if (error) {
    console.error('[bus/reserve] Error:', error)
    return NextResponse.json({ error: '예약 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
  return NextResponse.json({ reservation: data })
}
