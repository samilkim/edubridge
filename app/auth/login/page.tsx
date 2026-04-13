'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: `${username.trim()}@edubridge.local`,
      password,
    })

    setLoading(false)
    if (error) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* 카드 */}
        <div
          className="p-8"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px',
          }}
        >
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🛡️</div>
            <h1 className="text-2xl font-black text-white mb-1">로그인</h1>
            <p className="text-white/40 text-sm">에듀브릿지에 오신 것을 환영합니다</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-2 font-medium">아이디</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="아이디 입력"
                className="glass-input"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-2 font-medium">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="glass-input"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div
                className="text-sm text-red-400 text-center py-2.5 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-2"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="text-center text-white/35 text-sm mt-6">
            계정이 없으신가요?{' '}
            <Link href="/auth/signup" className="text-white/65 hover:text-white underline underline-offset-2 transition-colors">
              회원가입
            </Link>
          </p>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          <Link href="/" className="hover:text-white/40 transition-colors">← 홈으로 돌아가기</Link>
        </p>
      </div>
    </div>
  )
}
