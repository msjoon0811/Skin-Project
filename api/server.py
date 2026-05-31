"""FastAPI 서버 - React 프론트엔드(design/)와 Python 백엔드(src/)를 연결.

실행:
    python -m uvicorn api.server:app --reload

프론트엔드: http://localhost:8000
API:
    POST /api/analyze    이미지 + 폼 → 분석 결과
    GET  /api/history    최근 분석 기록
"""

import io
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from api.db import (
    create_session, delete_history, delete_session, delete_user, get_analysis_detail, get_history,
    get_session_user, init_db, login_user, register_user, save_analysis,
)
from src.recommend.lifestyle import compute_lifestyle_deltas, significant_lifestyle_flags
from src.recommend.skin_profile import (
    FORM_SENSITIVITY_CLASS,
    build_frontend_attrs,
    composite_score,
    skin_type_label,
)
from src.recommend.ingredient_map import (
    enrich_avoid,
    enrich_caution,
    enrich_rec,
    get_avoid_ingredients,
    get_caution_ingredients,
    get_recommended_ingredients,
)
from src.recommend.explainer import build_skin_summary, explain_recommendation
from src.recommend.procedure_map import get_recommended_procedures
from src.recommend.food_recommend import FoodRecommender
logger = logging.getLogger("skin.api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


class AuthBody(BaseModel):
    email: str
    password: str


def _current_user(authorization: str | None) -> dict | None:
    """Authorization: Bearer <token> 헤더 → 유저 dict 또는 None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return get_session_user(authorization[7:])

_MAX_REC_INGREDIENTS = 6  # 추천 성분 최대 표시 개수

# ── 앱 수명주기 ────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("DB 초기화 완료")
    yield


app = FastAPI(title="Skin Analysis API", version="0.4", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# ── ML 모델 (지연 로딩 + 캐시) ────────────────────────────────────────

_model = None
_search_engine = None


def _get_model():
    global _model
    if _model is None:
        import torch
        from src.data.aihub_loader import MULTITASK_TARGETS
        from src.models.cnn import MultiTaskSkinModel, MultiTaskSkinModelCORAL

        # CORAL 체크포인트 우선 (v5=B0+CORAL, v4=B3+CORAL)
        _CORAL_CKPTS = [
            Path("checkpoints/multitask_v5_best.pth"),
            Path("checkpoints/multitask_v4_best.pth"),
        ]
        # CE 체크포인트 폴백 (v2=B0+CE — 검증된 안정 버전)
        _CE_CKPTS = [
            Path("checkpoints/multitask_v2_best.pth"),
            Path("checkpoints/multitask_best.pth"),
        ]

        coral_ckpt = next((p for p in _CORAL_CKPTS if p.exists()), None)
        ce_ckpt    = next((p for p in _CE_CKPTS    if p.exists()), None)

        if coral_ckpt:
            model = MultiTaskSkinModelCORAL(
                backbone_name="efficientnet_b0", targets=MULTITASK_TARGETS
            )
            try:
                model.load_state_dict(torch.load(coral_ckpt, map_location="cpu"))
                logger.info("CORAL 체크포인트 로드: %s", coral_ckpt)
            except Exception:
                logger.warning("CORAL 로드 실패 — CE 폴백 시도")
                coral_ckpt = None

        if not coral_ckpt:
            model = MultiTaskSkinModel(targets=MULTITASK_TARGETS)
            if ce_ckpt:
                model.load_state_dict(torch.load(ce_ckpt, map_location="cpu"))
                logger.info("CE 체크포인트 로드: %s", ce_ckpt)
            else:
                logger.warning("체크포인트 없음 — 랜덤 가중치로 실행")

        model.eval()
        _model = model
    return _model


def _get_search():
    global _search_engine
    if _search_engine is None:
        from src.recommend.product_search import FunctionalProductSearch
        _search_engine = FunctionalProductSearch()
    return _search_engine


def _ml_available() -> bool:
    try:
        import torch  # noqa: F401
        return True
    except Exception:
        return False


# TTA 변형 3종 (flip 제외 — l_cheek 방향 고정)
def _tta_transforms():
    from torchvision import transforms
    norm = transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    return [
        transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor(), norm]),
        transforms.Compose([transforms.Resize((224, 224)), transforms.ColorJitter(brightness=(1.15, 1.15)), transforms.ToTensor(), norm]),
        transforms.Compose([transforms.Resize((224, 224)), transforms.ColorJitter(brightness=(0.85, 0.85)), transforms.ToTensor(), norm]),
    ]


def _run_inference(img_bytes: bytes) -> tuple[dict, bool]:
    """이미지 바이트 → TTA 앙상블 → 정규화 속성 점수 + 얼굴 검출 여부."""
    import torch
    from PIL import Image
    from src.utils.face_crop import FACEPART_TARGETS, crop_faceparts
    from src.recommend.ingredient_map import normalize_cnn_output

    img   = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    model = _get_model()
    tta   = _tta_transforms()

    crops, face_detected = crop_faceparts(img, return_detection=True)

    from src.models.cnn import MultiTaskSkinModelCORAL
    is_coral = isinstance(model, MultiTaskSkinModelCORAL)

    raw: dict[str, int] = {}
    for part, targets in FACEPART_TARGETS.items():
        crop_img = crops.get(part, img)
        prob_sum: dict = {}
        with torch.no_grad():
            for tfm in tta:
                tensor  = tfm(crop_img).unsqueeze(0)
                outputs = model(tensor)
                for t in targets:
                    # CORAL: sigmoid 누적 / CE: softmax 누적
                    prob = torch.sigmoid(outputs[t]) if is_coral else torch.softmax(outputs[t], dim=1)
                    prob_sum[t] = prob_sum.get(t, torch.zeros_like(prob)) + prob
        for t in targets:
            avg = prob_sum[t] / len(tta)
            if is_coral:
                # CORAL 예측: sigmoid > 0.5 인 개수 = 등급
                raw[t] = int((avg > 0.5).sum(dim=1).item())
            else:
                raw[t] = int(torch.argmax(avg, dim=1).item())

    return normalize_cnn_output(raw), face_detected


# ── 폼 유효성 검사 헬퍼 ───────────────────────────────────────────────

def _parse_allergies(raw) -> list[str]:
    """allergies 필드: 배열 또는 콤마 구분 문자열 모두 처리."""
    skip = {"없음", "없어요", "해당없음", "해당 없음", ""}
    if isinstance(raw, list):
        return [a.strip() for a in raw if a.strip() not in skip]
    return [a.strip() for a in str(raw).split(",") if a.strip() not in skip]


def _parse_concerns(raw) -> list[str]:
    """concerns 필드: 배열 또는 콤마 구분 문자열 모두 처리."""
    if isinstance(raw, list):
        return raw
    return [c.strip() for c in str(raw).split(",") if c.strip()]


_CONCERN_NORMALIZE = {
    "민감/홍조": "홍조", "탄력저하": "탄력",
    "유분과다": "모공", "각질": "건조함",
}

_CONCERN_HINT: dict[str, dict[str, float]] = {
    "건조함":   {"dryness": 70},
    "주름":     {"wrinkle": 70},
    "색소침착": {"pigmentation": 70},
    "모공":     {"pore": 70},
    "탄력저하": {"sagging": 70},
    "각질":     {"dryness": 60},
    "유분과다": {"dryness": 10},
}


# ── Claude AI ─────────────────────────────────────────────────────────

_ingredient_cache: dict[str, dict] = {}


def _claude_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return None
    from anthropic import AsyncAnthropic
    return AsyncAnthropic(api_key=api_key)


async def _generate_explanation(
    fe_attrs: list[dict],
    form: dict,
    rec_names: list[str],
) -> dict | None:
    """Claude Haiku → 구조화된 피부 분석 요약 dict 반환."""
    client = _claude_client()
    if not client:
        return None
    try:
        attr_text = ", ".join(
            f"{a['name']} {a['value']}({'높음' if a['level']=='hi' else '낮음' if a['level']=='lo' else '보통'})"
            for a in fe_attrs
        )
        concerns_text  = ", ".join(_parse_concerns(form.get("concerns", []))) or "없음"
        rec_text       = ", ".join(rec_names[:3]) or "없음"
        lifestyle_text = ", ".join(significant_lifestyle_flags(form)) or "특이 항목 없음"

        prompt = f"""피부 AI 분석 결과를 바탕으로 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이).

