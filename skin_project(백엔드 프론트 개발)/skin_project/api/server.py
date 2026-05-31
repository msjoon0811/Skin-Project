"""FastAPI 서버 - React 프론트엔드(design/)와 Python 백엔드(src/)를 연결.

실행:
    python -m uvicorn api.server:app --reload

프론트엔드: http://localhost:8000
API:
    POST /api/analyze    이미지(필수) + 폼 -> 분석 결과
    GET  /api/history    최근 분석 기록
"""

import io
import json
import os
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

# .env 파일 로드 (ANTHROPIC_API_KEY 등)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Skin Analysis API", version="0.2")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_model = None
_search_engine = None
_ml_ok: Optional[bool] = None


def _check_ml() -> bool:
    global _ml_ok
    if _ml_ok is None:
        try:
            import torch  # noqa: F401
            _ml_ok = True
        except Exception:
            _ml_ok = False
    return _ml_ok


def _get_model():
    global _model
    if _model is None:
        import torch
        from src.data.aihub_loader import MULTITASK_TARGETS
        from src.models.cnn import MultiTaskSkinModel
        _model = MultiTaskSkinModel(targets=MULTITASK_TARGETS)
        ckpt = next(
            (p for p in [
                Path("checkpoints/multitask_v2_best.pth"),
                Path("checkpoints/multitask_best.pth"),
            ] if p.exists()),
            None,
        )
        if ckpt:
            _model.load_state_dict(torch.load(ckpt, map_location="cpu"))
        _model.eval()
    return _model


def _get_search():
    global _search_engine
    if _search_engine is None:
        from src.recommend.product_search import FunctionalProductSearch
        _search_engine = FunctionalProductSearch()
    return _search_engine


def _run_inference(img_bytes: bytes) -> dict:
    """이미지 바이트 -> 정규화된 속성 점수(0~100) dict."""
    import torch
    from PIL import Image
    from torchvision import transforms
    from src.utils.face_crop import FACEPART_TARGETS, crop_faceparts
    from src.recommend.ingredient_map import normalize_cnn_output

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    model = _get_model()
    crops = crop_faceparts(img)
    raw: dict[str, int] = {}
    for part, targets in FACEPART_TARGETS.items():
        crop_img = crops.get(part, img)
        tensor = transform(crop_img).unsqueeze(0)
        with torch.no_grad():
            outputs = model(tensor)
        for t in targets:
            raw[t] = int(torch.argmax(outputs[t], dim=1).item())
    return normalize_cnn_output(raw)


# ── 속성 변환 테이블 ──────────────────────────────────────────────────

_SKIN_TYPE_OIL: dict[str, int] = {
    "지성": 78, "복합지성": 70, "복합성": 62,
    "중성": 50, "복합건성": 45, "민감성": 40, "건성": 18,
}

# 폼 민감도 질문 값 -> sens 점수 (버그 수정: 기존 "매우 민감/민감" 키 -> 실제 폼 값)
_FORM_SENS_SCORE: dict[str, int] = {
    "거의 없음": 15,
    "가끔":      35,
    "자주":      65,
    "매번":      85,
}

# 폼 민감도 값 -> 성분 추천 클래스 (0=보통, 1=민감)
_FORM_SENSITIVITY_CLASS: dict[str, int] = {
    "거의 없음": 0,
    "가끔":      0,
    "자주":      1,
    "매번":      1,
}

_ATTR_DESC: dict[str, dict[str, str]] = {
    "oil":     {"hi": "T존 중심 과다 분비",      "mid": "적정 유분 유지",         "lo": "피지 분비 부족 - 건조 주의"},
    "hydro":   {"hi": "수분 충분히 유지됨",       "mid": "보통 수준 수분 함량",    "lo": "각질층 수분 부족"},
    "sens":    {"hi": "홍반 반응 확인됨",          "mid": "약간의 민감 반응",       "lo": "민감도 낮음"},
    "pigment": {"hi": "광대뼈 부위 멜라닌 집중",  "mid": "국소적 색소침착",        "lo": "색소침착 낮음"},
    "wrinkle": {"hi": "이마/눈가 주름 선명",      "mid": "중간 단계 주름",         "lo": "경미한 잔주름"},
    "pore":    {"hi": "코/볼 부위 확장",          "mid": "부분적 모공 확장",       "lo": "모공 거의 보이지 않음"},
    "tone":    {"hi": "피부 처짐/불균일 두드러짐","mid": "국소적 불균일",          "lo": "균일한 피부 톤"},
}


