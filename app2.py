import streamlit as st
import pandas as pd
import google.generativeai as genai
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# --- [1] 서비스 설정 및 강력한 CSS 적용 ---
st.set_page_config(page_title="에듀브릿지: 경기도 AI 강좌 매칭", layout="wide")

st.markdown("""
    <style>
    /* 1. 전체 앱 배경색 강제 지정 (연한 블루 그레이) */
    .stApp {
        background-color: #F0F4F8 !important; 
    }
    
    /* 2. 메인 콘텐츠 흰색 카드 영역 */
    .main-container {
        background-color: white;
        padding: 45px;
        border-radius: 25px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        margin-top: 10px;
        margin-bottom: 40px;
    }

    /* 3. 타이틀 디자인 */
    .main-title {
        font-size: 3.2rem !important;
        font-weight: 900 !important;
        background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-align: center;
        margin-bottom: 5px;
    }

    /* 4. 강좌 카드 디자인 (호버 효과) */
    .lecture-card {
        background-color: #ffffff;
        border: 1px solid #E2E8F0;
        border-radius: 20px;
        padding: 25px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.02);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        height: 100%;
        margin-bottom: 15px;
    }
    .lecture-card:hover {
        transform: translateY(-10px);
        box-shadow: 0 20px 25px rgba(0,0,0,0.1);
        border-color: #3B82F6;
    }

    /* 5. 텍스트 및 태그 스타일 */
    .welcome-header {
        color: #1E3A8A;
        font-size: 2.2rem;
        font-weight: 700;
        margin-bottom: 20px;
    }
    
    .stButton>button {
        border-radius: 12px !important;
        padding: 10px 20px !important;
        font-weight: 600 !important;
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
        preferred = ['models/gemini-1.5-flash', 'models/gemini-1.5-flash-latest', 'models/gemini-pro']
        for p in preferred:
            if p in available_models: return genai.GenerativeModel(p)
        return genai.GenerativeModel(available_models[0]) if available_models else None
    except: return None

model = get_best_model()

# --- [3] 데이터 로드 ---
@st.cache_data
def load_data():
    try:
        df_lec = pd.read_csv('gg_digital_lectures_v2.csv') 
        df_vul = pd.read_csv('gg_district_vulnerability_v5.csv')
        df_lec['시군명'] = df_lec['시군명'].str.strip()
        df_vul['시군명'] = df_vul['시군명'].str.strip()
        return df_lec, df_vul
    except:
        st.error("데이터 파일을 찾을 수 없습니다. CSV 파일이 올바른 위치에 있는지 확인해주세요.")
        st.stop()

df_lectures, df_vulnerability = load_data()

# --- [4] 화면 상단 타이틀 ---
st.markdown('<p class="main-title">🛡️ 에듀 브릿지 🛡️</p>', unsafe_allow_html=True)
st.markdown('<p style="text-align:center; color:#64748B; font-size:1.2rem; margin-bottom:30px;">경기도 디지털 교육 격차 해소를 위한 AI 맞춤형 매칭 시스템</p>', unsafe_allow_html=True)

# 메인 콘텐츠 컨테이너 시작
st.markdown('<div class="main-container">', unsafe_allow_html=True)

with st.sidebar:
    st.header("📍 지역 설정")
    city_list = sorted(df_vulnerability['시군명'].unique())
    selected_city = st.selectbox("시/군", city_list)
    district_list = sorted(df_vulnerability[df_vulnerability['시군명'] == selected_city]['구'].unique())
    selected_district = st.selectbox("상세 구", district_list)
    
    vul_row = df_vulnerability[(df_vulnerability['시군명'] == selected_city) & (df_vulnerability['구'] == selected_district)].iloc[0]
    
    st.divider()
    st.header("🤖 진로 고민")
    user_query = st.text_area("어떤 기술을 배우고 싶나요?", placeholder="예: 파이썬으로 데이터를 분석하고 싶어요.")
    search_button = st.button("✨ 맞춤 강좌 찾기", use_container_width=True, type="primary")

# --- [5] 메인 화면 분기 (검색 전/후) ---
if not search_button:
    # 검색 전 안내 화면 (이미지 대신 깨지지 않는 이모지 활용)
    col1, col2 = st.columns([1, 1.8])
    with col1:
        st.markdown("""
            <div style="display: flex; justify-content: center; align-items: center; height: 300px; background: #F8FAFC; border-radius: 20px;">
                <span style="font-size: 130px;">🚀</span>
            </div>
        """, unsafe_allow_html=True)
    with col2:
        st.markdown(f"""
            <div style="padding-left: 20px;">
                <h2 class="welcome-header">안녕하세요! 👋</h2>
                <p style="font-size: 1.25rem; color: #475569; line-height: 1.8;">
                    현재 <b>{selected_city} {selected_district}</b> 지역 주민을 위한<br>
                    맞춤형 디지털 학습 경로를 분석할 준비가 되었습니다.<br><br>
                    왼쪽 <b>[진로 고민]</b> 란에 평소 관심 있던 기술이나<br> 
                    취업 희망 분야를 입력한 후 버튼을 눌러주세요!
                </p>
                <p style="color: #94A3B8; font-size: 1rem; margin-top: 15px;">
                    💡 예시: "인공지능의 원리를 배우고 싶어요", "웹사이트를 직접 만들고 싶어요"
                </p>
            </div>
        """, unsafe_allow_html=True)
else:
    # 검색 결과 출력
    with st.spinner('AI 코치가 최적의 강좌를 분석 중입니다...'):
        try:
            # 키워드 확장
            response = model.generate_content(f"'{user_query}' 관련 디지털 기술 키워드 3개만 쉼표로.")
            ai_keywords = response.text.strip() if response.parts else user_query
            
            # 유사도 분석 로직
            df_lectures['search_text'] = (df_lectures['강좌명'].fillna('') + " " + df_lectures['강좌내용'].fillna(''))
            tfidf = TfidfVectorizer()
            tfidf_matrix = tfidf.fit_transform(df_lectures['search_text'])
            query_vec = tfidf.transform([ai_keywords])
            cos_sim = cosine_similarity(query_vec, tfidf_matrix).flatten()
            
            def score_func(idx):
                row = df_lectures.iloc[idx]
                if row['시군명'] != selected_city: return -100 
                return (cos_sim[idx] * 65) + (20 if row['구'] == selected_district else 0) + (vul_row['최종_취약지수'] / 100 * 15)

            df_lectures['total_score'] = [score_func(i) for i in range(len(df_lectures))]
            top_results = df_lectures[df_lectures['total_score'] > 0].sort_values('total_score', ascending=False).head(3)
            
            if len(top_results) == 0:
                st.info(f"📍 현재 {selected_city} 지역에는 관련 강좌가 없습니다. 다른 키워드로 검색해 보세요!")
            else:
                st.markdown(f'<h3 style="color: #1E3A8A; margin-bottom: 30px; border-left: 6px solid #3B82F6; padding-left: 15px;">🎯 "{ai_keywords}" 추천 강좌</h3>', unsafe_allow_html=True)
                cols = st.columns(3)
                for i, (idx, row) in enumerate(top_results.iterrows()):
                    with cols[i]:
                        reason_res = model.generate_content(f"관심:{user_query}, 강좌:{row['강좌명']}. 친절하게 추천 이유 한 문장.")
                        st.markdown(f"""
                            <div class="lecture-card">
                                <span style="background:#DBEAFE; color:#1E40AF; padding:5px 12px; border-radius:20px; font-size:0.85rem; font-weight:bold;">추천 {i+1}</span>
                                <div style="font-size:1.25rem; font-weight:800; margin:18px 0; color:#0F172A; min-height:3.5em; line-height:1.4;">{row['강좌명']}</div>
                                <p style="font-size:1rem; color:#475569; line-height:1.7; margin-bottom:20px;">💡 {reason_res.text if reason_res.parts else '회원님의 관심사에 딱 맞는 과정입니다.'}</p>
                                <div style="font-size:0.85rem; color:#64748B;">🏢 {row['운영기관명']}</div>
                                <div style="font-size:0.85rem; color:#94A3B8;">📍 {row['시군명']} {row['구']}</div>
                            </div>
                        """, unsafe_allow_html=True)
                        if pd.notna(row['홈페이지주소']):
                            st.link_button("🚀 상세 정보 및 신청", str(row['홈페이지주소']), use_container_width=True)

        except Exception as e:
            st.error(f"분석 중 오류가 발생했습니다: {e}")

# --- [6] 하단 지역 지표 (세련된 마무리) ---
st.markdown('<br><br><hr style="border:0; height:1px; background:linear-gradient(to right, #E2E8F0, #ffffff);"><br>', unsafe_allow_html=True)
st.markdown(f'<h4 style="color:#1E293B; margin-bottom:20px;">📊 {selected_city} {selected_district} 지역 데이터 대시보드</h4>', unsafe_allow_html=True)
m1, m2, m3 = st.columns(3)
with m1:
    st.metric("미래역량 소외 지수", f"{vul_row['인프라_취약_지수']:.1f}", help="인프라 및 교육 접근성 부족도")
with m2:
    st.metric("경제 취약 지수", f"{vul_row['경제_취약_지수']:.1f}", help="지역 내 경제적 여건 지표")
with m3:
    st.metric("종합 소외 지수", f"{vul_row['최종_취약지수']:.1f}", delta=f"{vul_row['최종_취약지수']-50:.1f}", delta_color="inverse")

st.markdown('</div>', unsafe_allow_html=True) # 메인 컨테이너 끝