이미지 분석: {attr_text}
피부 고민: {concerns_text}
생활습관 특이사항: {lifestyle_text}
권장 성분 Top 3: {rec_text}

{{
  "skin_summary": "현재 피부 상태를 친근한 말투로 2문장 설명 (의료 진단 표현 금지)",
  "care_tips": ["케어 포인트 1", "케어 포인트 2", "케어 포인트 3"],
  "lifestyle_note": "생활습관 특이사항이 피부에 미치는 영향 1문장 (없으면 null)",
  "key_ingredient": "{rec_names[0] if rec_names else '히알루론산'}",
  "key_ingredient_reason": "해당 성분을 지금 써야 하는 이유 1문장"
}}"""

        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        import re
        text = msg.content[0].text.strip()
        # JSON 블록만 추출
        m = re.search(r"\{[\s\S]+\}", text)
        if m:
            return json.loads(m.group())
        return None
    except Exception:
        logger.exception("Claude 설명 생성 실패")
        return None


async def _ingredient_info(name: str) -> dict:
    """Claude Haiku → 성분 상세 정보 dict."""
    if name in _ingredient_cache:
        return _ingredient_cache[name]

    client = _claude_client()
    if not client:
        return {"description": "API 키가 설정되지 않았습니다.", "benefits": [], "concerns": [], "suitable_for": "-", "found_in": "-"}

    try:
        prompt = f"""화장품 성분 '{name}'에 대해 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이).

