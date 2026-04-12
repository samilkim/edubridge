import streamlit as st
import pandas as pd
import google.generativeai as genai
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# --- [1] 서비스 설정 및 CSS 디자인 ---
st.set_page_config(page_title="에듀브릿지: 경기도 AI 강좌 매칭", layout="wide")

st.markdown("""
    <style>
    .stApp { background-color: #F0F4F8 !important; }
    .main-container {
        background-color: white;
        padding: 40px;
        border-radius: 25px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        margin-bottom: 40px;
    }
    .main-title {
        font-size: 3.2rem !important;
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
        border-radius: 20px;
        padding: 25px;
        transition: all 0.3s ease;
        height: 100%;
        margin-bottom: 15px;
    }
    .lecture-card:hover {
        transform: translateY(-10px);
        box-shadow: 0 20px 25px rgba(0,0,0,0.1);
        border-color: #3B82F6;
    }
    .location-badge {
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 5px;
        margin-left: 5px;
    }
    .free-badge {
        background-color: #DCFCE7;
        color: #166534;
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 5px;
        font-weight: bold;
        margin-left: 5px;
    }
    </style>
    """, unsafe_allow_html=True)

# --- [2] 모델 자동 선택 로직 ---
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

# --- [3] 데이터 로드 및 인접 지역 매핑 ---
@st.cache_data
def load_data():
    try:
        df_lec = pd.read_csv('gg_digital_lectures_v2.csv') 
        df_vul = pd.read_csv('gg_district_vulnerability_v7_final.csv')
        df_lec['시군명'] = df_lec['시군명'].str.strip()
        df_vul['시군명'] = df_vul['시군명'].str.strip()
        return df_lec, df_vul
    except:
        st.error("데이터 파일을 찾을 수 없습니다.")
        st.stop()

df_lectures, df_vulnerability = load_data()

# 지리적 인접 시/군 매핑
NEIGHBOR_MAP = {
    "연천군": ["동두천시", "포천시", "파주시", "양주시"],
    "가평군": ["포천시", "남양주시", "양평군"],
    "양평군": ["가평군", "여주시", "남양주시", "광주시"],
    "여주시": ["양평군", "이천시", "광주시"],
    "포천시": ["연천군", "가평군", "동두천시", "양주시"],
    "동두천시": ["연천군", "양주시", "포천시"],
    "양주시": ["의정부시", "동두천시", "고양시", "파주시", "연천군", "포천시"],
    "안성시": ["평택시", "용인시", "이천시"]
}

# --- [4] 화면 UI 구성 ---
st.markdown('<p class="main-title">🛡️ 모두의 교육을 위한 디지털 교육 연결다리 🛡️</p>', unsafe_allow_html=True)
st.markdown('<p style="text-align:center; color:#64748B; font-size:1.1rem; margin-bottom:30px;">경기도 디지털 교육 격차 해소를 위한 AI 맞춤형 매칭 시스템</p>', unsafe_allow_html=True)

st.markdown('<div class="main-container">', unsafe_allow_html=True)

with st.sidebar:
    st.header("📍 나의 거주 지역")
    city_list = sorted(df_vulnerability['시군명'].unique())
    selected_city = st.selectbox("시/군 선택", city_list)
    district_list = sorted(df_vulnerability[df_vulnerability['시군명'] == selected_city]['구'].unique())
    selected_district = st.selectbox("상세 구 선택", district_list)
    
    vul_row = df_vulnerability[(df_vulnerability['시군명'] == selected_city) & (df_vulnerability['구'] == selected_district)].iloc[0]
    
    st.divider()
    st.header("🤖 디지털 진로 고민")
    user_query = st.text_area("배우고 싶은 미래 기술은?", placeholder="예: 코딩으로 나만의 웹사이트 만들기")
    search_button = st.button("✨ 맞춤 강좌 찾기", use_container_width=True, type="primary")

# --- [5] 추천 로직 (학생 맞춤형 고도화) ---
if not search_button:
    col1, col2 = st.columns([1, 2])
    with col1: st.markdown('<div style="font-size:120px; text-align:center;">🚀</div>', unsafe_allow_html=True)
    with col2:
        st.markdown(f"## 안녕하세요! 👋\n현재 **{selected_city} {selected_district}** 주민을 위한 데이터를 분석할 준비가 되었습니다. 왼쪽 사이드바에 고민을 입력해 주세요.")
