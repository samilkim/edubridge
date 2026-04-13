import { NextRequest, NextResponse } from 'next/server'
import { getLectures, getDistricts } from '@/lib/data'
import { GoogleGenerativeAI } from '@google/generative-ai'

const NEIGHBOR_MAP: Record<string, string[]> = {
  연천군: ['동두천시', '포천시', '파주시', '양주시'],
  가평군: ['포천시', '남양주시', '양평군'],
  양평군: ['가평군', '여주시', '남양주시', '광주시'],
  여주시: ['양평군', '이천시', '광주시'],
  포천시: ['연천군', '가평군', '동두천시', '양주시'],
  동두천시: ['연천군', '양주시', '포천시'],
  양주시: ['의정부시', '동두천시', '고양시', '파주시', '연천군', '포천시'],
  안성시: ['평택시', '용인시', '이천시'],
  수원시: ['화성시', '용인시', '안산시', '의왕시'],
}

export async function POST(req: NextRequest) {
  try {
    const { query, city, district } = await req.json()

    const lectures = getLectures()
    const districts = getDistricts()

    const vulRow = districts.find(d => d.시군명 === city && d.구 === district)
    if (!vulRow) {
      return NextResponse.json({ error: '지역 정보를 찾을 수 없습니다.' }, { status: 400 })
    }

    // 1단계: 학생 관련 강좌 우선 필터링
    const studentKeywords = ['학생', '청소년', '초등', '중등', '고등', '어린이', '꿈나무', '학교']
    let filtered = lectures.filter(l =>
      studentKeywords.some(kw => l.search_text?.includes(kw))
    )
    if (filtered.length < 5) filtered = lectures

    // 2단계: Gemini 키워드 확장
    let aiKeywords = query
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const kwResult = await model.generateContent(
        `질문: '${query}'. 이와 관련된 학생용 디지털 기술 키워드 3개만 쉼표로 답해줘. 다른 말은 하지 마.`
      )
      aiKeywords = kwResult.response.text().trim()
    } catch {
      // Gemini 실패 시 원본 쿼리로 진행
    }

    // 3단계: 점수 산출
    const queryWords = (query + ' ' + aiKeywords)
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean)

    const scored = filtered.map(lecture => {
      const text = lecture.search_text ?? ''

      // 유사도 점수 (50점)
      const matchCount = queryWords.filter(w => text.includes(w)).length
      const simScore = queryWords.length > 0 ? (matchCount / queryWords.length) * 50 : 0

      // 지역 접근성 점수 (30점)
      let regScore = 0
      if (lecture.구 === district) regScore = 30
      else if (lecture.시군명 === city) regScore = 20
      else if (NEIGHBOR_MAP[city]?.includes(lecture.시군명)) regScore = 10

      // 취약지수 반영 (20점)
      const vulScore = (vulRow.최종_취약지수 / 100) * 20

      // 무료 강좌 가산점 (10점)
      const feeInfo = (String(lecture.수강료) + String(lecture.강좌내용)).toLowerCase()
      const feeBonus = feeInfo.includes('무료') || lecture.수강료 === '0' ? 10 : 0

      return { ...lecture, total_score: simScore + regScore + vulScore + feeBonus }
    })

    const top3 = scored.sort((a, b) => b.total_score - a.total_score).slice(0, 3)

    // 4단계: Gemini 추천 사유 생성
    let reasons: string[] = []
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const names = top3.map(l => l.강좌명).join(', ')
      const result = await model.generateContent(
        `학생의 질문: "${query}"\n다음 강좌가 왜 좋은지 각각 한 문장씩 친절하게 설명해줘. 형식: 강좌명: 이유\n강좌들: ${names}`
      )
      reasons = result.response.text().trim().split('\n').filter(Boolean)
    } catch {
      // Gemini 실패 시 기본 사유 사용
    }

    const results = top3.map((lecture, i) => {
      let reason = '학생의 미래 역량을 키워줄 좋은 강좌입니다.'
      for (const line of reasons) {
        if (lecture.강좌명 && line.includes(lecture.강좌명) && line.includes(':')) {
          reason = line.split(':', 2)[1]?.trim() ?? reason
          break
        }
      }
      const feeInfo = (String(lecture.수강료) + String(lecture.강좌내용)).toLowerCase()
      return {
        ...lecture,
        rank: i + 1,
        reason,
        is_external: lecture.구 !== district,
        is_free: feeInfo.includes('무료') || lecture.수강료 === '0',
      }
    })

    return NextResponse.json({ results, vuln: vulRow })
  } catch (error) {
    console.error('Recommendation error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