def _level(v: float) -> str:
    if v >= 65: return "hi"
    if v >= 35: return "mid"
    return "lo"


# ── 생활습관 가중치 테이블 ────────────────────────────────────────────
# CNN 속성(wrinkle/pigmentation/pore/dryness/sagging)에 대한 델타
# sens_boost  : 폼 기반 sens 점수에 추가 가산
# oil_boost   : 폼 기반 oil 점수에 추가 가산

_LIFESTYLE_MODIFIERS: dict[str, dict[str, dict[str, float]]] = {
    "drinking": {
        "자주 (주 1회+)":  {"dryness": 12, "pigmentation": 8},
        "가끔 (월 1-2회)": {"dryness":  5, "pigmentation": 3},
    },
    "smoking": {
        "흡연": {"wrinkle": 15, "pigmentation": 10, "sagging": 8},
    },
    "cleansing": {
        "자주 빠짐": {"pore": 15, "sens_boost": 10},
        "가끔 빠짐": {"pore":  8, "sens_boost":  5},
    },
    "hormone": {
        "생리 전후 예민함": {"sens_boost": 12, "pigmentation":  5},
        "스트레스 심함":    {"sens_boost": 15, "pigmentation":  8},
        "임신 중":          {"pigmentation": 15, "sens_boost":  10},
    },
    "gut": {
        "자주 있음": {"sens_boost": 10, "pigmentation": 8},
        "가끔 있음": {"sens_boost":  5, "pigmentation": 3},
    },
    "sleep": {
        "<5h": {"dryness": 15, "sagging": 10, "sens_boost": 10},
        "5-6": {"dryness":  8, "sagging":  5, "sens_boost":  5},
        "6-7": {},
        "7-8": {},
        "8+":  {"dryness": -5},
    },
    "water": {
        "부족 (<4잔)": {"dryness": 18},
        "보통 (4-6잔)": {"dryness": 5},
        "충분 (6잔+)":  {"dryness": -5},
    },
    "heat": {
        "자주 (사우나/찜질)": {"sens_boost": 15, "pore": 8},
        "가끔 (뜨거운 샤워)": {"sens_boost":  5, "pore": 3},
    },
    "pollution": {
        "높음 (도심/야외)": {"pore": 10, "pigmentation": 8},
        "보통":             {"pore":  3},
    },
    "sweat": {
        "많음 (운동/야외)": {"pore": 10, "sens_boost": 8},
        "보통":             {},
    },
    "diet": {
        "둘 다":             {"oil_boost": 15, "pore": 10},
        "야식 자주":         {"oil_boost": 10, "pore":  8},
        "정제탄수화물 자주": {"oil_boost":  8, "pore":  5},
    },
}

_LIFESTYLE_CAP = 20.0  # 단일 속성 최대 조정폭


def _compute_lifestyle_deltas(form: dict) -> dict[str, float]:
    """폼 생활습관 항목 -> 각 속성 누적 델타 (이미지 결과 보조 역할)."""
    deltas: dict[str, float] = {}
    keys = ["drinking", "smoking", "cleansing", "hormone", "gut",
            "sleep", "water", "heat", "pollution", "sweat", "diet"]
    for key in keys:
        val = form.get(key, "")
        if not val:
            continue
        for attr, delta in _LIFESTYLE_MODIFIERS.get(key, {}).get(val, {}).items():
            deltas[attr] = deltas.get(attr, 0.0) + delta

    # 속성별 캡 적용 (생활습관이 이미지 결과를 과도하게 뒤집지 않도록)
    for attr in list(deltas.keys()):
        deltas[attr] = max(-_LIFESTYLE_CAP, min(_LIFESTYLE_CAP, deltas[attr]))
    return deltas