else:
    if not user_query.strip():
        st.warning("고민을 입력해주세요.")
    else:
        with st.spinner('AI 코치가 학생용 최적 강좌를 분석 중입니다...'):
            try:
                # 1. 학생 맞춤형 키워드 확장
                student_prompt = f"사용자 질문: '{user_query}'. 이 질문을 바탕으로 '청소년 및 학생'에게 적합한 디지털 기술 키워드 3개만 쉼표로 나열해줘."
                kw_res = model.generate_content(student_prompt)
                ai_keywords = kw_res.text.strip() if kw_res.parts else user_query
                
                # 2. 유사도 계산
                df_lectures['search_text'] = (df_lectures['강좌명'].fillna('') + " " + df_lectures['강좌내용'].fillna(''))
                tfidf = TfidfVectorizer()
                tfidf_matrix = tfidf.fit_transform(df_lectures['search_text'])
                query_vec = tfidf.transform([ai_keywords])
                cos_sim = cosine_similarity(query_vec, tfidf_matrix).flatten()
                
                # 3. 개선된 점수 산출 로직 (50:30:20 + 10 + 타겟 필터링)
                def score_func(idx):
                    row = df_lectures.iloc[idx]
                    content_text = (str(row['강좌명']) + " " + str(row['강좌내용'])).lower()
                    
                    # (A) 내용 유사도 (50점)
                    sim_score = cos_sim[idx] * 50 
                    
                    # (B) 지리적 접근성 (30점)
                    region_score = 0
                    if row['구'] == selected_district:
                        region_score = 30
                    elif selected_city in NEIGHBOR_MAP and row['시군명'] in NEIGHBOR_MAP[selected_city]:
                        region_score = 20
                    elif row['시군명'] == selected_city:
                        region_score = 15
                    
                    # (C) 교육 취약 지수 보너스 (20점)
                    vul_score = (vul_row['최종_취약지수'] / 100) * 20
                    
                    # (D) 무료 강좌 가산점 (10점)
                    is_free = False
                    if '수강료' in row:
                        val = str(row['수강료'])
                        if val == '0' or '무료' in val: is_free = True
                    free_bonus = 10 if is_free else 0

                    # (E) 학생 대상 필터링 점수
                    target_score = 0
                    if any(word in content_text for word in ['학생', '청소년', '초등', '중등', '고등', '진로']):
                        target_score += 15  # 학생용 가점
                    if any(word in content_text for word in ['시니어', '어르신', '실버', '노인']):
                        target_score -= 40  # 시니어용 강력 감점

                    return sim_score + region_score + vul_score + free_bonus + target_score

                df_lectures['total_score'] = [score_func(i) for i in range(len(df_lectures))]
                top_results = df_lectures[df_lectures['total_score'] > 0].sort_values('total_score', ascending=False).head(3)
                
                if len(top_results) == 0:
                    st.info("📍 학생에게 적합한 강좌를 찾지 못했습니다. 키워드를 바꿔보세요.")
                else:
                    st.markdown(f'### 🎯 "{ai_keywords}" 기반 추천 결과')
                    
                    lec_list_str = "\n".join([f"- {name}" for name in top_results['강좌명']])
                    combined_prompt = f"질문: {user_query}. 다음 강좌들이 학생에게 왜 좋은지 각각 한 문장씩 추천해줘: {lec_list_str}"
                    reason_res = model.generate_content(combined_prompt)
                    reason_lines = reason_res.text.strip().split('\n') if reason_res.parts else []

                    cols = st.columns(3)
                    for i, (idx, row) in enumerate(top_results.iterrows()):
                        is_nearby = row['시군명'] != selected_city
                        badge_html = f'<span style="background:#FEF3C7; color:#92400E;" class="location-badge">인근지역</span>' if is_nearby else ""
                        
                        is_free = False
                        if '수강료' in row:
                            val = str(row['수강료'])
                            if val == '0' or '무료' in val: is_free = True
                        free_badge_html = f'<span class="free-badge">무료</span>' if is_free else ""

                        with cols[i]:
                            st.markdown(f"""
                                <div class="lecture-card">
                                    <span style="background:#DBEAFE; color:#1E40AF; padding:5px 12px; border-radius:20px; font-size:0.8rem; font-weight:bold;">추천 {i+1} {badge_html} {free_badge_html}</span>
                                    <div style="font-size:1.15rem; font-weight:800; margin:15px 0; color:#0F172A; min-height:3.2em; line-height:1.4;">{row['강좌명']}</div>
                                    <p style="font-size:0.9rem; color:#475569; line-height:1.6; margin-bottom:15px;">💻 {row['운영기관명']}</p>
                                    <div style="font-size:0.85rem; color:#1E40AF; font-weight:600;">📍 {row['시군명']} {row['구']}</div>
                                </div>
                            """, unsafe_allow_html=True)
                            if pd.notna(row['홈페이지주소']):
                                st.link_button("🚀 상세 정보 및 신청", str(row['홈페이지주소']), use_container_width=True)

            except Exception as e:
                st.error(f"오류가 발생했습니다: {e}")

# --- [6] 하단 데이터 대시보드 ---
st.markdown('<br><hr style="border:0; height:1px; background:#E2E8F0;"><br>', unsafe_allow_html=True)
st.markdown(f'<h4>📊 {selected_city} {selected_district} 지역 데이터 요약</h4>', unsafe_allow_html=True)
m1, m2, m3 = st.columns(3)
m1.metric("미래역량 소외", f"{vul_row['인프라_취약_지수']:.1f}")
m2.metric("경제 취약", f"{vul_row['경제_취약_지수']:.1f}")
m3.metric("종합 소외", f"{vul_row['최종_취약지수']:.1f}", delta=f"{vul_row['최종_취약지수']-50:.1f}", delta_color="inverse")

st.markdown('</div>', unsafe_allow_html=True)