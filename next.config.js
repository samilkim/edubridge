/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // CSV 파일들이 Vercel 배포에 포함되도록 설정
    outputFileTracingIncludes: {
      '/api/**': [
        './gg_digital_lectures_v2.csv',
        './gg_district_vulnerability_v7_final.csv',
        './suwon_schools_vulnerability_v2.csv',
      ],
    },
  },
}

module.exports = nextConfig
