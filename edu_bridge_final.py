import streamlit as st
import pandas as pd
import google.generativeai as genai
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from datetime import datetime, timedelta

# --- [1] 서비스 설정 및 디자인 ---
st.set_page_config(page_title="에듀브릿지: 경기도 AI 강좌 & 똑버스 매칭", layout="wide")

st.markdown("""
    <style>
    .stApp { background-color: #F8FAFC !important; }
    
    .main-title {
        font-size: 2.8rem !important;
        font-weight: 900 !important;
        background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-align: center;
        margin-bottom: 5px;
    }

    .lecture-card {
        background-color: #ffffff;
        border: 1px solid #E2E8F0;
        border-radius: 16px;
        padding: 20px;
        height: 100%;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        margin-bottom: 15px;
        transition: transform 0.2s;
    }
    
    .lecture-card:hover {
        transform: translateY(-5px);
    }
    
    .free-badge {
        background-color: #DCFCE7;
        color: #166534;
        font-size: 0.75rem;
        padding: 3px 10px;
        border-radius: 20px;
        font-weight: bold;
        float: right;
    }
    </style>
    """, unsafe_allow_html=True)

# --- [2] 모델 및 데이터 로드 로직 ---
@st.cache_resource
def get_best_model():
    try:
        api_key = st.secrets["GEMINI_API_KEY"]
        genai.configure(api_key=api_key)
        available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        for m_path in ['models/gemini-1.5-flash', 'models/gemini-1.5-flash-latest', 'models/gemini-pro']:
            if m_path in available_models:
                return genai.GenerativeModel(m_path)
        return genai.GenerativeModel(available_models[0]) if available_models else None
    except: return None

model = get_best_model()

@st.cache_data
def load_data():
    try:
        # 파일명은 사용자의 환경에 맞게 조정 가능
        df_lec = pd.read_csv('gg_digital_lectures_v2.csv') 
        df_vul = pd.read_csv('gg_district_vulnerability_v7_final.csv')
        df_lec['시군명'] = df_lec['시군명'].str.strip()
        df_vul['시군명'] = df_vul['시군명'].str.strip()
        # 검색용 텍스트 미리 병합
        df_lec['search_text'] = (df_lec['강좌명'].fillna('') + " " + df_lec['강좌내용'].fillna('')).str.lower()
        return df_lec, df_vul
    except:
        st.error("데이터 파일을 찾을 수 없습니다. CSV 파일들을 확인해주세요.")
        st.stop()

df_lectures, df_vulnerability = load_data()

# 지리적 인접 매핑
NEIGHBOR_MAP = {
    "연천군": ["동두천시", "포천시", "파주시", "양주시"], "가평군": ["포천시", "남양주시", "양평군"],
    "양평군": ["가평군", "여주시", "남양주시", "광주시"], "여주시": ["양평군", "이천시", "광주시"],
    "포천시": ["연천군", "가평군", "동두천시", "양주시"], "동두천시": ["연천군", "양주시", "포천시"],
    "양주시": ["의정부시", "동두천시", "고양시", "파주시", "연천군", "포천시"],
    "안성시": ["평택시", "용인시", "이천시"], "수원시": ["화성시", "용인시", "안산시", "의왕시"]
}

# --- [3] 사이드바 UI ---
st.markdown('<p class="main-title">🛡️ 에듀브릿지: 모두를 위한 디지털 연결다리</p>', unsafe_allow_html=True)
st.markdown('<p style="text-align:center; color:#64748B; font-size:1.1rem; margin-bottom:30px;">디지털 교육을 위한 AI 강좌 추천 시스템</p>', unsafe_allow_html=True)

with st.sidebar:
    st.header("📍 나의 거주 지역")
    city_list = sorted(df_vulnerability['시군명'].unique())
    selected_city = st.selectbox("시/군 선택", city_list)
    district_list = sorted(df_vulnerability[df_vulnerability['시군명'] == selected_city]['구'].unique())
    selected_district = st.selectbox("상세 구 선택", district_list)
    
    vul_row = df_vulnerability[(df_vulnerability['시군명'] == selected_city) & (df_vulnerability['구'] == selected_district)].iloc[0]
    
    st.divider()
    st.header("🤖 디지털 진로 고민")
    user_query = st.text_area("배우고 싶은 기술이나 고민은?", placeholder="예: 파이썬으로 게임이나 인공지능을 만들고 싶어요.")
    search_button = st.button("✨ 학생 맞춤 강좌 찾기", use_container_width=True, type="primary")

