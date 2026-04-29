'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

const TIME_SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30',
]

interface Props {
  courseName: string
  fromLocation: string
  toLocation: string
  isVoucherEligible: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function BusReservationModal({
  courseName,
  fromLocation,
  toLocation,
  isVoucherEligible,
  onClose,
  onSuccess,
}: Props) {
  const [studentName, setStudentName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [useVoucher, setUseVoucher] = useState(isVoucherEligible)
  const [voucherCode, setVoucherCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]

  const handleReserve = async () => {
    setError('')
    if (!studentName.trim()) { setError('학생 성함을 입력해주세요.'); return }
    if (!date) { setError('날짜를 선택해주세요.'); return }
    if (!time) { setError('시간을 선택해주세요.'); return }
    if (useVoucher && !voucherCode.trim()) { setError('바우처 번호를 입력해주세요.'); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인이 필요합니다.'); return }

    setLoading(true)
    const res = await fetch('/api/bus/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_name: studentName,
        from_location: fromLocation,
        to_location: toLocation,
        reserved_date: date,
        reserved_time: time,
        course_name: courseName,
        voucher_eligible: isVoucherEligible,
        use_voucher: useVoucher,
        voucher_code: useVoucher ? voucherCode.trim() : '',
      }),
    })

    setLoading(false)
    if (res.ok) {
      onSuccess()
    } else {
      const data = await res.json()
      setError(data.error ?? '예약 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-md p-6 animate-slide-up"
        style={{
          background: 'rgba(18,18,18,0.95)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '20px',
        }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold text-lg">🚌 똑버스 예약</h3>
            <p className="text-white/40 text-xs mt-0.5 truncate max-w-[240px]">{courseName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 취약 계층 바우처 섹션 */}
        {isVoucherEligible && (
          <div
            className="mb-5 rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {/* 취약 계층 안내 배지 */}
            <div
              className="p-3 flex items-center gap-2 text-sm"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <span className="text-base">✅</span>
              <span className="text-white/80">
                취약 지역 학생{' '}
                <span className="text-white font-semibold">무료 바우처</span> 대상입니다!
              </span>
            </div>

            {/* 바우처 사용 토글 */}
            <div className="p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <button
                type="button"
                onClick={() => setUseVoucher(v => !v)}
                className="w-full flex items-center justify-between text-sm transition-colors"
              >
                <span className="text-white/70 font-medium">바우처 사용하기</span>
                <div
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ background: useVoucher ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)' }}
                >
                  <div
                    className="absolute top-1 w-4 h-4 rounded-full transition-all"
                    style={{
                      background: useVoucher ? '#111' : 'rgba(255,255,255,0.5)',
                      left: useVoucher ? '24px' : '4px',
                    }}
                  />
                </div>
              </button>

              {/* 바우처 번호 입력 */}
              {useVoucher && (
                <div className="mt-3">
                  <label className="block text-xs text-white/50 mb-1.5 font-medium">
                    바우처 번호
                    <span className="text-white/30 ml-1">(교육청 발급 번호)</span>
                  </label>
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={e => setVoucherCode(e.target.value)}
                    placeholder="예: VC-2024-XXXXX"
                    className="glass-input"
                    maxLength={30}
                  />
                  <p className="text-xs text-white/30 mt-1.5">
                    바우처 사용 시 탑승 요금이 면제됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* 학생 성함 */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium">학생 성함</label>
            <input
              type="text"
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
              placeholder="성함을 입력하세요"
              className="glass-input"
            />
          </div>

          {/* 출발지 / 도착지 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium">출발지</label>
              <input type="text" value={fromLocation} readOnly className="glass-input opacity-50 cursor-default" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium">도착지</label>
              <input type="text" value={toLocation} readOnly className="glass-input opacity-50 cursor-default" />
            </div>
          </div>

          {/* 날짜 / 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium">날짜</label>
              <input
                type="date"
                value={date}
                min={today}
                onChange={e => setDate(e.target.value)}
                className="glass-input"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium">출발 시간</label>
              <select value={time} onChange={e => setTime(e.target.value)} className="glass-input">
                <option value="">시간 선택</option>
                {TIME_SLOTS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center py-1">{error}</p>
          )}

          <button
            onClick={handleReserve}
            disabled={loading}
            className="btn-primary w-full py-3 mt-1"
          >
            {loading ? '예약 중...' : useVoucher && isVoucherEligible ? '🎟️ 바우처로 무료 예약' : '🎫 예약 확정'}
          </button>
        </div>
      </div>
    </div>
  )
}
