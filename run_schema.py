#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import urllib.request
import urllib.error

MGMT_TOKEN = "sbp_0a8de78ec7effcf4cf77f78a215c0e7d05d48aa5"
PROJECT_REF = "yydykbvntpmylglpjzwp"
URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

def run_sql(sql, label=""):
    headers = {
        "Authorization": f"Bearer {MGMT_TOKEN}",
        "Content-Type": "application/json",
    }
    data = json.dumps({"query": sql}).encode("utf-8")
    req = urllib.request.Request(URL, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            result = resp.read().decode("utf-8")
            print(f"  OK  {label or sql[:60]}")
            return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            msg = json.loads(body).get("message", body)
        except Exception:
            msg = body
        if "already exists" in msg:
            print(f"  SKIP (already exists): {label or sql[:60]}")
            return True
        print(f"  ERROR [{label}]: {msg}")
        return False

print("=== 테이블 생성 ===")
run_sql("""
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
)""", "profiles")

run_sql("""
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
)""", "bus_reservations")

run_sql("""
CREATE TABLE IF NOT EXISTS saved_courses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_name text NOT NULL,
  institution text DEFAULT '',
  location text DEFAULT '',
  homepage_url text DEFAULT '',
  saved_at timestamptz DEFAULT now()
)""", "saved_courses")

print("\n=== 테이블 확인 ===")
run_sql("""
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY table_name
""", "list tables")

print("\n=== RLS 활성화 ===")
for tbl in ["profiles", "bus_reservations", "saved_courses"]:
    run_sql(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY", f"RLS {tbl}")

print("\n=== RLS 정책 생성 ===")
policies = [
    ("profiles", 'SELECT', 'auth.uid() = id', None, 'profiles_select'),
    ("profiles", 'INSERT', None, 'auth.uid() = id', 'profiles_insert'),
    ("profiles", 'UPDATE', 'auth.uid() = id', None, 'profiles_update'),
    ("bus_reservations", 'ALL', 'auth.uid() = user_id', None, 'bus_all'),
    ("saved_courses", 'ALL', 'auth.uid() = user_id', None, 'courses_all'),
]
for tbl, cmd, using, check, name in policies:
    using_clause = f"USING ({using})" if using else ""
    check_clause = f"WITH CHECK ({check})" if check else ""
    run_sql(
        f'CREATE POLICY "{name}" ON {tbl} FOR {cmd} {using_clause} {check_clause}',
        f"policy {name}"
    )

print("\n=== 이메일 확인 비활성화 ===")
# Management API로 auth 설정 변경
import urllib.parse
auth_data = json.dumps({
    "MAILER_AUTOCONFIRM": True,
    "MAILER_SECURE_EMAIL_CHANGE_ENABLED": False,
}).encode("utf-8")
headers = {
    "Authorization": f"Bearer {MGMT_TOKEN}",
    "Content-Type": "application/json",
}
req = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth",
    data=auth_data, headers=headers, method="PATCH"
)
try:
    with urllib.request.urlopen(req) as resp:
        print("  OK  이메일 자동 확인 활성화 (이메일 인증 없이 가입 가능)")
except urllib.error.HTTPError as e:
    print(f"  WARN auth config: {e.read().decode()[:100]}")

print("\n완료!")
