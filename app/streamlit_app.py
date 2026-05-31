"""Streamlit 데모 앱 (Phase 7 완성본).

이미지(선택) + 폼 입력 → 피부 속성 추정 → 화장품 추천
의료 진단이 아닌 화장품 추천 보조 도구임을 명시.

실행 방법 (프로젝트 루트에서):
    streamlit run app/streamlit_app.py
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import datetime
import torch
import pandas as pd
from PIL import Image
from torchvision import transforms
import streamlit as st

st.set_page_config(page_title="피부 맞춤 화장품 추천", page_icon="🧴", layout="centered")
from src.models.cnn import MultiTaskSkinModel, MultiTaskSkinModelCORAL
from src.data.aihub_loader import MULTITASK_TARGETS, ANNOTATION_MAX
from src.utils.face_crop import crop_faceparts, FACEPART_TARGETS
from src.recommend.ingredient_map import (
    normalize_cnn_output,
    sensitivity_from_form,
    get_recommended_ingredients,
    get_avoid_ingredients,
)
from src.recommend.product_search import FunctionalProductSearch
from src.recommend.explainer import build_skin_summary, explain_recommendation
from src.recommend.food_recommend import FoodRecommender

# ── 상수 ────────────────────────────────────────────────────────────
CHECKPOINT = Path("checkpoints/multitask_v5_best.pth")
_CHECKPOINT_FALLBACK = Path("checkpoints/multitask_v2_best.pth")
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"

_NORMALIZE = transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])

TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    _NORMALIZE,
])

# TTA 변형 목록 (flip 제외 — cheek 방향이 좌우 고정이라 뒤집으면 오히려 노이즈)
_TTA_TRANSFORMS = [
    TRANSFORM,  # 원본
    transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ColorJitter(brightness=(1.15, 1.15)),
        transforms.ToTensor(),
        _NORMALIZE,
    ]),
    transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ColorJitter(brightness=(0.85, 0.85)),
        transforms.ToTensor(),
        _NORMALIZE,
    ]),
]

ATTR_KO = {
    "wrinkle":      "주름",
    "pigmentation": "색소침착",
    "pore":         "모공",
    "dryness":      "건조도",
    "sagging":      "탄력저하",
}

# 0~100 점수 → 3단계 (낮음/중간/높음)
_LOW_THR  = 35
_HIGH_THR = 65

def _level(val: float) -> str:
    if val >= _HIGH_THR:
        return "높음"
    if val >= _LOW_THR:
        return "중간"
    return "낮음"

# 폼 고민 → 속성 점수 (이미지 없을 때 휴리스틱)
_CONCERN_ATTR_HINT: dict[str, dict[str, float]] = {
    "건조함":   {"dryness": 70},
    "주름":     {"wrinkle": 70},
    "색소침착": {"pigmentation": 70},
    "모공":     {"pore": 70},
    "탄력":     {"sagging": 70},
}


# ── 캐시 리소스 ──────────────────────────────────────────────────────
@st.cache_resource(show_spinner="모델 로딩 중...")
def load_model():
    ckpt = CHECKPOINT if CHECKPOINT.exists() else _CHECKPOINT_FALLBACK
    is_coral = "v5" in ckpt.name or "v4" in ckpt.name
    
    if is_coral:
        model = MultiTaskSkinModelCORAL(backbone_name="efficientnet_b0", targets=MULTITASK_TARGETS)
    else:
        model = MultiTaskSkinModel(targets=MULTITASK_TARGETS)
        
    if ckpt.exists():
        model.load_state_dict(torch.load(ckpt, map_location=DEVICE))
    else:
        st.warning("체크포인트 없음. 랜덤 가중치로 실행합니다.")
    model.eval()
    return model.to(DEVICE)


@st.cache_resource(show_spinner="제품 DB 로딩 중...")
def load_search_engine() -> FunctionalProductSearch:
    return FunctionalProductSearch()


# ── 추론 함수 ────────────────────────────────────────────────────────
def run_inference(image: Image.Image) -> tuple[dict, bool]:
    """이미지 → 부위별 크롭 → TTA 앙상블 → 속성별 예측 클래스 dict + 얼굴 검출 여부."""
    model  = load_model()
    is_coral = isinstance(model, MultiTaskSkinModelCORAL)
    crops, face_detected = crop_faceparts(image, return_detection=True)
    preds: dict[str, int] = {}

    for part, targets in FACEPART_TARGETS.items():
        crop_img = crops.get(part, image)

        # TTA: 여러 변형 적용 후 softmax/sigmoid 확률 평균
        prob_sum: dict[str, torch.Tensor] = {}
        with torch.no_grad():
            for tfm in _TTA_TRANSFORMS:
                tensor  = tfm(crop_img).unsqueeze(0).to(DEVICE)
                outputs = model(tensor)
                for t in targets:
                    if is_coral:
                        prob = torch.sigmoid(outputs[t])
                    else:
                        prob = torch.softmax(outputs[t], dim=1)
                    prob_sum[t] = prob_sum.get(t, torch.zeros_like(prob)) + prob

        for t in targets:
            avg_prob = prob_sum[t] / len(_TTA_TRANSFORMS)
            if is_coral:
                preds[t] = int((avg_prob > 0.5).sum(dim=1).item())
            else:
                preds[t] = int(torch.argmax(avg_prob, dim=1).item())

    return preds, face_detected


# ════════════════════════════════════════════════════════════════════
# PAGE
# ════════════════════════════════════════════════════════════════════
st.title("한국인 피부 속성 기반 화장품 추천")
st.caption("이 서비스는 화장품 추천 보조 도구입니다. 의료 진단이 아닙니다.")
st.caption("AI Hub 한국인 피부 데이터 + 식약처 공공데이터 기반.")

# --- 1. 이미지 업로드 ---
st.subheader("1. 셀카 업로드 (선택)")
uploaded = st.file_uploader(
    "정면 얼굴 사진을 업로드하면 피부 속성을 자동 분석합니다.",
    type=["jpg", "jpeg", "png"],
)
if uploaded:
    col_img, _ = st.columns([1, 2])
    with col_img:
        st.image(uploaded, caption="업로드된 이미지", use_container_width=True)

# --- 2. 폼 입력 ---
st.subheader("2. 피부 정보 입력")

col1, col2 = st.columns(2)
with col1:
    age_group   = st.selectbox("연령대", ["10대", "20대", "30대", "40대", "50대 이상"])
    sensitivity = st.radio("민감도", ["매우 민감", "민감", "보통", "둔감"], index=2)
with col2:
    gender = st.radio("성별", ["M", "F", "무응답"], index=2)
    budget = st.radio(
        "예산 범위",
        ["1만원 이하", "1~3만원", "3~5만원", "5만원 이상"],
        index=1,
    )

allergies  = st.multiselect(
    "알레르기 성분", ["알코올", "향료", "에센셜오일", "파라벤", "기타"]
)
concerns   = st.multiselect(
    "피부 고민 (최대 3개)",
    ["여드름", "모공", "색소침착", "건조함", "주름", "탄력", "홍조", "트러블"],
)
categories = st.multiselect(
    "선호 카테고리",
    ["스킨토너", "에센스", "크림", "선크림", "세럼", "클렌저", "마스크", "아이크림"],
)

# --- 선택 입력 ---
with st.expander("선택 입력 (더 정확한 추천을 위해)"):
    is_pregnant  = st.checkbox("임신/수유 중")
    _vegan       = st.checkbox("비건/크루얼티프리 선호")
    uv_exposure  = st.radio("자외선 노출 빈도", ["낮음", "보통", "높음"], index=1, horizontal=True)
    food_allergies = st.multiselect("음식 알레르기", ["해산물", "견과류", "유제품", "달걀", "대두", "기타"])

# --- 3. 분석 버튼 ---
if st.button("피부 분석 및 추천 받기", type="primary", use_container_width=True):

    if not uploaded:
        st.warning("이미지를 업로드하지 않으면 폼 기반으로만 속성을 추정합니다.")

    if len(concerns) > 3:
        st.error("피부 고민은 최대 3개까지 선택 가능합니다.")
        st.stop()

    # CNN 추론
    raw_preds  = None
    attributes: dict[str, float] = {}

    if uploaded:
        with st.spinner("이미지 분석 중..."):
            try:
                img = Image.open(uploaded).convert("RGB")
                raw_preds, face_detected = run_inference(img)
                attributes = normalize_cnn_output(raw_preds)
                if not face_detected:
                    st.warning(
                        "얼굴이 자동 검출되지 않았습니다. "
                        "전체 이미지로 분석했으므로 속성 추정 정확도가 낮을 수 있습니다. "
                        "정면 얼굴 사진을 사용하면 더 정확한 결과를 얻을 수 있습니다."
                    )
            except Exception as e:
                st.warning(f"이미지 분석 실패: {e}. 폼 기반으로만 추천합니다.")

    # 이미지 없거나 추론 실패 시 폼 고민으로 속성 힌트 적용
    if not attributes and concerns:
        for concern in concerns:
            for attr, val in _CONCERN_ATTR_HINT.get(concern, {}).items():
                attributes[attr] = max(attributes.get(attr, 0.0), val)

    sensitivity_class = sensitivity_from_form(sensitivity)

    # 성분 추천/회피
    recommended = get_recommended_ingredients(
        attributes, sensitivity_class,
        form_concerns=concerns,
        age_group=age_group,
    )
    avoid       = get_avoid_ingredients(allergies, is_pregnant)

    # 제품 검색
    products = pd.DataFrame()
    if concerns or categories:
        with st.spinner("제품 검색 중..."):
            try:
                engine   = load_search_engine()
                products = engine.search(
                    concerns=concerns,
                    categories=categories,
                    is_pregnant=is_pregnant,
                    uv_exposure=uv_exposure,
                    top_k=5,
                )
            except Exception as e:
                st.warning(f"제품 검색 오류: {e}")

    # ── 결과 출력 ──────────────────────────────────────────────────
    st.divider()
    st.subheader("분석 결과")

    # 피부 속성 3단계 표시
    if attributes:
        source_label = "이미지 기반 분석" if raw_preds is not None else "폼 입력 기반 추정"
        st.markdown(f"**피부 속성 추정** ({source_label})")

        cols = st.columns(len(ATTR_KO))
        for col, (attr, label) in zip(cols, ATTR_KO.items()):
            val   = attributes.get(attr, 0)
            level = _level(val)
            color = "red" if level == "높음" else ("orange" if level == "중간" else "green")
            with col:
                st.markdown(f"**{label}**")
                st.markdown(f":{color}[{level}]")

    # 피부 상태 요약
    summary = build_skin_summary(attributes, sensitivity_class)
    st.info(f"피부 상태 요약: {summary}")

    # 권장 / 회피 성분
    col_rec, col_avoid = st.columns(2)
    with col_rec:
        st.markdown("**권장 성분**")
        if recommended:
            for ing in recommended:
                st.markdown(f"- {ing}")
        else:
            st.markdown("특별한 권장 성분 없음")
    with col_avoid:
        st.markdown("**피해야 할 성분**")
        if avoid:
            for ing in avoid:
                st.markdown(f"- {ing}")
        else:
            st.markdown("특별한 회피 성분 없음")

    # 예산 안내 (식약처 DB에 가격 정보 없음)
    st.caption(f"선택 예산: {budget} — 현재 식약처 기능성화장품 DB에 가격 정보가 포함되어 있지 않아 예산 기반 필터링은 적용되지 않습니다.")

    # "기타" 알레르기 안내
    if "기타" in allergies:
        st.info("'기타' 알레르기 성분은 개인마다 달라 자동 처리가 어렵습니다. 제품 구매 전 전성분을 직접 확인하세요.")

    # 추천 제품
    st.subheader("추천 제품 (식약처 기능성화장품)")

    if products.empty:
        st.info(
            "조건에 맞는 등록 제품을 찾지 못했습니다. "
            "피부 고민 또는 선호 카테고리를 추가해 보세요."
        )
    else:
        st.info("모델 구현 후 이 영역에 결과가 표시됩니다. (Phase 7 완성 예정)")
        for _, row in products.iterrows():
            with st.container(border=True):
                st.markdown(f"**{row['제품명']}**")
                st.caption(f"제조사: {row['업체명']}")
                if pd.notna(row.get("효능")) and str(row["효능"]).strip():
                    st.caption(f"효능 고시: {row['효능']}")
                if pd.notna(row.get("SPF")) and str(row["SPF"]).strip():
                    st.caption(f"SPF: {row['SPF']}")
                st.markdown(
                    "_" + explain_recommendation(
                        attributes, sensitivity_class,
                        recommended, avoid, row["제품명"],
                    ) + "_"
                )

    # 오늘의 이너뷰티 꿀팁
    st.divider()
    
    col_title, col_btn = st.columns([4, 1])
    with col_title:
        st.subheader("오늘의 이너뷰티 꿀팁 🥗")
    with col_btn:
        if st.button("🔄 다른 추천", use_container_width=True):
            if "food_refresh" not in st.session_state:
                st.session_state.food_refresh = 1
            else:
                st.session_state.food_refresh += 1
                
    if "food_refresh" not in st.session_state:
        st.session_state.food_refresh = 0
        
    today_str = datetime.date.today().strftime("%Y%m%d")
    current_seed = hash(f"{today_str}_{st.session_state.food_refresh}") % (2**32)
    
    with st.spinner("맞춤 식단 추천 중..."):
        food_recommender = FoodRecommender()
        foods = food_recommender.recommend(
            attributes=attributes, 
            sensitivity_class=sensitivity_class, 
            concerns=concerns, 
            is_vegan=_vegan, 
            food_allergies=food_allergies,
            seed=current_seed
        )
        
        if foods:
            cols = st.columns(len(foods))
            for col, food in zip(cols, foods):
                with col:
                    with st.container(border=True):
                        st.markdown(f"### {food['food_name']}")
                        st.markdown(f"**{food['key_nutrients']}**")
                        st.info(food['reason'])
        else:
            st.info("조건에 맞는 음식 데이터를 찾지 못했습니다.")

    # 데이터 출처 안내
    st.divider()
    st.caption(
        "데이터 출처: AI Hub 한국인 피부상태 측정 데이터 (비상업 연구·교육 목적) | "
        "식약처 기능성화장품 보고품목정보 (공공데이터포털 Open API)"
    )