def _build_frontend_attrs(cnn: dict, form: dict, lifestyle_deltas: dict) -> list[dict]:
    """이미지 CNN 점수 + 폼 + 생활습관 델타 -> 프론트엔드 7개 속성."""
    skin_type  = form.get("skinType", form.get("skin_type", ""))
    sensitivity = form.get("sensitivity", "거의 없음")

    # 유분: 폼 기반 + 식습관 보정
    oil = float(_SKIN_TYPE_OIL.get(skin_type, 50))
    oil = max(0.0, min(100.0, oil + lifestyle_deltas.get("oil_boost", 0.0)))

    # 수분: CNN dryness 반전 + 수면/수분섭취 보정
    hydro = max(0.0, min(100.0,
        100.0 - cnn.get("dryness", 50.0) - lifestyle_deltas.get("dryness", 0.0)
    ))

    # 민감도: 폼 기반(고정 버그 수정) + 생활습관 sens_boost
    sens_base = float(_FORM_SENS_SCORE.get(sensitivity, 35))
    sens = max(0.0, min(100.0, sens_base + lifestyle_deltas.get("sens_boost", 0.0)))

    # 나머지: CNN 직접 + 생활습관 델타
    pigment = round(max(0.0, min(100.0,
        cnn.get("pigmentation", 50.0) + lifestyle_deltas.get("pigmentation", 0.0)
    )), 1)
    wrinkle = round(max(0.0, min(100.0,
        cnn.get("wrinkle", 30.0) + lifestyle_deltas.get("wrinkle", 0.0)
    )), 1)
    pore = round(max(0.0, min(100.0,
        cnn.get("pore", 50.0) + lifestyle_deltas.get("pore", 0.0)
    )), 1)
    tone = round(max(0.0, min(100.0,
        100.0 - cnn.get("sagging", 30.0) - lifestyle_deltas.get("sagging", 0.0)
    )), 1)

    entries = [
        ("oil",     "유분",     "OIL", round(oil, 1)),
        ("hydro",   "수분",     "HYD", round(hydro, 1)),
        ("sens",    "민감도",   "SEN", round(sens, 1)),
        ("pigment", "색소침착", "PIG", pigment),
        ("wrinkle", "주름",     "WRK", wrinkle),
        ("pore",    "모공",     "POR", pore),
        ("tone",    "톤 균일도","TON", tone),
    ]
    result = []
    for key, name, short, val in entries:
        lv = _level(val)
        result.append({
            "key":   key,
            "name":  name,
            "short": short,
            "value": int(round(val)),
            "max":   100,
            "level": lv,
            "desc":  _ATTR_DESC[key][lv],
        })
    return result


def _composite_score(fe_attrs: list[dict]) -> int:
    problem = {"oil", "sens", "pigment", "wrinkle", "pore"}
    good    = {"hydro", "tone"}
    p_avg = sum(a["value"] for a in fe_attrs if a["key"] in problem) / len(problem)
    g_avg = sum(a["value"] for a in fe_attrs if a["key"] in good) / len(good)
    return max(0, min(100, round(g_avg * 0.4 + (100 - p_avg) * 0.6)))


def _skin_type_label(fe_attrs: list[dict], form: dict) -> str:
    am = {a["key"]: a["level"] for a in fe_attrs}
    parts = []
    if am.get("hydro") == "lo":
        parts.append("건성")
    elif am.get("oil") == "hi" and am.get("hydro") in ("lo", "mid"):
        parts.append("복합성")
    elif am.get("oil") == "hi":
        parts.append("지성")
    else:
        parts.append(form.get("skinType", "중성"))
    if am.get("sens") in ("hi", "mid"):
        parts.append("민감성")
    if am.get("oil") == "hi":
        parts.append("T존 지성")
    return " + ".join(dict.fromkeys(parts))


