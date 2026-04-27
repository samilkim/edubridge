import { NextRequest, NextResponse } from 'next/server'
import { getLectures, getDistricts } from '@/lib/data'
import { GoogleGenerativeAI } from '@google/generative-ai'

// 인접 지역 맵
const NEIGHBOR_MAP: Record<string, string[]> = {
  연천군: ['동두천시', '포천시', '파주시', '양주시'],
  가평군: ['포천시', '남양주시', '양평군', '춘천시'],
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
  남양주시: ['가평군', '양평군', '구리시', '하남시'],
  구리시: ['남양주시', '하남시', '성남시'],
  하남시: ['남양주시', '구리시', '성남시', '광주시'],
  광주시: ['하남시', '성남시', '용인시', '여주시', '양평군'],
  성남시: ['구리시', '하남시', '광주시', '용인시', '의왕시'],
  의왕시: ['수원시', '성남시', '군포시', '안양시'],
  군포시: ['수원시', '안산시', '의왕시', '안양시'],
  안양시: ['의왕시', '군포시', '과천시', '광명시'],
  과천시: ['안양시', '성남시'],
  광명시: ['시흥시', '안양시'],
  부천시: ['시흥시', '광명시'],
  고양시: ['양주시', '파주시'],
  파주시: ['연천군', '양주시', '고양시'],
  의정부시: ['양주시', '남양주시'],
  이천시: ['여주시', '안성시', '용인시'],
}

function isNeighbor(city1: string, city2: string): boolean {
  return (
    NEIGHBOR_MAP[city1]?.includes(city2) ||
    NEIGHBOR_MAP[city2]?.includes(city1) ||
    false
  )
}

// ─── TF-IDF 코사인 유사도 ───────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s,.\-()[\]]+/).filter(w => w.length >= 2)
}

/** IDF 계산: log(N / df) */
function buildIDF(docs: string[][]): Map<string, number> {
  const N = docs.length
  const df = new Map<string, number>()
  for (const tokens of docs) {
    for (const term of new Set(tokens)) {
      df.set(term, (df.get(term) ?? 0) + 1)
    }
  }
  const idf = new Map<string, number>()
  for (const [term, count] of df) {
    idf.set(term, Math.log(N / count + 1))
  }
  return idf
}

/** TF-IDF 벡터 계산 */
function tfidfVector(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = new Map<string, number>()
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
  const vec = new Map<string, number>()
  for (const [term, count] of tf) {
    vec.set(term, (count / tokens.length) * (idf.get(term) ?? 1))
  }
  return vec
}