{{
  "description": "성분 개요 2-3문장 (작용 원리 포함, 한국어)",
  "benefits": ["효과1", "효과2", "효과3"],
  "concerns": ["주의사항1"] ,
  "suitable_for": "적합한 피부 타입 (예: 건성, 민감성)",
  "concentration": "화장품에서 일반적인 사용 농도 (예: 0.1-2%)",
  "found_in": "주로 사용되는 제품 유형 (예: 토너, 세럼, 크림)"
}}"""
        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        import re
        text = msg.content[0].text.strip()
        m = re.search(r"\{[\s\S]+\}", text)
        result = json.loads(m.group()) if m else {}
        _ingredient_cache[name] = result
        return result
    except Exception:
        logger.exception("성분 정보 조회 실패: %s", name)
        return {"description": "정보를 불러올 수 없습니다.", "benefits": [], "concerns": [], "suitable_for": "-", "found_in": "-"}


# ── 제품 카테고리별 사용법 매핑 ─────────────────────────────────────

_PRODUCT_USAGE_MAP: list[tuple[list[str], str]] = [
    (["선크림", "선블록", "선스크린", "sunscreen", "sun", "spf"],
     "외출 30분 전 얼굴 전체에 동전 크기(2mg/cm²)만큼 넉넉히 발라주세요. 2~3시간마다 덧바르면 효과가 유지됩니다."),
    (["세럼", "앰플", "serum", "ampoule"],
     "세안 후 토너로 결을 정돈한 뒤, 소량(펌프 1~2번)을 손끝에 덜어 피부를 살살 눌러주듯 흡수시켜 주세요."),
    (["에센스", "essence"],
     "토너 다음 단계에서 적당량을 손바닥에 덜어 체온으로 살짝 데운 후 얼굴 전체에 부드럽게 펴 발라주세요."),
    (["아이크림", "eye"],
     "약지손가락으로 눈 주변 뼈 위를 따라 도트를 찍듯 소량 올린 뒤 부드럽게 두드려 흡수시켜 주세요. 눈꺼풀 직접 접촉은 피해주세요."),
    (["크림", "cream", "밤", "로션", "lotion"],
     "세럼·에센스가 완전히 흡수된 후 마지막 단계에서 적당량을 얼굴 안쪽에서 바깥쪽으로 부드럽게 펴 발라 수분을 마무리해 주세요."),
    (["토너", "스킨", "toner", "water", "워터"],
     "세안 직후 화장솜에 덜어 결을 따라 닦아내거나, 손바닥에 덜어 가볍게 눌러주듯 흡수시켜 주세요."),
    (["클렌저", "폼클", "클렌징", "cleanser", "wash"],
     "적당량을 물로 충분히 거품 낸 후 30초~1분간 마사지하듯 세안하고 미온수로 깨끗이 헹궈주세요."),
    (["마스크", "패드", "mask", "pad"],
     "세안 후 정돈된 피부에 10~20분간 올려두고, 제거 후 남은 에센스를 가볍게 두드려 흡수시켜 주세요."),
]

_DEFAULT_USAGE = "세안 후 피부 결을 따라 적당량을 부드럽게 펴 발라주세요."

def _get_product_usage(product_name: str) -> str:
    """제품명 키워드로 카테고리를 판단하여 맞는 사용법 반환."""
    name_lower = product_name.lower()
    for keywords, usage in _PRODUCT_USAGE_MAP:
        if any(kw in name_lower for kw in keywords):
            return usage
    return _DEFAULT_USAGE


# ── 인증 엔드포인트 ──────────────────────────────────────────────────

@app.post("/api/register")
def api_register(body: AuthBody):
    try:
        user = register_user(body.email, body.password)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    token = create_session(user["id"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"]}}


@app.post("/api/login")
def api_login(body: AuthBody):
    user = login_user(body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    token = create_session(user["id"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"]}}


@app.post("/api/logout")
def api_logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        delete_session(authorization[7:])
    return {"ok": True}


@app.get("/api/me")
def api_me(authorization: str | None = Header(default=None)):
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    return user


@app.delete("/api/me")
def api_delete_account(authorization: str | None = Header(default=None)):
    """회원 탈퇴 — 유저 및 모든 관련 데이터 삭제."""
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    delete_user(user["id"])
    return {"ok": True, "message": "회원 탈퇴가 완료되었습니다."}


# ── 분석/히스토리 엔드포인트 ───────────────────────────────────────────

@app.post("/api/analyze")
async def analyze(
    image:         Optional[UploadFile] = File(None),
    form_data:     str                  = Form(...),
    authorization: Optional[str]        = Header(default=None),
):
    try:
        form: dict = json.loads(form_data)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"form_data JSON 파싱 오류: {e}")

    # ① CNN 추론 (TTA 포함)
    cnn_attrs: dict[str, float] = {}
    face_detected: Optional[bool] = None  # 이미지 없으면 None

    if image and _ml_available():
        contents = await image.read()
        try:
            cnn_attrs, face_detected = _run_inference(contents)
        except Exception:
            logger.exception("CNN 추론 실패 (image=%s)", image.filename)
            face_detected = False

    # 이미지 없거나 추론 실패 시 폼 고민으로 최소 힌트
    if not cnn_attrs:
        for concern in _parse_concerns(form.get("concerns", [])):
            for attr, val in _CONCERN_HINT.get(concern, {}).items():
                cnn_attrs[attr] = max(cnn_attrs.get(attr, 0.0), val)

    # ② 생활습관 델타
    lifestyle_deltas = compute_lifestyle_deltas(form)

    # ③ 프론트엔드 7속성 + 종합 점수 + 피부 타입
    fe_attrs   = build_frontend_attrs(cnn_attrs, form, lifestyle_deltas)
    score      = composite_score(fe_attrs)
    skin_label = skin_type_label(fe_attrs, form)

    # ④ 민감도 클래스 (생활습관 보정 반영)
    sensitivity_class = FORM_SENSITIVITY_CLASS.get(form.get("sensitivity", "거의 없음"), 0)
    if lifestyle_deltas.get("sens_boost", 0) >= 10:
        sensitivity_class = 1

    # ⑤ 성분 추천·회피 (최대 6개)
    # 생활습관 델타를 CNN 속성에 반영한 조정 점수 사용 (이미지 불검출 속성 보완)
    lifestyle_adjusted_attrs = {
        k: min(100.0, max(0.0, cnn_attrs.get(k, 0.0) + lifestyle_deltas.get(k, 0.0)))
        for k in ("wrinkle", "pigmentation", "pore", "dryness", "sagging")
    }
    raw_concerns  = _parse_concerns(form.get("concerns", []))
    age_group     = form.get("ageGroup", form.get("age_group"))
    rec_names     = get_recommended_ingredients(
        lifestyle_adjusted_attrs, sensitivity_class,
        form_concerns=raw_concerns,
        age_group=age_group,
    )[:_MAX_REC_INGREDIENTS]

    allergy_list  = _parse_allergies(form.get("allergies", ""))
    hormone_raw   = form.get("hormone", "")
    hormone_list  = hormone_raw if isinstance(hormone_raw, list) else ([hormone_raw] if hormone_raw else [])
    is_pregnant   = (
        "임신 중" in hormone_list
        or form.get("pregnancy", "해당 없음") not in ("해당 없음", "", None)
    )
    avoid_names = get_avoid_ingredients(allergy_list, is_pregnant)

    # ⑥ 제품 검색
    search_concerns = [_CONCERN_NORMALIZE.get(c, c) for c in raw_concerns]
    uv_exposure     = form.get("uvExposure", form.get("uv_exposure", "보통"))
    products: list[dict] = []
    if search_concerns:
        try:
            df = _get_search().search(
                concerns=search_concerns,
                categories=[],
                is_pregnant=is_pregnant,
                uv_exposure=uv_exposure,
                top_k=3,
            )
            for _, row in df.iterrows():
                raw_score = float(row.get("점수", 1))
                raw_name = str(row.get("제품명", ""))
                spaced_name = raw_name

                products.append({
                    "brand":  str(row.get("업체명", "")),
                    "name":   spaced_name,
                    "match":  int(min(99, 75 + raw_score * 3)),
                    "tags":   raw_concerns[:2],
                    "reason": explain_recommendation(
                        cnn_attrs, sensitivity_class, rec_names, avoid_names,
                        raw_name, rank=_ + 1
                    ),
                    "usage":  _get_product_usage(raw_name),
                    "price": "",
                    "shot":  "",
                })
        except Exception:
            logger.exception("제품 검색 실패")

    summary = build_skin_summary(cnn_attrs, sensitivity_class)

    # ⑦ Claude AI 설명 (구조화 dict)
    explanation = await _generate_explanation(fe_attrs, form, rec_names)

    # ⑧ 음식 추천
    import datetime
    today_str = datetime.date.today().strftime("%Y%m%d")
    food_seed = hash(today_str) % (2**32)
    food_recommender = FoodRecommender()
    is_vegan = form.get("vegan", False)
    food_allergies = _parse_allergies(form.get("food_allergies", ""))
    foods_raw = food_recommender.recommend(
        attributes=lifestyle_adjusted_attrs,
        sensitivity_class=str(sensitivity_class),
        concerns=raw_concerns,
        is_vegan=is_vegan,
        food_allergies=food_allergies,
        seed=food_seed,
    )
    foods = foods_raw if foods_raw else []

    caution_names = get_caution_ingredients(lifestyle_adjusted_attrs, sensitivity_class)

    # ── 성분 Fallback: 추천 성분이 비어있을 경우 폼 기반 기본 성분 제공
    enriched_rec = enrich_rec(rec_names)
    if not enriched_rec:
        _skin_type = form.get("skinType", "")
        _fallback_ings: list[str] = []
        if _skin_type in ("건성",):
            _fallback_ings = ["히알루론산", "세라마이드", "글리세린"]
        elif _skin_type in ("지성", "복합성"):
            _fallback_ings = ["나이아신아마이드", "살리실산", "판테놀"]
        elif _skin_type in ("민감성",):
            _fallback_ings = ["센텔라아시아티카", "판테놀", "마데카소사이드"]
        else:
            _fallback_ings = ["판테놀", "글리세린", "나이아신아마이드"]
        enriched_rec = enrich_rec(_fallback_ings)

    # ── 회피 성분 Fallback: 비어있고 민감도가 있을 때 기본 제공
    enriched_avoid = enrich_avoid(avoid_names)
    if not enriched_avoid and sensitivity_class >= 1:
        enriched_avoid = enrich_avoid(["에탄올", "향료"])

    result = {
        "attributes":              fe_attrs,
        "composite_score":         score,
        "skin_type_label":         skin_label,
        "summary":                 summary,
        "recommended_ingredients": enriched_rec,
        "avoid_ingredients":       enriched_avoid,
        "caution_ingredients":     enrich_caution(caution_names),
        "products":                products,
        "procedures":              get_recommended_procedures(lifestyle_adjusted_attrs, sensitivity_class),
        "ml_available":            _ml_available(),
        "face_detected":           face_detected,
        "explanation":             explanation,
        "foods":                   foods,
        "input_form":              form,
    }

    # ⑧ 기록 저장 (full_data 포함)
    user = _current_user(authorization)
    try:
        save_analysis(
            score, skin_label, fe_attrs,
            user_id=user["id"] if user else None,
            full_data=json.dumps(result, ensure_ascii=False),
        )
    except Exception:
        logger.exception("분석 기록 저장 실패")

    return result


@app.get("/api/history")
def history(authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    try:
        return {"items": get_history(limit=20, user_id=user["id"] if user else None)}
    except Exception:
        logger.exception("히스토리 조회 실패")
        return {"items": []}


@app.get("/api/history/last_form")
def last_form(authorization: Optional[str] = Header(default=None)):
    """최근 분석 기록에서 입력했던 폼 데이터(input_form)를 가져옵니다."""
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    
    hist = get_history(limit=1, user_id=user["id"])
    if not hist:
        raise HTTPException(status_code=404, detail="기록이 없습니다.")
    
    full_data = get_analysis_detail(hist[0]["id"], user_id=user["id"])
    if not full_data or "input_form" not in full_data:
        raise HTTPException(status_code=404, detail="이전 폼 데이터를 찾을 수 없습니다.")
        
    return full_data["input_form"]


@app.get("/api/history/{analysis_id}")
def history_detail(analysis_id: int, authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    data = get_analysis_detail(analysis_id, user_id=user["id"] if user else None)
    if not data:
        raise HTTPException(status_code=404, detail="분석 기록을 찾을 수 없습니다.")
    # 구버전 기록에 procedures/foods 누락 시 재계산
    if "procedures" not in data or not data.get("procedures"):
        attrs_raw = data.get("attributes", {})
        if isinstance(attrs_raw, list):
            attrs_dict = {a["key"]: a["value"] for a in attrs_raw if "key" in a and "value" in a}
        else:
            attrs_dict = attrs_raw or {}
        sens = int(attrs_dict.get("sensitivity", attrs_dict.get("sens", 0)) >= 50)
        data["procedures"] = get_recommended_procedures(attrs_dict, sens)
    return data


@app.delete("/api/history/{analysis_id}")
def delete_history_endpoint(analysis_id: int, authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="권한이 없습니다.")
    success = delete_history(analysis_id, user_id=user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="분석 기록을 찾을 수 없거나 삭제 권한이 없습니다.")
    return {"ok": True}


@app.get("/api/ingredient/{name}")
async def ingredient_detail(name: str):
    info = await _ingredient_info(name)
    return info



# ── 통합 사용자 데이터 관리 API ──────────────────────────────────────

from pydantic import BaseModel
from typing import Optional
from fastapi import Header, HTTPException
from api.db import (
    update_user_info, get_user_by_id,
    add_diary, get_diaries, delete_diary,
    add_notification, get_notifications, mark_notifications_read, delete_notification
)

class UserSettingsUpdate(BaseModel):
    nickname: Optional[str] = None
    settings_json: Optional[str] = None

@app.patch("/api/me")
def update_me(payload: UserSettingsUpdate, authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401)
    update_user_info(user["id"], nickname=payload.nickname, settings_json=payload.settings_json)
    return {"ok": True}

class DiaryCreate(BaseModel):
    id: str
    date: str
    food: str
    skin_effect: Optional[str] = None
    notes: Optional[str] = None

@app.get("/api/me/diary")
def get_my_diary(authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401)
    return {"items": get_diaries(user["id"])}

@app.post("/api/me/diary")
def create_my_diary(payload: DiaryCreate, authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401)
    add_diary(payload.id, user["id"], payload.date, payload.food, payload.skin_effect, payload.notes)
    return {"ok": True}

@app.delete("/api/me/diary/{id}")
def delete_my_diary(id: str, authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401)
    if not delete_diary(id, user["id"]):
        raise HTTPException(status_code=404)
    return {"ok": True}

class NotificationCreate(BaseModel):
    id: str
    type: str
    title: str
    message: str
    created_at: Optional[str] = None

@app.get("/api/me/notifications")
def get_my_notifications(authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401)
    return {"items": get_notifications(user["id"])}

@app.post("/api/me/notifications")
def create_my_notification(payload: NotificationCreate, authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401)
    add_notification(payload.id, user["id"], payload.type, payload.title, payload.message, payload.created_at)
    return {"ok": True}

@app.put("/api/me/notifications/read")
def read_my_notifications(authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401)
    mark_notifications_read(user["id"])
    return {"ok": True}

@app.delete("/api/me/notifications/{id}")
def delete_my_notification(id: str, authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401)
    if not delete_notification(id, user["id"]):
        raise HTTPException(status_code=404)
    return {"ok": True}


# ── 위시리스트 API ────────────────────────────────────────────────
class WishlistCreate(BaseModel):
    item_type: str  # 'product' or 'treatment'
    title: str
    subtitle: str | None = None

@app.get("/api/me/wishlist")
def api_get_wishlist(authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    from api.db import get_wishlist
    return get_wishlist(user["id"])

@app.post("/api/me/wishlist")
def api_add_wishlist(payload: WishlistCreate, authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    from api.db import add_wishlist
    item_id = add_wishlist(user["id"], payload.item_type, payload.title, payload.subtitle)
    return {"ok": True, "id": item_id}

@app.delete("/api/me/wishlist/{item_id}")
def api_delete_wishlist(item_id: str, authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    from api.db import delete_wishlist
    success = delete_wishlist(item_id, user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="권한이 없거나 찾을 수 없습니다.")
    return {"ok": True}


_FRONTEND_DIR = Path(__file__).parent.parent / "design"
if _FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="frontend")


