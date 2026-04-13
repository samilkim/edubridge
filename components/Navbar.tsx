'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user?.email) setUsername(user.email.replace('@edubridge.local', ''))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user?.email) {
        setUsername(session.user.email.replace('@edubridge.local', ''))
      } else {
        setUsername('')
      }
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navLinks = [
    { href: '/', label: '강좌 추천' },
    { href: '/my', label: '나의 강좌' },
    { href: '/calendar', label: '버스 캘린더' },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 pt-4">
      <div
        className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
        }}
      >
        {/* 로고 */}
        <Link href="/" className="font-black text-white text-lg tracking-tight">
          🛡️ 에듀브릿지
        </Link>

        {/* 데스크톱 링크 */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                pathname === link.href
                  ? 'bg-white/[0.12] text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* 인증 버튼 */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <span className="text-white/40 text-sm">{username}님</span>
              <button
                onClick={handleLogout}
                className="text-sm text-white/50 hover:text-white transition-colors border border-white/10 hover:border-white/20 px-3.5 py-1.5 rounded-xl"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                로그인
              </Link>
              <Link
                href="/auth/signup"
                className="text-sm bg-white text-black font-semibold px-4 py-1.5 rounded-xl hover:bg-white/90 transition-colors"
              >
                회원가입
              </Link>
            </>
          )}
        </div>

        {/* 모바일 메뉴 토글 */}
        <button
          className="md:hidden text-white/60 hover:text-white p-1.5"
          onClick={() => setMenuOpen(v => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            {menuOpen ? (
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              />
            ) : (
              <path
                fillRule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              />
            )}
          </svg>
        </button>
      </div>

      {/* 모바일 드롭다운 */}
      {menuOpen && (
        <div
          className="md:hidden max-w-6xl mx-auto mt-2 p-4 flex flex-col gap-2"
          style={{
            background: 'rgba(10,10,10,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
          }}
        >
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname === link.href
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-white/8 pt-3 mt-1 flex flex-col gap-2">
            {user ? (
              <>
                <span className="text-white/30 text-xs px-4">{username}님 로그인 중</span>
                <button
                  onClick={() => { handleLogout(); setMenuOpen(false) }}
                  className="btn-ghost text-sm py-2"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" onClick={() => setMenuOpen(false)} className="btn-ghost text-sm py-2 text-center">
                  로그인
                </Link>
                <Link href="/auth/signup" onClick={() => setMenuOpen(false)} className="btn-primary text-sm py-2 text-center">
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
