'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import BusReservationModal from '@/components/BusReservationModal'
import type { User } from '@supabase/supabase-js'

interface District {
  시군명: string
  구: string
  인프라_취약_지수: number
  경제_취약_지수: number
  최종_취약지수: number
}

interface LectureResult {
  강좌명: string
  강좌내용: string
  운영기관명: string
  홈페이지주소: string
  수강료: string
  시군명: string
  구: string
  rank: number
  reason: string
  is_external: boolean
  is_free: boolean
}

export default function HomePage() {
  const [districts, setDistricts] = useState<District[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [selectedCity, setSelectedCity] = useState('')
  const [districtOptions, setDistrictOptions] = useState<string[]>([])
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LectureResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [savedCourses, setSavedCourses] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)
  const [reservationTarget, setReservationTarget] = useState<LectureResult | null>(null)
  const [toast, setToast] = useState('')
  const [geminiWorking, setGeminiWorking] = useState<boolean | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetch('/api/districts')
      .then(r => r.json())
      .then((data: District[]) => {
        setDistricts(data)
        const cityList = Array.from(new Set(data.map(d => d.시군명))).sort()
        setCities(cityList)
        if (cityList.length > 0) setSelectedCity(cityList[0])
      })

    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedCity) return
    const dists = districts
      .filter(d => d.시군명 === selectedCity)
      .map(d => d.구)
      .sort()
    setDistrictOptions(dists)
    setSelectedDistrict(dists[0] ?? '')
  }, [selectedCity, districts])

  const currentVuln = districts.find(
    d => d.시군명 === selectedCity && d.구 === selectedDistrict
  )

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResults([])
    setSearched(true)
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, city: selectedCity, district: selectedDistrict }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResults(data.results)
      setGeminiWorking(data.geminiWorking ?? false)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (lecture: LectureResult) => {
    if (!user) { showToast('강좌 저장은 로그인 후 이용할 수 있습니다.'); return }
    setSavingId(lecture.강좌명)
    const res = await fetch('/api/courses/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_name: lecture.강좌명,
        institution: lecture.운영기관명,
        location: `${lecture.시군명} ${lecture.구}`,
        homepage_url: lecture.홈페이지주소,
      }),
    })
    setSavingId(null)
    if (res.ok) {
      setSavedCourses(prev => new Set([...prev, lecture.강좌명]))
      showToast('강좌가 저장되었습니다.')
    } else {
      const data = await res.json()
      showToast(data.error ?? '저장 중 오류가 발생했습니다.')
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  const vulnLevel = (val: number) => {
    if (val >= 60) return { label: '매우 높음', color: '#ef4444' }
    if (val >= 40) return { label: '높음', color: '#f97316' }
    if (val >= 20) return { label: '보통', color: '#eab308' }
    return { label: '낮음', color: '#22c55e' }
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-6xl mx-auto">

        {/* 히어로 */}
        <div className="text-center mb-12 pt-4">
          <div
            className="inline-block px-4 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
          >
            경기도 AI 교육 접근성 지원 플랫폼
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tighter leading-none">
            에듀브릿지
          </h1>
          <p className="text-white/40 text-lg">
            AI가 당신에게 맞는 디지털 강좌와 이동 수단을 함께 찾아드립니다
          </p>
        </div>

        {/* 검색 패널 */}
        <div
          className="p-6 mb-8"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
          }}
        >
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-white/50 mb-2 font-medium">시 / 군</label>
              <select
                value={selectedCity}
                onChange={e => setSelectedCity(e.target.value)}
                className="glass-input"
              >
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-2 font-medium">구 / 동</label>
              <select
                value={selectedDistrict}
                onChange={e => setSelectedDistrict(e.target.value)}
                className="glass-input"
              >
                {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-white/50 mb-2 font-medium">배우고 싶은 것</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading && handleSearch()}
                  placeholder="예: 파이썬으로 게임 만들고 싶어요"
                  className="glass-input flex-1"
                />
                <button
                  onClick={handleSearch}
                  disabled={loading || !query.trim()}
                  className="btn-primary px-5 whitespace-nowrap shrink-0"
                >
                  {loading ? '분석 중...' : '✨ 찾기'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div
            className="p-4 mb-6 rounded-xl text-sm text-red-400"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="spinner" />
            <p className="text-white/40 text-sm">AI가 맞춤 강좌를 분석하고 있어요...</p>
          </div>
        )}

        {/* 결과 */}
        {!loading && results.length > 0 && (
          <div className="mb-12 animate-slide-up">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <h2 className="text-lg font-bold text-white">
                🎯{' '}
                <span className="text-white/60">{selectedDistrict}</span>
                {' '}학생을 위한 AI 추천 강좌
              </h2>
              {geminiWorking !== null && (
                <span
                  className="text-xs px-3 py-1 rounded-full font-medium"
                  style={
                    geminiWorking
                      ? { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
                      : { background: 'rgba(234,179,8,0.12)', color: '#facc15', border: '1px solid rgba(234,179,8,0.2)' }
                  }
                >
                  {geminiWorking ? '✓ Gemini AI 연결됨' : '⚠ AI 없이 추천 (기본 알고리즘)'}
                </span>
              )}
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {results.map((lecture, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-4 p-5 glass-hover"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '20px',
                  }}
                >
                  {/* 뱃지 */}
                  <div className="flex justify-between items-center">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                    >
                      BEST {lecture.rank}
                    </span>
                    {lecture.is_free && (
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}
                      >
                        FREE
                      </span>
                    )}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-base leading-snug mb-2.5">
                      {lecture.강좌명}
                    </h3>
                    <p className="text-white/45 text-sm leading-relaxed">
                      💡 {lecture.reason}
                    </p>
                  </div>

                  <div className="text-xs text-white/30 font-medium">
                    📍 {lecture.시군명} {lecture.구}
                  </div>

                  {/* 버튼 */}
                  <div className="flex gap-2">
                    {lecture.홈페이지주소 && (
                      <a
                        href={lecture.홈페이지주소}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary flex-1 text-sm py-2"
                      >
                        상세 신청
                      </a>
                    )}
                    <button
                      onClick={() => handleSave(lecture)}
                      disabled={savedCourses.has(lecture.강좌명) || savingId === lecture.강좌명}
                      className="btn-ghost text-sm py-2 px-3"
                    >
                      {savedCourses.has(lecture.강좌명) ? '✓' : savingId === lecture.강좌명 ? '...' : '저장'}
                    </button>
                  </div>

                  {/* 외부 지역 안내 */}
                  {lecture.is_external && (
                    <div
                      className="text-xs px-3 py-1.5 rounded-lg text-center"
                      style={{ background: 'rgba(251,191,36,0.08)', color: 'rgba(251,191,36,0.8)', border: '1px solid rgba(251,191,36,0.15)' }}
                    >
                      📍 {lecture.시군명} 위치 — 인근 지역 추천 강좌
                    </div>
                  )}

                  {/* 똑버스 */}
                  {lecture.is_external ? (
                    <button
                      onClick={() => {
                        if (!user) { showToast('버스 예약은 로그인 후 이용할 수 있습니다.'); return }
                        setReservationTarget(lecture)
                      }}
                      className="w-full text-sm py-2.5 rounded-xl text-center transition-all"
                      style={{
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.55)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                        e.currentTarget.style.color = '#fff'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                      }}
                    >
                      🚌 똑버스 예약
                    </button>
                  ) : (
                    <div className="text-center text-xs text-white/25 py-1">🏠 우리 동네 강좌</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 검색했지만 결과 없을 때 */}
        {!loading && searched && results.length === 0 && !error && (
          <div className="text-center py-16 text-white/30">
            <p className="text-4xl mb-3">🔍</p>
            <p>검색 결과가 없습니다. 다른 키워드로 시도해보세요.</p>
          </div>
        )}

        {/* 취약지수 현황 */}
        {currentVuln && (
          <div
            className="p-6"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
            }}
          >
            <h3 className="text-sm font-bold text-white/70 mb-5">
              📊 {selectedCity} {selectedDistrict} 교육 환경 현황
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: '인프라 취약도', value: currentVuln.인프라_취약_지수 },
                { label: '경제적 취약도', value: currentVuln.경제_취약_지수 },
                { label: '종합 소외 지수', value: currentVuln.최종_취약지수 },
              ].map(stat => {
                const level = vulnLevel(stat.value)
                return (
                  <div
                    key={stat.label}
                    className="text-center p-4 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <div className="text-3xl font-black text-white mb-1">
                      {stat.value.toFixed(1)}
                    </div>
                    <div className="text-xs font-medium mb-1" style={{ color: level.color }}>
                      {level.label}
                    </div>
                    <div className="text-xs text-white/35">{stat.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 똑버스 예약 모달 */}
      {reservationTarget && (
        <BusReservationModal
          courseName={reservationTarget.강좌명}
          fromLocation={`${selectedCity} ${selectedDistrict}`}
          toLocation={reservationTarget.운영기관명}
          isVoucherEligible={(currentVuln?.최종_취약지수 ?? 0) > 35}
          onClose={() => setReservationTarget(null)}
          onSuccess={() => {
            setReservationTarget(null)
            showToast('✅ 똑버스 예약이 완료되었습니다!')
          }}
        />
      )}

      {/* 토스트 알림 */}
      {toast && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 text-sm font-medium text-white animate-slide-up whitespace-nowrap"
          style={{
            background: 'rgba(20,20,20,0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: '14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
