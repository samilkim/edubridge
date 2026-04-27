import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY not set' })
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
    const result = await model.generateContent('안녕하세요. "OK"라고만 답해주세요.')
    const text = result.response.text().trim()
    return NextResponse.json({ ok: true, response: text, keyPrefix: apiKey.slice(0, 8) + '...' })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) })
  }
}