# ── 성분 메타 데이터 ──────────────────────────────────────────────────

_REC_META: dict[str, dict] = {
    "히알루론산":       {"tag": "저분자 보습",  "why": "각질층 수분 보충 - 수분 부족 핵심 성분"},
    "세라마이드":       {"tag": "장벽",          "why": "피부 장벽 강화로 수분 손실 방지"},
    "글리세린":         {"tag": "보습",           "why": "수분 흡착 보조 보습제"},
    "스쿠알란":         {"tag": "에몰리언트",     "why": "건조 피부 유연성 보완"},
    "판테놀":           {"tag": "진정·보습",      "why": "민감도 대응 - 장벽 회복 보조"},
    "비타민C":          {"tag": "미백·항산화",    "why": "색소침착 개선 + 콜라겐 합성 촉진"},
    "알부틴":           {"tag": "미백",           "why": "멜라닌 생성 억제"},
    "트라넥삼산":       {"tag": "미백",           "why": "멜라노사이트 활성 억제"},
    "나이아신아마이드": {"tag": "미백·진정",      "why": "피지 조절 + 색소침착 개선 식약처 고시 성분"},
    "레티놀":           {"tag": "주름개선",       "why": "세포 재생 촉진 - 주름·탄력 개선"},
    "펩타이드":         {"tag": "탄력",           "why": "콜라겐 합성 촉진"},
    "아데노신":         {"tag": "주름개선",       "why": "식약처 고시 주름개선 성분"},
    "살리실산":         {"tag": "모공·여드름",    "why": "각질 용해 + 피지 과다 대응"},
    "AHA":              {"tag": "각질·모공",      "why": "각질 박리로 모공 정리"},
    "센텔라아시아티카": {"tag": "진정",           "why": "홍반·민감 피부 진정"},
    "마데카소사이드":   {"tag": "진정",           "why": "상처 회복 + 진정 효과"},
    "알란토인":         {"tag": "진정",           "why": "자극 완화 + 피부 회복"},
    "티트리":           {"tag": "여드름",         "why": "항균 작용으로 여드름 완화"},
    "벤조일퍼옥사이드":{"tag": "여드름",         "why": "여드름 균 직접 억제"},
    "콜라겐":           {"tag": "탄력",           "why": "피부 탄력 보조"},
}

_AVOID_META: dict[str, dict] = {
    "에탄올":           {"tag": "자극",       "why": "민감 피부 - 장벽 손상 위험"},
    "알코올":           {"tag": "자극",       "why": "민감 피부 - 장벽 손상 위험"},
    "SD알코올":         {"tag": "자극",       "why": "민감 피부 - 장벽 손상 위험"},
    "향료":             {"tag": "알러지",     "why": "홍반 반응 확인 - 회피 권장"},
    "프래그런스":       {"tag": "알러지",     "why": "홍반·알러지 반응 유발 가능"},
    "퍼퓸":             {"tag": "알러지",     "why": "홍반·알러지 반응 유발 가능"},
    "티트리오일":       {"tag": "자극",       "why": "고농도 사용 시 자극 가능"},
    "라벤더오일":       {"tag": "알러지",     "why": "에센셜오일 알러지 반응 가능"},
    "페퍼민트오일":     {"tag": "자극",       "why": "점막·민감 피부 자극"},
    "로즈오일":         {"tag": "알러지",     "why": "에센셜오일 알러지 반응 가능"},
    "메틸파라벤":       {"tag": "방부제",     "why": "파라벤 알러지 반응 가능"},
    "에틸파라벤":       {"tag": "방부제",     "why": "파라벤 알러지 반응 가능"},
    "프로필파라벤":     {"tag": "방부제",     "why": "파라벤 알러지 반응 가능"},
    "부틸파라벤":       {"tag": "방부제",     "why": "파라벤 알러지 반응 가능"},
    "레티놀":           {"tag": "임신 금기",  "why": "임신 중 사용 금지 성분"},
    "레틴산":           {"tag": "임신 금기",  "why": "임신 중 사용 금지 성분"},
    "살리실산":         {"tag": "임신 주의",  "why": "임신 중 과량 사용 주의"},
    "벤조일퍼옥사이드":{"tag": "임신 주의",  "why": "임신 중 사용 주의 성분"},
}


