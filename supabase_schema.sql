-- ======================================================
-- EduBridge Supabase 스키마 v2
-- ======================================================

-- 1. 사용자 프로필
CREATE TABLE IF NOT EXISTS profiles (
  id        uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username  text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT '',
  phone     text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- full_name, phone 컬럼 없으면 추가 (기존 테이블 마이그레이션)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone     text NOT NULL DEFAULT '';

-- 2. 똑버스 예약
CREATE TABLE IF NOT EXISTS bus_reservations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_name    text NOT NULL,
  from_location   text NOT NULL,
  to_location     text NOT NULL,
  reserved_date   date NOT NULL,
  reserved_time   time NOT NULL,
  course_name     text DEFAULT '',
  voucher_eligible boolean DEFAULT false,
  use_voucher     boolean DEFAULT false,
  voucher_code    text DEFAULT '',
  status          text DEFAULT 'confirmed',
  created_at      timestamptz DEFAULT now()
);

-- 3. 저장한 강좌
CREATE TABLE IF NOT EXISTS saved_courses (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_name  text NOT NULL,
  institution  text DEFAULT '',
  location     text DEFAULT '',
  homepage_url text DEFAULT '',
  saved_at     timestamptz DEFAULT now()
);

-- ── RLS 활성화 ──
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_courses    ENABLE ROW LEVEL SECURITY;

-- ── profiles 정책 ──
DO $$ BEGIN
  CREATE POLICY "본인 프로필 조회" ON profiles FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "본인 프로필 생성" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "본인 프로필 수정" ON profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── bus_reservations 정책 ──
DO $$ BEGIN
  CREATE POLICY "본인 예약 전체 관리" ON bus_reservations FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── saved_courses 정책 ──
DO $$ BEGIN
  CREATE POLICY "본인 강좌 전체 관리" ON saved_courses FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
