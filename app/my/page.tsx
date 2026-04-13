'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface SavedCourse {
  id: string
  course_name: string
  institution: string
  location: string
  homepage_url: string
  saved_at: string
}

interface BusReservation {
  id: string
  student_name: string
  from_location: string
  to_location: string
  reserved_date: string
  reserved_time: string
  course_name: string
  voucher_eligible: boolean
  status: string
  created_at: string
}

type Tab = 'courses' | 'reservations'

export default function MyPage() {
  const [tab, setTab] = useState<Tab>('courses')
  const [courses, setCourses] = useState<SavedCourse[]>([])
  const [reservations, setReservations] = useState<BusReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const [cr, rr] = await Promise.all([
      fetch('/api/courses/list'),
      fetch('/api/bus/list'),
    ])
    const [cd, rd] = await Promise.all([cr.json(), rr.json()])
    setCourses(cd.courses ?? [])
    setReservations(rd.reservations ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setUsername(user.email?.replace('@edubridge.local', '') ?? '')
      loadData()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteCourse = async (id: string) => {
    setDeletingId(id)
    await fetch('/api/courses/list', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setCourses(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  const formatDate = (str: string) =>
    new Date(str).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  const upcomingReservations = reservations.filter(
    r => r.reserved_date >= new Date().toISOString().split('T')[0]
  )
  const pastReservations = reservations.filter(
    r => r.reserved_date < new Date().toISOString().split('T')[0]
  )

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-4xl mx-auto">

        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-1">나의 에듀브릿지</h1>
          <p className="text-white/40 text-sm">{username}님의 강좌 및 이동 예약 현황</p>
        </div>

        {/* 탭 */}
        <div
          className="flex gap-1 mb-6 p-1 w-fit"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px',
          }}
        >
          {([
            { key: 'courses', label: '📚 저장한 강좌', count: courses.length },
            { key: 'reservations', label: '🚌 버스 예약', count: reservations.length },
          ] as const).map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                tab === item.key
                  ? 'bg-white text-black'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {item.label}
              {item.count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    tab === item.key
                      ? 'bg-black/15 text-black/60'
                      : 'bg-white/10 text-white/40'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        ) : (
          <>
            {/* ── 강좌 탭 ── */}
            {tab === 'courses' && (
              <div>
                {courses.length === 0 ? (
                  <EmptyState
                    icon="📚"
                    message="저장된 강좌가 없습니다"
                    sub="강좌 추천 페이지에서 관심 강좌를 저장해보세요"
                    href="/"
                    cta="강좌 찾으러 가기"
                  />
                ) : (
                  <div className="space-y-3">
                    {courses.map(course => (
                      <div
                        key={course.id}
                        className="flex items-center gap-4 p-5"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: '16px',
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold truncate">{course.course_name}</h3>
                          <p className="text-white/40 text-sm mt-0.5 truncate">
                            {course.institution}
                            {course.location && ` · ${course.location}`}
                          </p>
                          <p className="text-white/20 text-xs mt-1">{formatDate(course.saved_at)} 저장</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {course.homepage_url && (
                            <a
                              href={course.homepage_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-ghost text-xs py-1.5 px-3"
                            >
                              바로가기
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteCourse(course.id)}
                            disabled={deletingId === course.id}
                            className="text-white/20 hover:text-red-400 transition-colors text-lg leading-none disabled:opacity-40"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 버스 예약 탭 ── */}
            {tab === 'reservations' && (
              <div className="space-y-6">
                {reservations.length === 0 ? (
                  <EmptyState
                    icon="🚌"
                    message="예약된 버스가 없습니다"
                    sub="외부 지역 강좌 신청 시 똑버스를 예약할 수 있어요"
                    href="/"
                    cta="강좌 찾고 예약하기"
                  />
                ) : (
                  <>
                    {/* 예정된 예약 */}
                    {upcomingReservations.length > 0 && (
                      <section>
                        <h3 className="text-xs text-white/40 font-semibold mb-3 uppercase tracking-wider">예정된 예약</h3>
                        <div className="space-y-3">
                          {upcomingReservations.map(r => (
                            <ReservationCard key={r.id} res={r} formatDate={formatDate} />
                          ))}
                        </div>
                      </section>
                    )}

                    {/* 지난 예약 */}
                    {pastReservations.length > 0 && (
                      <section>
                        <h3 className="text-xs text-white/25 font-semibold mb-3 uppercase tracking-wider">지난 예약</h3>
                        <div className="space-y-3 opacity-50">
                          {pastReservations.map(r => (
                            <ReservationCard key={r.id} res={r} formatDate={formatDate} />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ReservationCard({
  res,
  formatDate,
}: {
  res: BusReservation
  formatDate: (s: string) => string
}) {
  return (
    <div
      className="p-5"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-white font-semibold">{res.student_name}</span>
            {res.voucher_eligible && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}
              >
                무료 바우처
              </span>
            )}
          </div>
          <p className="text-white/50 text-sm truncate">{res.course_name}</p>
          <div className="flex items-center gap-3 mt-2.5 text-xs text-white/35">
            <span>📅 {formatDate(res.reserved_date)}</span>
            <span>⏰ {res.reserved_time}</span>
          </div>
          <p className="text-white/25 text-xs mt-1 truncate">
            {res.from_location} → {res.to_location}
          </p>
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-full shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
        >
          {res.status === 'confirmed' ? '예약 확정' : res.status}
        </span>
      </div>
    </div>
  )
}

function EmptyState({
  icon, message, sub, href, cta,
}: {
  icon: string; message: string; sub: string; href: string; cta: string
}) {
  return (
    <div
      className="text-center py-16 px-6"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '20px',
      }}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-white/50 font-medium mb-1">{message}</p>
      <p className="text-white/25 text-sm mb-6">{sub}</p>
      <a href={href} className="btn-primary inline-flex">{cta}</a>
    </div>
  )
}