def _enrich_rec(names: list[str]) -> list[dict]:
    return [{"name": n, **_REC_META.get(n, {"tag": "성분", "why": "피부 개선에 도움"})} for n in names]


def _enrich_avoid(names: list[str]) -> list[dict]:
    return [{"name": n, **_AVOID_META.get(n, {"tag": "주의", "why": "피부 자극 가능"})} for n in names]


# ── Claude API 설명 생성 ──────────────────────────────────────────────

async def _generate_explanation(
    fe_attrs: list[dict],
    form: dict,
    lifestyle_deltas: dict,
    rec_names: list[str],
    avoid_names: list[str],
) -> str | None:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return None
    try:
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=api_key)

        attr_text = ", ".join(
            f"{a['name']} {a['value']}({'높음' if a['level']=='hi' else '낮음' if a['level']=='lo' else '보통'})"
            for a in fe_attrs
        )
        concerns_text = ", ".join(form.get("concerns", [])) or "없음"
        rec_text = ", ".join(rec_names[:3]) or "없음"

        # 유의미한 생활습관 요인만 추출 (기본값 제외)
        neutral = {"안 함", "비흡연", "매일 함", "없음", "해당 없음",
                   "충분 (6잔+)", "7-8", "8+", "낮음 (주로 실내)", "적음", "보통"}
        lifestyle_flags = [
            v for k in ["drinking","smoking","cleansing","hormone","gut",
                        "sleep","water","heat","pollution","sweat","diet"]
            if (v := form.get(k,"")) and v not in neutral
        ]
        lifestyle_text = ", ".join(lifestyle_flags) or "특이 항목 없음"

        prompt = f"""피부 AI 분석 결과를 바탕으로 3문장 이내의 개인화된 한국어 설명을 작성해주세요.

이미지 분석 결과: {attr_text}
주요 피부 고민: {concerns_text}
생활습관 특이사항: {lifestyle_text}
권장 성분 Top 3: {rec_text}

규칙:
- 이미지에서 가장 눈에 띄는 피부 상태 1가지 언급
- 생활습관 특이사항이 있으면 피부와의 연관성 자연스럽게 연결
- 가장 먼저 시도할 케어 방향 1가지 제안
- 친근하고 쉬운 말투, 전문용어 최소화
- 의료적 진단이 아닌 참고 정보임을 자연스럽게 표현"""

        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception:
        return None


# ── 엔드포인트 ───────────────────────────────────────────────────────

