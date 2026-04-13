'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError('아이디는 영문, 숫자, 밑줄(_)만 사용 가능하며 3~20자여야 합니다.')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: `${username}@edubridge.local`,
      password,
      options: { data: { username } },
    })

    if (signUpError) {
      // 이미 사용 중인 아이디
      if (signUpError.message.includes('already registered')) {
        setError('이미 사용 중인 아이디입니다.')
      } else {
        setError(signUpError.message)
      }
      setLoading(false)
      return
    }

    // profiles 테이블에 사용자명 저장
    if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, username })
    }

    setLoading(false)
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

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
            <div className="text-4xl mb-3">✨</div>
            <h1 className="text-2xl font-black text-white mb-1">회원가입</h1>
            <p className="text-white/40 text-sm">에듀브릿지와 함께 시작해보세요</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-2 font-medium">
                아이디 <span className="text-white/25">(영문, 숫자, _ 3~20자)</span>
              </label>
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
              <label className="block text-xs text-white/50 mb-2 font-medium">
                비밀번호 <span className="text-white/25">(6자 이상)</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="glass-input"
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-2 font-medium">비밀번호 확인</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="비밀번호 재입력"
                className="glass-input"
                required
                autoComplete="new-password"
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
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <p className="text-center text-white/35 text-sm mt-6">
            이미 계정이 있으신가요?{' '}
            <Link href="/auth/login" className="text-white/65 hover:text-white underline underline-offset-2 transition-colors">
              로그인
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