# --- [4] 핵심 알고리즘 및 결과 출력 ---
if search_button:
    if not user_query.strip():
        st.warning("고민을 입력해주세요.")
    else:
        with st.spinner('학생 맞춤형 강좌와 이동 수단을 분석 중입니다...'):
            try:
                # [알고리즘 1] 필터링: 학생 타깃 강좌 우선 추출
                student_keywords = ['학생', '청소년', '초등', '중등', '고등', '어린이', '꿈나무', '학교']
                df_filtered = df_lectures[df_lectures['search_text'].str.contains('|'.join(student_keywords), na=False)].copy()
                
                if len(df_filtered) < 5:  # 필터 결과가 너무 적으면 전체로 확장
                    df_filtered = df_lectures.copy()

                # [알고리즘 2] 키워드 확장 (Gemini)
                kw_prompt = f"질문: '{user_query}'. 이와 관련된 학생용 디지털 기술 키워드 3개만 쉼표로."
                kw_res = model.generate_content(kw_prompt)
                ai_keywords = kw_res.text.strip() if kw_res.parts else user_query

                # [알고리즘 3] 유사도 계산
                tfidf = TfidfVectorizer()
                tfidf_matrix = tfidf.fit_transform(df_filtered['search_text'])
                query_vec = tfidf.transform([ai_keywords])
                cos_sim = cosine_similarity(query_vec, tfidf_matrix).flatten()

                # [알고리즘 4] 최종 점수 산출 로직
                def score_func(idx):
                    row = df_filtered.iloc[idx]
                    # 1. 유사도 점수 (50점)
                    sim_score = cos_sim[idx] * 50
                    # 2. 지역 접근성 (30점)
                    reg_score = 30 if row['구'] == selected_district else (20 if selected_city in NEIGHBOR_MAP and row['시군명'] in NEIGHBOR_MAP[selected_city] else 0)
                    # 3. 취약지수 반영 (20점)
                    vul_score = (vul_row['최종_취약지수'] / 100) * 20
                    # 4. [보너스] 무료 강의 가산점 (+10점)
                    fee_info = str(row.get('수강료', '')).lower() + str(row.get('강좌내용', '')).lower()
                    fee_bonus = 10 if ('0' in fee_info or '무료' in fee_info) else 0
                    
                    return sim_score + reg_score + vul_score + fee_bonus

                df_filtered['total_score'] = [score_func(i) for i in range(len(df_filtered))]
                top_results = df_filtered.sort_values('total_score', ascending=False).head(3)

                # [알고리즘 5] 추천 사유 생성 (Gemini)
                lec_names = ", ".join(top_results['강좌명'].tolist())
                reason_prompt = f"질문: {user_query}. 다음 강좌가 학생에게 왜 좋은지 각각 한 문장씩 친절하게 추천해줘 (강좌명: 이유 형식)\n{lec_names}"
                reason_res = model.generate_content(reason_prompt)
                reason_lines = reason_res.text.strip().split('\n') if reason_res.parts else []

                # 결과 레이아웃 출력
                st.markdown(f'### 🎯 "{selected_district}" 학생을 위한 AI 추천 결과')
                cols = st.columns(3)
                
                for i, (idx, row) in enumerate(top_results.iterrows()):
                    is_external = (row['구'] != selected_district)
                    is_free = any(word in (str(row.get('수강료', '')) + str(row['강좌내용'])) for word in ['0', '무료'])
                    
                    # 추천 사유 매칭
                    display_reason = "학생의 미래 역량을 키워줄 좋은 강좌입니다."
                    for line in reason_lines:
                        if row['강좌명'] in line and ':' in line:
                            display_reason = line.split(':', 1)[-1].strip()
                            break

                    with cols[i]:
                        st.markdown(f"""
                            <div class="lecture-card">
                                {f'<span class="free-badge">FREE</span>' if is_free else ''}
                                <span style="background:#DBEAFE; color:#1E40AF; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:bold;">BEST {i+1}</span>
                                <div style="font-size:1.1rem; font-weight:800; margin:12px 0; color:#0F172A; min-height:3.2em;">{row['강좌명']}</div>
                                <p style="font-size:0.85rem; color:#475569; line-height:1.5; margin-bottom:15px;">💡 {display_reason}</p>
                                <div style="font-size:0.8rem; color:#1E40AF; font-weight:600;">📍 {row['시군명']} {row['구']}</div>
                            </div>
                        """, unsafe_allow_html=True)
                        
                        if pd.notna(row['홈페이지주소']):
                            st.link_button("🚀 상세정보 및 신청", str(row['홈페이지주소']), use_container_width=True)

                        if is_external:
                            with st.expander("🚌 거리가 걱정되나요? 똑버스 예약"):
                                with st.container(border=True):
                                    st.markdown("##### 🚌 똑버스 스마트 호출")
                                    st.caption("취약 지역 학생은 '무료 바우처' 지원 대상입니다.")
                                    u_name = st.text_input("학생 성함", key=f"un_{i}")
                                    if st.button("바우처 대상 조회", key=f"chk_{i}"):
                                        if vul_row['최종_취약지수'] > 35:
                                            st.success(f"✅ {u_name}님은 [무료 바우처] 대상입니다!")
                                        else:
                                            st.info("청소년 할인 요금이 적용됩니다.")
                                    st.text_input("출발", value=f"{selected_city} {selected_district}", key=f"start_{i}")
                                    st.text_input("도착", value=f"{row['운영기관명']}", key=f"end_{i}")
                                    if st.button("🎫 호출 확정", key=f"cfm_{i}"):
                                        st.balloons()
                                        st.success("예약이 완료되었습니다! (똑타 앱 연동)")
                        else:
                            st.info("🏠 우리 동네 강좌입니다.")

            except Exception as e:
                st.error(f"알고리즘 실행 중 오류가 발생했습니다: {e}")

# --- [5] 하단 통계 대시보드 ---
st.divider()
st.markdown(f'<h4>📊 {selected_city} {selected_district} 지역 교육 환경 요약</h4>', unsafe_allow_html=True)
m1, m2, m3 = st.columns(3)
m1.metric("인프라 취약도", f"{vul_row['인프라_취약_지수']:.1f}")
m2.metric("경제적 취약도", f"{vul_row['경제_취약_지수']:.1f}")
m3.metric("종합 소외 지수", f"{vul_row['최종_취약지수']:.1f}", delta=f"{vul_row['최종_취약지수']-50:.1f}", delta_color="inverse")