/** 코사인 유사도 */
function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, normA = 0, normB = 0
  for (const [t, v] of a) { dot += v * (b.get(t) ?? 0); normA += v * v }
  for (const [, v] of b) normB += v * v
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // 입력 검증 및 정제
    const query: string = typeof body.query === 'string'
      ? body.query.replace(/[<>"'`\\]/g, '').trim().slice(0, 200)
      : ''
    const city: string = typeof body.city === 'string' ? body.city.trim().slice(0, 50) : ''
    const district: string = typeof body.district === 'string' ? body.district.trim().slice(0, 50) : ''

    if (!query || !city || !district) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }

    const lectures = getLectures()
    const districts = getDistricts()

    console.log(`[recommend] city=${city}, district=${district}, query=${query}, total=${lectures.length}`)

    const vulRow = districts.find(d => d.시군명 === city && d.구 === district)
    if (!vulRow) {
      return NextResponse.json({ error: '지역 정보를 찾을 수 없습니다.' }, { status: 400 })
    }

    // 1단계: 학생 강좌 필터링 (성인/학부모 강좌 제외)
    const studentKeywords = ['학생', '청소년', '중등', '고등', '학교', '청년', '방과후']
    const adultExcludeKeywords = ['학부모', '부모님', '초등', '어린이', '학부형', '시니어', '어르신', '중장년', '노인', '어머니', '아버지', '성인반', '성인 대상', '학부모님']
    let filtered = lectures.filter(l => {
      const text = l.search_text ?? ''
      const hasStudentKW = studentKeywords.some(kw => text.includes(kw))
      const hasAdultKW = adultExcludeKeywords.some(kw => text.includes(kw))
      return hasStudentKW && !hasAdultKW
    })
    if (filtered.length < 5) filtered = lectures.filter(l => {
      // 성인 제외 키워드는 유지하되 학생 키워드 조건만 완화
      const text = l.search_text ?? ''
      return !adultExcludeKeywords.some(kw => text.includes(kw))
    })
    if (filtered.length < 5) filtered = lectures

    // 강좌명 기준 중복 제거 (동일 강좌명 중 첫 번째만 유지)
    const seenNames = new Set<string>()
    filtered = filtered.filter(l => {
      const name = (l.강좌명 ?? '').trim()
      if (seenNames.has(name)) return false
      seenNames.add(name)
      return true
    })
    console.log(`[recommend] filtered(dedup)=${filtered.length}`)

    // 2단계: Gemini 키워드 확장
    let queryExpanded = query
    let geminiWorking = false
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
      const kwRes = await model.generateContent(
        `질문: '${query}'. 이와 관련된 학생용 디지털 기술 키워드 3개만 쉼표로 답해줘. 다른 말은 하지 마.`
      )
      const aiKW = kwRes.response.text().trim()
      queryExpanded = query + ' ' + aiKW
      geminiWorking = true
      console.log(`[recommend] Gemini keywords: ${aiKW}`)
    } catch (e) {
      console.error('[recommend] Gemini keyword expansion failed:', e)
    }

    // 3단계: TF-IDF 코사인 유사도 계산 (원본 로직 재현)
    const corpus = filtered.map(l => l.search_text ?? '')
    const tokenizedCorpus = corpus.map(tokenize)
    const idf = buildIDF(tokenizedCorpus)

    const queryVec = tfidfVector(tokenize(queryExpanded), idf)

    // 4단계: 원본 점수 공식 적용
    // 코사인 유사도 50점 + 지역 30점 + 취약지수 20점 + 무료 보너스 10점
    const vulScore = (vulRow.최종_취약지수 / 100) * 20

    const scored = filtered.map((lecture, i) => {
      const docVec = tfidfVector(tokenizedCorpus[i], idf)
      const sim = cosine(queryVec, docVec)
      const simScore = sim * 50

      // 지역 점수: 같은 구=30, 같은 시군=25, 인접 시군=20, 기타=0
      let regScore = 0
      if (lecture.구 === district) {
        regScore = 30
      } else if (lecture.시군명 === city) {
        regScore = 25
      } else if (isNeighbor(city, lecture.시군명 ?? '')) {
        regScore = 20
      }

      const feeInfo = (String(lecture.수강료 ?? '') + String(lecture.강좌내용 ?? '')).toLowerCase()
      const isFree = feeInfo.includes('무료') || lecture.수강료 === '0'
      const feeBonus = isFree ? 10 : 0

      const totalScore = simScore + regScore + vulScore + feeBonus

      return { ...lecture, totalScore, simScore, regScore, vulScore, feeBonus, isFree }
    })

    // 지리 우선순위 풀로 분리 (같은 구 → 같은 시군 → 인접 시군 → 기타)
    // 각 풀 내에서는 totalScore 내림차순
    const poolSameDistrict = scored.filter(l => l.구 === district)
      .sort((a, b) => b.totalScore - a.totalScore)
    const poolSameCity = scored.filter(l => l.시군명 === city && l.구 !== district)
      .sort((a, b) => b.totalScore - a.totalScore)
    const poolNeighbor = scored.filter(l => l.시군명 !== city && isNeighbor(city, l.시군명 ?? ''))
      .sort((a, b) => b.totalScore - a.totalScore)
    const poolOthers = scored.filter(l => l.시군명 !== city && !isNeighbor(city, l.시군명 ?? ''))
      .sort((a, b) => b.totalScore - a.totalScore)

    console.log(`[recommend] pools - sameDistrict:${poolSameDistrict.length}, sameCity:${poolSameCity.length}, neighbor:${poolNeighbor.length}, others:${poolOthers.length}`)

    // 가까운 풀부터 채우되, 강좌명 중복 및 도시 편중 방지
    const top3: typeof scored = []
    const cityCount: Record<string, number> = {}
    const usedNames = new Set<string>()

    for (const pool of [poolSameDistrict, poolSameCity, poolNeighbor, poolOthers]) {
      for (const item of pool) {
        if (top3.length >= 3) break
        const itemName = (item.강좌명 ?? '').trim()
        const itemCity = item.시군명 ?? ''
        const count = cityCount[itemCity] ?? 0
        const maxPerCity = pool === poolOthers ? 1 : 3
        // 강좌명 중복 제거 + 도시 편중 방지
        if (!usedNames.has(itemName) && count < maxPerCity) {
          top3.push(item)
          cityCount[itemCity] = count + 1
          usedNames.add(itemName)
        }
      }
      if (top3.length >= 3) break
    }

    // 3개 미만이면 제한 완화해서 채우기
    if (top3.length < 3) {
      for (const pool of [poolSameDistrict, poolSameCity, poolNeighbor, poolOthers]) {
        for (const item of pool) {
          if (top3.length >= 3) break
          const itemName = (item.강좌명 ?? '').trim()
          if (!usedNames.has(itemName)) {
            top3.push(item)
            usedNames.add(itemName)
          }
        }
        if (top3.length >= 3) break
      }
    }

    console.log(`[recommend] top3: ${top3.map(l => `${l.강좌명?.slice(0, 15)}(${l.시군명}, 총${l.totalScore.toFixed(1)}=sim${l.simScore.toFixed(1)}+reg${l.regScore})`).join(' | ')}`)

    // 5단계: Gemini 추천 사유 생성 (1회 호출)
    const reasons: string[] = []
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
      const lectureList = top3.map((l, i) => {
        const name = l.강좌명 ?? '강좌'
        const content = String(l.강좌내용 ?? '').slice(0, 150)
        const cityInfo = l.시군명 !== city ? ` [${l.시군명} 위치]` : ''
        return `${i + 1}. ${name}${cityInfo}: ${content}`
      }).join('\n')

      const result = await model.generateContent(
        `학생 질문: "${query}"

추천 강좌 목록:
${lectureList}

위 강좌들이 학생 질문에 왜 도움이 되는지 각각 다르게 한 문장씩 설명해줘.
형식 (반드시 지켜줘):
1: [이유]
2: [이유]
3: [이유]
다른 말은 하지 마.`
      )
      const text = result.response.text().trim()
      console.log(`[recommend] reasons: ${text.slice(0, 200)}`)
      geminiWorking = true

      const lines = text.split('\n').filter(Boolean)
      for (let i = 0; i < top3.length; i++) {
        const match = lines.find(l => l.startsWith(`${i + 1}:`))
        reasons.push(match ? match.replace(/^\d+:\s*/, '').trim() : '')
      }
    } catch (e) {
      console.error('[recommend] Gemini reasons failed:', e)
    }

    const results = top3.map((lecture, i) => {
      const lectureName = lecture.강좌명 ?? '이 강좌'
      const cityInfo = lecture.시군명 !== city ? ` (${lecture.시군명} 위치)` : ''
      const defaultReason = `${lectureName}${cityInfo}는 "${query}"와 관련된 디지털 역량을 키울 수 있는 강좌입니다.`
      return {
        ...lecture,
        rank: i + 1,
        reason: reasons[i] || defaultReason,
        is_external: lecture.시군명 !== city,
        is_free: lecture.isFree,
        score_detail: {
          sim: lecture.simScore.toFixed(1),
          region: lecture.regScore,
          vuln: lecture.vulScore.toFixed(1),
          free: lecture.feeBonus,
          total: lecture.totalScore.toFixed(1),
        },
      }
    })

    return NextResponse.json({ results, vuln: vulRow, geminiWorking })
  } catch (error) {
    console.error('[recommend] Error:', error)
    return NextResponse.json({ error: '추천 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
