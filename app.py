import streamlit as st
import pandas as pd
import google.generativeai as genai
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# --- [1] 서비스 설정 및 보안 (API 키 처리) ---
st.set_page_config(page_title="에듀이음: AI 진로 코치", layout="wide")

try:
    api_key = st.secrets["GEMINI_API_KEY"]
    genai.configure(api_key=api_key)
    
    # 가용 모델 자동 선택 (404 오류 방지 및 호환성 확보)
    available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
    target_model = 'models/gemini-1.5-flash' if 'models/gemini-1.5-flash' in available_models else available_models[0]
    model = genai.GenerativeModel(target_model)
except Exception as e:
    st.error(f"⚠️ API 설정 오류: {e}")
    st.stop()

# --- [2] 데이터 로드 및 전처리 (필터링 강화) ---
@st.cache_data
def load_data():
    # 파일명이 정확한지 확인하세요.
    df_sch = pd.read_csv('suwon_schools_vulnerability_v2.csv')
    df_lec = pd.read_csv('suwon_free_lectures.csv')
    
    # [개선] 성인 전용 강좌 사전 제외 (학생 맞춤형 데이터 정제)
    exclude_keywords = ['성인', '학부모', '실버', '어르신', '직장인', '교사', '시니어']
    df_lec = df_lec[~df_lec['강좌명'].str.contains('|'.join(exclude_keywords), na=False)]
    
    return df_sch, df_lec

try:
    df_schools, df_lectures = load_data()
except FileNotFoundError:
    st.error("⚠️ 데이터 파일(CSV)을 찾을 수 없습니다. 파일명을 확인해주세요.")
    st.stop()

# --- [3] TF-IDF 엔진 사전 준비 ---
tfidf = TfidfVectorizer()
tfidf_matrix = tfidf.fit_transform(df_lectures['강좌명'])

# --- [4] UI 구성 (사이드바 및 메인) ---
st.title("🚀 에듀이음 (Edu-Ieum)")
st.markdown("#### **수원시 공공데이터 기반 학생 맞춤형 교육 매칭 시스템**")

with st.sidebar:
    st.header("👤 학생 프로필 설정")
    
    # 학교 선택
    user_school = st.selectbox("소속 학교를 선택하세요", df_schools['학교명_clean'].unique())
    school_info = df_schools[df_schools['학교명_clean'] == user_school].iloc[0]
    
    v_score = school_info['최종_취약지수_v2']
    district = school_info['구']
    
    # 학교급 판단 (초/중/고 가산점용)
    school_level = "초등" if "초등" in user_school else "중학" if "중" in user_school else "고등"
    
    st.divider()
    user_query = st.text_area("어떤 것을 배우고 싶나요?", 
                              placeholder="예: 로봇을 조립하고 코딩하는 법을 배우고 싶어요.",
                              height=150)
    
    search_button = st.button("✨ 맞춤형 강좌 찾기")

# --- [5] 추천 알고리즘 및 결과 출력 ---

if search_button:
    if not user_query.strip():
        st.warning("배우고 싶은 내용을 입력해주세요.")
    else:
        with st.spinner('AI 코치가 학생에게 딱 맞는 교육 자원을 선별 중입니다...'):
            # Step 1: Gemini를 이용한 검색 키워드 확장 (학교급 반영)
            prompt = f"사용자 고민: '{user_query}'\n이 학생은 {school_level}생입니다. 검색에 적합한 단어 3개를 콤마로 구분해서 단어만 출력해줘."
            response = model.generate_content(prompt)
            ai_keywords = response.text.strip()
            
            # Step 2: 텍스트 유사도 계산 (TF-IDF)
            query_vec = tfidf.transform([ai_keywords])
            cos_sim = cosine_similarity(query_vec, tfidf_matrix).flatten()
            
            # Step 3: 하이브리드 점수 산정 (유사도 60 + 학교급 20 + 지역 20)
            def calculate_total_score(idx):
                similarity_p = cos_sim[idx] * 60  # 내용 유사도 비중 강화
                level_p = 20 if school_level in df_lectures.iloc[idx]['강좌명'] else 0 # 연령대 매칭
                location_p = 20 if df_lectures.iloc[idx]['구'] == district else 0 # 지역 근접성
                
                # 취약 계층 가산점 (미세 보정)
                v_bonus = (v_score / 100) * 10
                
                return similarity_p + level_p + location_p + v_bonus
            
            df_lectures['total_score'] = [calculate_total_score(i) for i in range(len(df_lectures))]
            
            # Step 4: 필터링 (중복 제거 및 최소 점수 미달 제외)
            # 검색어와 너무 무관한(점수가 낮은) 강좌는 아예 제외하여 신뢰도 확보
            final_df = df_lectures[df_lectures['total_score'] > 15].copy() 
            final_df = final_df.sort_values(by='total_score', ascending=False)
            final_df = final_df.drop_duplicates(subset=['강좌명']) # 중복 강좌 제거
            
            top_results = final_df.head(3)
            
            # 결과 출력 UI
            if len(top_results) == 0:
                st.error("😥 입력하신 키워드와 연관된 학생용 강좌를 찾지 못했습니다. 다른 키워드로 검색해보세요!")
            else:
                st.markdown(f"### 🤖 AI 코치의 분석: **'{ai_keywords}'** 관련 추천")
                st.balloons() # 시각적 효과
                
                col1, col2, col3 = st.columns(3)
                cols = [col1, col2, col3]
                
                for i, (idx, row) in enumerate(top_results.iterrows()):
                    with cols[i]:
                        # 개인화 추천 사유 생성
                        reason_prompt = (f"학생소속: {user_school} {school_level}, 관심사: {user_query}. "
                                         f"추천강좌: {row['강좌명']}. "
                                         f"이 학생에게 왜 이 강좌가 필요한지 다정한 말투로 한 문장 추천해줘.")
                        reason_res = model.generate_content(reason_prompt)
                        
                        st.success(f"**추천 {i+1}**")
                        st.write(f"#### {row['강좌명']}")
                        st.info(f"💡 {reason_res.text}")
                        st.write(f"🏢 **운영기관**: {row['운영기관명']}")
                        st.write(f"📍 **위치**: 수원시 {row['구']}")
                        
                        st.divider()
                        
                        # 강좌 신청하기 버튼 (CSV의 '홈페이지주소' 컬럼 활용)
                        target_url = row.get('홈페이지주소')
                        if pd.notna(target_url) and str(target_url).startswith('http'):
                            st.link_button("🚀 지금 바로 신청하기", target_url, use_container_width=True, type="primary")
                        else:
                            st.button("🚫 온라인 신청 정보 없음", use_container_width=True, disabled=True, key=f"btn_{idx}")

# --- [6] 하단 정보 및 데이터 기반 안내 ---
st.divider()
st.caption(f"📍 분석 정보: {user_school} | {school_level} 맞춤 필터 적용 | 취약 지수: {v_score:.1f}점 | 사용 모델: {target_model}")