@app.post("/api/analyze")
async def analyze(
    image: Optional[UploadFile] = File(None),
    form_data: str = Form(...),
):
    from src.recommend.ingredient_map import (
        get_avoid_ingredients,
        get_recommended_ingredients,
    )
    from src.recommend.explainer import build_skin_summary, explain_recommendation

    form: dict = json.loads(form_data)

    # ① CNN 추론 (이미지 필수 - 프론트에서 강제)
    cnn_attrs: dict[str, float] = {}
    if image and _check_ml():
        contents = await image.read()
        try:
            cnn_attrs = _run_inference(contents)
        except Exception:
            pass

    # 이미지 추론 실패 시 폼 고민으로 최소 힌트 보완 (폴백)
    if not cnn_attrs:
        _CONCERN_HINT: dict[str, dict[str, float]] = {
            "건조함":   {"dryness": 70},
            "주름":     {"wrinkle": 70},
            "색소침착": {"pigmentation": 70},
            "모공":     {"pore": 70},
            "탄력저하": {"sagging": 70},
            "각질":     {"dryness": 60},
            "유분과다": {"dryness": 10},
        }
        for concern in form.get("concerns", []):
            for attr, val in _CONCERN_HINT.get(concern, {}).items():
                cnn_attrs[attr] = max(cnn_attrs.get(attr, 0.0), val)

    # ② 생활습관 델타 계산 (이미지 결과 보조)
    lifestyle_deltas = _compute_lifestyle_deltas(form)

    # ③ 프론트엔드 7-속성 + 종합 점수
    fe_attrs   = _build_frontend_attrs(cnn_attrs, form, lifestyle_deltas)
    composite  = _composite_score(fe_attrs)
    skin_label = _skin_type_label(fe_attrs, form)

    # ④ 성분 추천·회피 (sensitivity 버그 수정: 폼 실제 값 사용)
    sensitivity_class = _FORM_SENSITIVITY_CLASS.get(form.get("sensitivity", "거의 없음"), 0)
    # 생활습관으로 민감도가 높아진 경우 민감성 성분 추천 활성화
    if lifestyle_deltas.get("sens_boost", 0) >= 10:
        sensitivity_class = 1

    rec_names    = get_recommended_ingredients(cnn_attrs, sensitivity_class)
    allergy_raw  = form.get("allergies", "")
    allergy_list = [a.strip() for a in allergy_raw.split(",")
                    if a.strip() and a.strip() not in ("없음", "없어요", "해당없음")]
    is_pregnant  = form.get("hormone", "") == "임신 중" or form.get("pregnancy", "") != "해당 없음"
    avoid_names  = get_avoid_ingredients(allergy_list, is_pregnant)

    # ⑤ 제품 검색
    _CONCERN_NORMALIZE = {
        "민감/홍조": "홍조", "탄력저하": "탄력",
        "유분과다": "모공", "각질": "건조함",
    }
    raw_concerns: list[str] = form.get("concerns", [])
    search_concerns = [_CONCERN_NORMALIZE.get(c, c) for c in raw_concerns]

    products: list[dict] = []
    if search_concerns:
        try:
            df = _get_search().search(
                concerns=search_concerns,
                categories=[],
                is_pregnant=is_pregnant,
                top_k=3,
            )
            for _, row in df.iterrows():
                raw_score = float(row.get("점수", 1))
                match_pct = int(min(99, 75 + raw_score * 3))
                products.append({
                    "brand":  str(row.get("업체명", "")),
                    "name":   str(row.get("제품명", "")),
                    "match":  match_pct,
                    "tags":   raw_concerns[:2],
                    "reason": explain_recommendation(
                        cnn_attrs, sensitivity_class, rec_names, avoid_names, row["제품명"]
                    ),
                    "price": "",
                    "shot":  "",
                })
        except Exception:
            pass

    summary = build_skin_summary(cnn_attrs, sensitivity_class)

    # ⑥ Claude AI 설명 생성
    explanation = await _generate_explanation(
        fe_attrs, form, lifestyle_deltas, rec_names, avoid_names
    )

    return {
        "attributes":              fe_attrs,
        "composite_score":         composite,
        "skin_type_label":         skin_label,
        "summary":                 summary,
        "recommended_ingredients": _enrich_rec(rec_names),
        "avoid_ingredients":       _enrich_avoid(avoid_names),
        "products":                products,
        "ml_available":            _check_ml(),
        "explanation":             explanation,
    }


@app.get("/api/history")
def history():
    return {
        "items": [
            {"date": "2026 · 05 · 22", "label": "아침 분석 #14", "delta": "+4",  "up": True},
            {"date": "2026 · 05 · 15", "label": "주간 점검 #13", "delta": "+1",  "up": True},
            {"date": "2026 · 05 · 08", "label": "저녁 분석 #12", "delta": "-2",  "up": False},
            {"date": "2026 · 05 · 01", "label": "월간 리포트",   "delta": "+6",  "up": True},
        ]
    }


_FRONTEND_DIR = Path(__file__).parent.parent / "design"
if _FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="frontend")
