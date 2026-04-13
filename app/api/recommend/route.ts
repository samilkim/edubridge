import { NextRequest, NextResponse } from 'next/server'
import { getLectures, getDistricts } from '@/lib/data'
import { GoogleGenerativeAI } from '@google/generative-ai'

// 양방향으로 확장된 인접 지역 맵
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
  안산시: ['수원시', '화성시', '시흥시'],
  시흥시: ['안산시', '광명시', '부천시'],
  화성시: ['수원시', '안산시', '오산시', '평택시', '용인시'],
  용인시: ['수원시', '화성시', '안성시', '광주시', '이천시'],
  평택시: ['화성시', '안성시', '오산시'],
  오산시: ['수원시', '화성시', '평택시'],
}

/** 두 도시가 인접한지 양방향으로 체크 */
function isNeighbor(city1: string, city2: string): boolean {
  return (
    NEIGHBOR_MAP[city1]?.includes(city2) ||
    NEIGHBOR_MAP[city2]?.includes(city1) ||
    false
  )
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

    // 1단계: 학생 관련 강좌 필터링
    const studentKeywords = ['학생', '청소년', '초등', '중등', '고등', '어린이', '꿈나무', '학교']
    let filtered = lectures.filter(l =>
      studentKeywords.some(kw => l.search_text?.includes(kw))
    )
    if (filtered.length < 10) filtered = lectures

    // 2단계: Gemini 키워드 확장
    let aiKeywords = query
    let geminiWorking = false
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const kwResult = await model.generateContent(
        `질문: '${query}'. 이와 관련된 학생용 디지털 기술 키워드 3개만 쉼표로 답해줘. 다른 말은 하지 마.`
      )
      aiKeywords = kwResult.response.text().trim()
      geminiWorking = true
    } catch {
      // Gemini 실패 시 원본 쿼리로 진행
    }

    // 3단계: 유사도 점수 계산
    const queryWords = (query + ' ' + aiKeywords)
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean)

    const withSim = filtered.map(lecture => {
      const text = lecture.search_text ?? ''
      const matchCount = queryWords.filter(w => text.includes(w)).length
      const simScore = queryWords.length > 0 ? (matchCount / queryWords.length) * 100 : 0
      const feeInfo = (String(lecture.수강료) + String(lecture.강좌내용)).toLowerCase()
      const isFree = feeInfo.includes('무료') || lecture.수강료 === '0'
      return { ...lecture, simScore, isFree }
    })

    // 4단계: 지역 우선 순위로 3개 선택
    // 같은 구/동 → 같은 시/군 → 인접 시/군 → 기타 순으로 채움
    const sameDistrict = withSim
      .filter(l => l.시군명 === city && l.구 === district)
      .sort((a, b) => (b.simScore + (b.isFree ? 10 : 0)) - (a.simScore + (a.isFree ? 10 : 0)))

    const sameCity = withSim
      .filter(l => l.시군명 === city && l.구 !== district)
      .sort((a, b) => (b.simScore + (b.isFree ? 10 : 0)) - (a.simScore + (a.isFree ? 10 : 0)))

    const neighborCity = withSim
      .filter(l => l.시군명 !== city && isNeighbor(city, l.시군명))
      .sort((a, b) => (b.simScore + (b.isFree ? 10 : 0)) - (a.simScore + (a.isFree ? 10 : 0)))

    const others = withSim
      .filter(l => l.시군명 !== city && !isNeighbor(city, l.시군명))
      .sort((a, b) => (b.simScore + (b.isFree ? 10 : 0)) - (a.simScore + (a.isFree ? 10 : 0)))

    // 순서대로 3개 채우기
    const top3: typeof withSim = []
    for (const pool of [sameDistrict, sameCity, neighborCity, others]) {
      for (const item of pool) {
        if (top3.length >= 3) break
        top3.push(item)
      }
      if (top3.length >= 3) break
    }

    // 5단계: Gemini 추천 사유 생성
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
      return {
        ...lecture,
        rank: i + 1,
        reason,
        is_external: lecture.시군명 !== city, // 구 기준이 아닌 시/군 기준으로 변경
        is_free: lecture.isFree,
      }
    })

    return NextResponse.json({ results, vuln: vulRow, geminiWorking })
  } catch (error) {
    console.error('Recommendation error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
