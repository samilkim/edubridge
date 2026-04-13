import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'

export interface District {
  시군명: string
  구: string
  인프라_취약_지수: number
  경제_취약_지수: number
  최종_취약지수: number
}

export interface Lecture {
  강좌명: string
  강좌내용: string
  운영기관명: string
  교육장도로명주소: string
  홈페이지주소: string
  수강료: string
  시군명: string
  구: string
  search_text?: string
}

function loadCSV<T>(filename: string): T[] {
  try {
    const filePath = path.join(process.cwd(), filename)
    const content = fs.readFileSync(filePath, 'utf8')
    const result = Papa.parse<T>(content, { header: true, skipEmptyLines: true })
    return result.data
  } catch (e) {
    console.error(`Failed to load ${filename}:`, e)
    return []
  }
}

// 서버 사이드 캐시 (API 라우트 재호출 시 파일 재읽기 방지)
let _districts: District[] | null = null
let _lectures: Lecture[] | null = null

export function getDistricts(): District[] {
  if (!_districts) {
    const raw = loadCSV<Record<string, string>>('gg_district_vulnerability_v7_final.csv')
    _districts = raw.map(d => ({
      시군명: d['시군명']?.trim() ?? '',
      구: d['구']?.trim() ?? '',
      인프라_취약_지수: Number(d['인프라_취약_지수'] ?? 0),
      경제_취약_지수: Number(d['경제_취약_지수'] ?? 0),
      최종_취약지수: Number(d['최종_취약지수'] ?? 0),
    }))
  }
  return _districts
}

export function getLectures(): Lecture[] {
  if (!_lectures) {
    const raw = loadCSV<Record<string, string>>('gg_digital_lectures_v2.csv')
    _lectures = raw.map(l => ({
      강좌명: l['강좌명'] ?? '',
      강좌내용: l['강좌내용'] ?? '',
      운영기관명: l['운영기관명'] ?? '',
      교육장도로명주소: l['교육장도로명주소'] ?? '',
      홈페이지주소: l['홈페이지주소'] ?? '',
      수강료: l['수강료'] ?? '',
      시군명: l['시군명']?.trim() ?? '',
      구: l['구']?.trim() ?? '',
      search_text: ((l['강좌명'] ?? '') + ' ' + (l['강좌내용'] ?? '')).toLowerCase(),
    }))
  }
  return _lectures
}
