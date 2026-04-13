import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: '에듀브릿지 | AI 강좌 & 똑버스 매칭',
  description: '경기도 디지털 교육 기회를 모든 학생에게. AI 강좌 추천 & 똑버스 이동 지원 시스템.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={inter.variable}>
      <body>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}
