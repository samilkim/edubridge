-- ======================================================
-- EduBridge Supabase 스키마
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ======================================================

-- 1. 사용자 프로필 (아이디 저장)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. 똑버스 예약
CREATE TABLE IF NOT EXISTS bus_reservations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_name text NOT NULL,
  from_location text NOT NULL,
  to_location text NOT NULL,
  reserved_date date NOT NULL,
  reserved_time time NOT NULL,
  course_name text DEFAULT '',
  voucher_eligible boolean DEFAULT false,
  status text DEFAULT 'confirmed',
  created_at timestamptz DEFAULT now()
);

-- 3. 저장한 강좌
CREATE TABLE IF NOT EXISTS saved_courses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_name text NOT NULL,
  institution text DEFAULT '',
  location text DEFAULT '',
  homepage_url text DEFAULT '',
  saved_at timestamptz DEFAULT now()
);

-- ── RLS 활성화 ──
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_courses ENABLE ROW LEVEL SECURITY;

-- ── profiles 정책 ──
CREATE POLICY "본인 프로필 조회" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "본인 프로필 생성" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "본인 프로필 수정" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ── bus_reservations 정책 ──
CREATE POLICY "본인 예약 전체 관리" ON bus_reservations
  FOR ALL USING (auth.uid() = user_id);

-- ── saved_courses 정책 ──
CREATE POLICY "본인 강좌 전체 관리" ON saved_courses
  FOR ALL USING (auth.uid() = user_id);

-- ── Supabase Auth 이메일 확인 비활성화 ──
-- Dashboard > Authentication > Providers > Email 에서
-- "Confirm email" 옵션을 OFF 로 설정해주세요.
-- (edubridge.local 이메일은 실제 이메일이 아니므로)
