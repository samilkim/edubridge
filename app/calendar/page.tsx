'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface BusReservation {
  id: string
  student_name: string
  from_location: string
  to_location: string
  reserved_date: string
  reserved_time: string
  course_name: string
  voucher_eligible: boolean
}

const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const DAY_NAMES = ['일','월','화','수','목','금','토']

export default function CalendarPage() {
  const [reservations, setReservations] = useState<BusReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const res = await fetch('/api/bus/list')
    if (res.status === 401) { router.push('/auth/login'); return }
    const data = await res.json()
    setReservations(data.reservations ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      loadData()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toISOString().split('T')[0]

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  // 날짜별 예약 맵
  const reservationMap = reservations.reduce<Record<string, BusReservation[]>>((acc, r) => {
    if (!acc[r.reserved_date]) acc[r.reserved_date] = []
    acc[r.reserved_date].push(r)
    return acc
  }, {})

  const getCellDate = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const selectedReservations = selectedDate ? (reservationMap[selectedDate] ?? []) : []

  // 이번 달 예약 수
  const thisMonthCount = reservations.filter(r => {
    const d = new Date(r.reserved_date)
    return d.getFullYear() === year && d.getMonth() === month
  }).length

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-5xl mx-auto">

        {/* 헤더 */}
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white mb-1">버스 예약 캘린더</h1>
            <p className="text-white/40 text-sm">예약된 똑버스 일정을 한눈에 확인하세요</p>
          </div>
          {thisMonthCount > 0 && (
            <div className="text-right">
              <div className="text-2xl font-black text-white">{thisMonthCount}</div>
              <div className="text-white/30 text-xs">이번 달 예약</div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">

            {/* ── 캘린더 ── */}
            <div
              className="md:col-span-2 p-6"
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px',
              }}
            >
              {/* 월 네비게이션 */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={prevMonth}
                  className="btn-ghost px-3 py-2 text-sm"
                >
                  ‹
                </button>
                <h2 className="text-white font-bold text-lg">
                  {year}년 {MONTH_NAMES[month]}
                </h2>
                <button
                  onClick={nextMonth}
                  className="btn-ghost px-3 py-2 text-sm"
                >
                  ›
                </button>
              </div>

              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 mb-2">
                {DAY_NAMES.map((d, i) => (
                  <div
                    key={d}
                    className={`text-center text-xs font-semibold py-2 ${
                      i === 0 ? 'text-red-400/50' : i === 6 ? 'text-blue-400/50' : 'text-white/25'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* 날짜 그리드 */}
              <div className="grid grid-cols-7 gap-1">
                {/* 빈 셀 */}
                {Array(firstDayOfWeek).fill(null).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {/* 날짜 셀 */}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const dateStr = getCellDate(day)
                  const hasRes = !!reservationMap[dateStr]
                  const resCount = reservationMap[dateStr]?.length ?? 0
                  const isToday = dateStr === today
                  const isSelected = dateStr === selectedDate
                  const isPast = dateStr < today

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                      className="relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all"
                      style={{
                        background: isSelected
                          ? '#ffffff'
                          : isToday
                          ? 'rgba(255,255,255,0.12)'
                          : hasRes
                          ? 'rgba(255,255,255,0.07)'
                          : 'transparent',
                        color: isSelected
                          ? '#000'
                          : isPast
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(255,255,255,0.8)',
                        fontWeight: isToday || isSelected || hasRes ? '700' : '400',
                        border: isToday && !isSelected ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                      }}
                    >
                      {day}
                      {hasRes && (
                        <span
                          className="absolute bottom-1.5 flex gap-0.5"
                        >
                          {Array.from({ length: Math.min(resCount, 3) }).map((_, i) => (
                            <span
                              key={i}
                              className="w-1 h-1 rounded-full"
                              style={{ background: isSelected ? '#000' : 'rgba(255,255,255,0.6)' }}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* 범례 */}
              <div className="flex gap-4 mt-5 pt-4 border-t border-white/8">
                <div className="flex items-center gap-1.5 text-xs text-white/30">
                  <span className="w-2 h-2 rounded-full bg-white/60" />
                  예약 있는 날
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/30">
                  <span className="w-4 h-4 rounded-lg border border-white/25 flex items-center justify-center text-white/60 text-[10px] font-bold">오</span>
                  오늘
                </div>
              </div>
            </div>

            {/* ── 상세 패널 ── */}
            <div
              className="p-5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '20px',
              }}
            >
              {selectedDate ? (
                <>
                  <h3 className="text-white font-bold text-sm mb-4">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short',
                    })}
                  </h3>

                  {selectedReservations.length === 0 ? (
                    <p className="text-white/25 text-sm">이 날 예약이 없습니다</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedReservations
                        .sort((a, b) => a.reserved_time.localeCompare(b.reserved_time))
                        .map(res => (
                          <div
                            key={res.id}
                            className="p-3 rounded-xl"
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-white font-semibold text-sm">⏰ {res.reserved_time}</span>
                              {res.voucher_eligible && (
                                <span className="text-xs" style={{ color: '#4ade80' }}>무료</span>
                              )}
                            </div>
                            <p className="text-white/60 text-xs mb-0.5">{res.student_name}</p>
                            <p className="text-white/40 text-xs truncate">{res.course_name}</p>
                            <p className="text-white/25 text-xs mt-1 truncate">
                              {res.from_location} → {res.to_location}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                  {reservations.length === 0 ? (
                    <>
                      <div className="text-3xl mb-3">🚌</div>
                      <p className="text-white/30 text-sm mb-1">예약된 버스가 없습니다</p>
                      <p className="text-white/20 text-xs">강좌 추천 페이지에서</p>
                      <p className="text-white/20 text-xs mb-5">똑버스를 예약해보세요</p>
                      <a href="/" className="btn-ghost text-xs py-2 px-4">강좌 찾기</a>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl mb-3">📅</div>
                      <p className="text-white/30 text-sm">날짜를 클릭하면</p>
                      <p className="text-white/20 text-xs mt-1">예약 내용을 확인할 수 있어요</p>
                      <div
                        className="mt-6 pt-5 w-full border-t text-center"
                        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
                      >
                        <div className="text-3xl font-black text-white">{reservations.length}</div>
                        <div className="text-white/30 text-xs mt-1">총 예약 건수</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
