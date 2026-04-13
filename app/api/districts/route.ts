import { NextResponse } from 'next/server'
import { getDistricts } from '@/lib/data'

export async function GET() {
  const districts = getDistricts()
  return NextResponse.json(districts)
}
