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
    create_session, delete_analysis, delete_session, get_analysis_detail,
    get_history, get_session_user, init_db, login_user, register_user, save_analysis,
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

logger = logging.getLogger("skin.api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


class AuthBody(BaseModel):
    username: str
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
    allow_headers=["Content-Type"],
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
        transforms.Compose([transforms.Resize((224, 224)), transforms.ColorJitter(brightness=0.15), transforms.ToTensor(), norm]),
        transforms.Compose([transforms.Resize((224, 224)), transforms.ColorJitter(brightness=-0.15), transforms.ToTensor(), norm]),
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


# ── 인증 엔드포인트 ──────────────────────────────────────────────────

@app.post("/api/register")
def api_register(body: AuthBody):
    try:
        user = register_user(body.username, body.password)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    token = create_session(user["id"])
    return {"token": token, "user": {"id": user["id"], "username": user["username"]}}


@app.post("/api/login")
def api_login(body: AuthBody):
    user = login_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    token = create_session(user["id"])
    return {"token": token, "user": {"id": user["id"], "username": user["username"]}}


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

    # 네이버 쇼핑 우선 (구매 가능 제품 + 이미지/가격/링크)
    if search_concerns or raw_concerns:
        try:
            products = await _naver_product_recommend(search_concerns, raw_concerns)
        except Exception:
            logger.exception("네이버 제품 추천 실패")

    # 네이버 실패/키 없을 때 식약처 DB 폴백
    if not products and search_concerns:
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
                products.append({
                    "brand":  str(row.get("업체명", "")),
                    "name":   str(row.get("제품명", "")),
                    "match":  int(min(99, 75 + raw_score * 3)),
                    "tags":   raw_concerns[:2],
                    "reason": explain_recommendation(
                        cnn_attrs, sensitivity_class, rec_names, avoid_names,
                        row["제품명"], rank=_ + 1
                    ),
                    "price": "",
                    "image": "",
                    "link":  "",
                    "shot":  "",
                })
        except Exception:
            logger.exception("식약처 제품 검색 실패")

    summary = build_skin_summary(cnn_attrs, sensitivity_class)

    # ⑦ Claude AI 설명 (구조화 dict)
    explanation = await _generate_explanation(fe_attrs, form, rec_names)

    caution_names = get_caution_ingredients(lifestyle_adjusted_attrs, sensitivity_class)
    result = {
        "attributes":              fe_attrs,
        "composite_score":         score,
        "skin_type_label":         skin_label,
        "summary":                 summary,
        "recommended_ingredients": enrich_rec(rec_names),
        "avoid_ingredients":       enrich_avoid(avoid_names),
        "caution_ingredients":     enrich_caution(caution_names),
        "products":                products,
        "ml_available":            _ml_available(),
        "face_detected":           face_detected,
        "explanation":             explanation,
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


@app.get("/api/history/{analysis_id}")
def history_detail(analysis_id: int, authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    data = get_analysis_detail(analysis_id, user_id=user["id"] if user else None)
    if not data:
        raise HTTPException(status_code=404, detail="분석 기록을 찾을 수 없습니다.")
    return data


@app.delete("/api/history/{analysis_id}")
def history_delete(analysis_id: int, authorization: Optional[str] = Header(default=None)):
    user = _current_user(authorization)
    ok = delete_analysis(analysis_id, user_id=user["id"] if user else None)
    if not ok:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")
    return {"deleted": analysis_id}


# 피부 고민 → 성분 기반 네이버 쇼핑 검색 쿼리 (제품 타입 고정 X, 성분명 우선)
_CONCERN_SEARCH_QUERIES: dict[str, list[str]] = {
    "여드름":   ["살리실산 BHA 여드름 앰플", "아젤라산 나이아신아마이드 세럼", "벤조일퍼옥사이드 여드름 크림"],
    "모공":     ["나이아신아마이드 모공 앰플", "살리실산 BHA 필링 패드", "레티놀 모공 크림"],
    "건성":     ["히알루론산 세라마이드 에센스", "판테놀 수분 크림", "스쿠알란 보습 앰플"],
    "지성":     ["나이아신아마이드 피지 조절 앰플", "살리실산 각질 필링 패드", "레티놀 모공 세럼"],
    "민감성":   ["병풀 마데카소사이드 진정 앰플", "판테놀 저자극 에센스", "세라마이드 장벽 크림"],
    "색소침착": ["나이아신아마이드 알부틴 미백 앰플", "비타민C 아스코르빅 에센스", "알파알부틴 미백 크림"],
    "주름":     ["레티놀 펩타이드 주름 앰플", "아데노신 리프팅 세럼", "아르지렐린 주름 크림"],
    "탄력":     ["콜라겐 펩타이드 탄력 앰플", "아데노신 리프팅 에센스", "EGF 탄력 크림"],
    "미백":     ["나이아신아마이드 미백 앰플", "비타민C 아스코르빅 세럼", "알부틴 미백 에센스"],
    "각질":     ["글리콜산 AHA 필링 패드", "젖산 각질 앰플", "살리실산 BHA 필링"],
    "수분":     ["히알루론산 수분 앰플", "세라마이드 보습 크림", "판테놀 수분 에센스"],
    "자외선":   ["선크림 SPF50 PA++++", "징크옥사이드 선세럼", "무기자차 선크림"],
}

async def _naver_product_recommend(search_concerns: list[str], raw_concerns: list[str]) -> list[dict]:
    """피부 고민 기반 네이버 쇼핑 추천 — 실제 구매 가능 제품 + 이미지/가격/링크 포함."""
    client_id = os.getenv("NAVER_CLIENT_ID", "")
    secret    = os.getenv("NAVER_CLIENT_SECRET", "")
    if not client_id or not secret:
        return []

    import httpx
    import re as _re

    queries: list[str] = []
    used: set[str] = set()
    for concern in (search_concerns + raw_concerns):
        for key, qs in _CONCERN_SEARCH_QUERIES.items():
            if key in concern and key not in used:
                queries.extend(qs)
                used.add(key)
    if not queries:
        queries = ["수분 히알루론산 세럼", "진정 약산성 토너", "보습 크림"]

    products: list[dict] = []
    seen: set[str] = set()
    match_scores = [92, 87, 83]

    async with httpx.AsyncClient(timeout=6.0) as hc:
        for query in queries:
            if len(products) >= 3:
                break
            try:
                resp = await hc.get(
                    "https://openapi.naver.com/v1/search/shop.json",
                    params={"query": query, "display": 5, "sort": "sim"},
                    headers={"X-Naver-Client-Id": client_id, "X-Naver-Client-Secret": secret},
                )
                if resp.status_code != 200:
                    continue
                for it in resp.json().get("items", []):
                    if len(products) >= 3:
                        break
                    title = _re.sub(r'<[^>]+>', '', it.get("title", ""))
                    dedup_key = title[:18]
                    if dedup_key in seen:
                        continue
                    seen.add(dedup_key)
                    lp = it.get("lprice", "")
                    price_str = f"₩{int(lp):,}" if lp and str(lp).isdigit() else ""
                    tag_keys = list(used)[:2] if used else raw_concerns[:2]
                    rank = len(products) + 1
                    products.append({
                        "brand":  it.get("brand", ""),
                        "name":   title,
                        "match":  match_scores[len(products)],
                        "tags":   tag_keys,
                        "reason": (
                            f"[{rank}순위 추천] · "
                            f"피부 고민 '{', '.join(tag_keys)}' 맞춤 선정 · "
                            f"{query} · "
                            f"사용법: 세안 후 스킨케어 단계에서 적정량 사용. 처음 사용 시 소량으로 피부 반응 확인 후 사용하세요."
                        ),
                        "price":  price_str,
                        "image":  it.get("image", ""),
                        "link":   it.get("link", ""),
                        "shot":   it.get("image", ""),
                    })
            except Exception:
                logger.exception("네이버 제품 추천 쿼리 오류: %s", query)

    return products

_CORP_RE = __import__('re').compile(r'\(주\)|\(주식회사\)|㈜|주식회사\s*')

def _clean_brand(brand: str) -> str:
    """식약처 법인명에서 (주) 등 법인 표기 제거 → 소비자 브랜드명."""
    return _CORP_RE.sub('', brand).strip()

async def _naver_shop(query: str, client_id: str, secret: str):
    import httpx
    async with httpx.AsyncClient(timeout=4.0) as hc:
        resp = await hc.get(
            "https://openapi.naver.com/v1/search/shop.json",
            params={"query": query, "display": 1, "sort": "sim"},
            headers={"X-Naver-Client-Id": client_id, "X-Naver-Client-Secret": secret},
        )
    if resp.status_code != 200:
        return None
    items = resp.json().get("items", [])
    return items[0] if items else None

@app.get("/api/product/search")
async def product_search(q: str, brand: str = ""):
    """네이버 쇼핑 API로 제품 이미지·가격 조회.
    brand+name 검색 실패 시 name 단독으로 재시도."""
    client_id = os.getenv("NAVER_CLIENT_ID", "")
    secret    = os.getenv("NAVER_CLIENT_SECRET", "")
    if not client_id or not secret:
        return {"image": None, "price": None, "link": None}
    try:
        import re as _re

        clean_brand = _clean_brand(brand) if brand else ""
        # 1차: 정제된 브랜드명 + 제품명
        item = await _naver_shop(
            (clean_brand + " " + q).strip() if clean_brand else q,
            client_id, secret,
        )
        # 2차: 제품명만으로 재시도 (1차 실패 or 브랜드 포함 쿼리였을 때)
        if not item and clean_brand:
            item = await _naver_shop(q, client_id, secret)

        if not item:
            return {"image": None, "price": None, "link": None}

        lp = item.get("lprice", "")
        price_str = f"₩{int(lp):,}" if lp and str(lp).isdigit() else None
        return {
            "image": item.get("image"),
            "price": price_str,
            "link":  item.get("link"),
            "title": _re.sub(r'<[^>]+>', '', item.get("title", "")),
        }
    except Exception:
        logger.exception("네이버 쇼핑 API 오류")
        return {"image": None, "price": None, "link": None}


@app.get("/api/ingredient/{name}")
async def ingredient_detail(name: str):
    info = await _ingredient_info(name)
    return info


class ClinicRequest(BaseModel):
    mode: str = "auto"
    budget: str = ""
    selected_treatments: list[str] = []
    analysis_data: dict | None = None


@app.post("/api/clinic/recommend")
async def clinic_recommend(req: ClinicRequest, authorization: str | None = Header(default=None)):
    client = _claude_client()

    # 피부 속성 텍스트 구성
    attrs = []
    skin_label = ""
    if req.analysis_data:
        attrs = req.analysis_data.get("attributes", [])
        skin_label = req.analysis_data.get("skin_type_label", "")

    attr_text = (
        ", ".join(
            f"{a['name']} {a['value']}({'높음' if a['level']=='hi' else '낮음' if a['level']=='lo' else '보통'})"
            for a in attrs
        )
        if attrs else "피부 데이터 없음 (일반 추천)"
    )

    treatment_text = (
        f"관심 시술: {', '.join(req.selected_treatments)}"
        if req.selected_treatments
        else "관심 시술 없음 (피부 상태 기반 자동 추천)"
    )

    # Claude 없을 때 폴백
    if not client:
        return {
            "summary": f"예산 {req.budget} 기준으로 피부 상태({skin_label or '일반'})에 적합한 시술을 안내합니다. 아래 추천 시술을 참고하시고 전문 피부과 의사와 상담하세요.",
            "treatments": [
                {"name": "레이저 토닝", "priority": "우선 추천", "reason": "색소 및 피부결 개선에 효과적이며 부작용이 낮습니다.", "effect": "잡티·칙칙함 완화, 피부 톤 균일", "caution": "시술 후 자외선 차단 필수", "price_range": "5~15만원", "interval": "2~4주 간격"},
                {"name": "스킨부스터", "priority": "보조 추천", "reason": "수분 공급과 피부 장벽 강화에 효과적입니다.", "effect": "즉각적인 수분감·광채", "caution": "시술 당일 세안 자제", "price_range": "10~25만원", "interval": "4~6주 간격"},
            ],
            "order_plan": "1단계: 레이저 토닝으로 피부 기저 개선 → 2단계: 스킨부스터로 수분·장벽 강화. 두 시술은 같은 날 병행 가능하나, 처음이라면 1~2주 간격을 두고 반응을 확인하세요.",
            "aftercare": [
                "시술 후 2주간 직사광선 노출을 최소화하고 SPF50 이상 자외선 차단제를 꼼꼼히 사용하세요.",
                "고함량 비타민C, 레티놀, AHA/BHA 등 자극성 성분은 시술 후 1주일간 사용을 자제하세요.",
                "시술 부위를 손으로 만지거나 세게 문지르지 마세요.",
                "충분한 수분 섭취와 충분한 수면이 회복을 돕습니다.",
            ],
        }

    try:
        prompt = f"""피부과 시술 정보 안내 AI입니다. 아래 정보 기반으로 반드시 유효한 JSON만 출력하세요.

피부속성: {attr_text}
피부타입: {skin_label or '분석없음'}
예산: {req.budget}
{treatment_text}

규칙: 의료 진단·처방 금지. 정보 제공 목적. 예산 내 최대 2개 시술 추천.

{{"summary":"피부상태와예산고려한방향(2문장)","treatments":[{{"name":"시술명","priority":"우선추천","reason":"이피부에맞는이유(2문장)","effect":"기대효과","caution":"주의사항","price_range":"가격대","interval":"시술간격"}}],"order_plan":"시술순서및단계접근(3문장,과시술방지포함)","aftercare":["관리팁1","관리팁2","관리팁3"]}}

위 JSON 구조를 지키되 값만 한국어로 채워서 출력하세요."""

        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        import re
        text = msg.content[0].text.strip()
        # JSON 블록 추출 (```json ... ``` 포함 대응)
        m = re.search(r"```(?:json)?\s*(\{[\s\S]+?\})\s*```", text)
        if m:
            text = m.group(1)
        else:
            m2 = re.search(r"\{[\s\S]+\}", text)
            if m2:
                text = m2.group()
        return json.loads(text)
    except Exception as e:
        logger.warning("clinic recommend 오류: %s", e)
        raise HTTPException(status_code=500, detail="시술 추천 생성 실패")


_FRONTEND_DIR = Path(__file__).parent.parent / "design"
if _FRONTEND_DIR.exists():
    from fastapi.responses import FileResponse
    from fastapi import Request as _Req

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str, request: _Req):
        target = _FRONTEND_DIR / (full_path or "index.html")
        if not target.exists() or target.is_dir():
            target = _FRONTEND_DIR / "index.html"
        resp = FileResponse(str(target))
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return resp
