"""Streamlit 데모 앱 (Phase 7에서 완성)."""

import streamlit as st

st.set_page_config(page_title="피부 맞춤 화장품 추천", page_icon="🧴", layout="centered")

st.title("한국인 피부 속성 기반 화장품 추천")
st.caption("이 서비스는 화장품 추천 보조 도구입니다. 의료 진단이 아닙니다.")

# --- 이미지 업로드 ---
st.subheader("1. 셀카 이미지 업로드")
uploaded = st.file_uploader("정면 얼굴 사진을 업로드하세요.", type=["jpg", "jpeg", "png"])

# --- 필수 폼 입력 ---
st.subheader("2. 피부 정보 입력")

col1, col2 = st.columns(2)
with col1:
    age_group = st.selectbox("연령대", ["10대", "20대", "30대", "40대", "50대 이상"])
    sensitivity = st.radio("민감도", ["매우 민감", "민감", "보통", "둔감"])
with col2:
    gender = st.radio("성별", ["M", "F", "무응답"])
    budget = st.radio("예산 범위", ["1만원 이하", "1~3만원", "3~5만원", "5만원 이상"])

allergies = st.multiselect("알레르기 성분", ["알코올", "향료", "에센셜오일", "파라벤", "기타"])
concerns = st.multiselect("피부 고민 (최대 3개)", ["여드름", "모공", "색소침착", "건조함", "주름", "탄력", "홍조", "트러블"])
categories = st.multiselect("선호 카테고리", ["스킨토너", "에센스", "크림", "선크림", "세럼", "클렌저"])

# --- 선택 입력 ---
with st.expander("선택 입력 (더 정확한 추천을 위해)"):
    is_pregnant = st.checkbox("임신/수유 중")
    vegan = st.checkbox("비건/크루얼티프리 선호")

# --- 분석 버튼 ---
if st.button("피부 분석 및 추천 받기", type="primary"):
    if not uploaded:
        st.warning("이미지를 업로드해 주세요.")
    elif len(concerns) > 3:
        st.warning("피부 고민은 최대 3개까지 선택 가능합니다.")
    else:
        st.info("모델 구현 후 이 영역에 결과가 표시됩니다. (Phase 7 완성 예정)")
