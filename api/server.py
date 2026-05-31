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


_LOCAL_INGREDIENT_DB: dict[str, dict] = {
    "나이아신아마이드": {"description":"나이아신아마이드(비타민 B3)는 피부 장벽을 강화하고 멜라닌 전달을 억제해 미백 효과를 냅니다. 피지 분비 조절과 모공 축소에도 효과적이며, 자극이 적어 다양한 피부 타입에 사용할 수 있습니다.","benefits":["미백·색소침착 개선","모공 축소·피지 조절","피부 장벽 강화","항염 작용"],"concerns":["고농도(10% 이상) 사용 시 홍조 가능","처음엔 저농도부터 시작 권장"],"suitable_for":"지성, 복합성, 색소침착 피부","concentration":"2~10%","found_in":"토너, 앰플, 세럼, 크림"},
    "히알루론산": {"description":"히알루론산은 자기 무게의 1000배 이상 수분을 보유할 수 있는 천연 보습 성분입니다. 피부 수분막을 형성하고 탄력을 개선하며, 분자 크기에 따라 표피와 진피 모두에 작용합니다.","benefits":["강력한 수분 보습","피부 탄력 개선","자극 완화","피부 결 개선"],"concerns":["건조한 환경에서는 오히려 수분 빼앗길 수 있음","반드시 보습제와 함께 사용"],"suitable_for":"모든 피부 타입, 특히 건성·탈수성","concentration":"0.1~2%","found_in":"토너, 에센스, 세럼, 크림, 마스크"},
    "레티놀": {"description":"레티놀(비타민 A)은 피부 세포 재생을 촉진하고 콜라겐 합성을 늘려 주름과 탄력 개선에 효과적입니다. 각질 제거와 모공 정화에도 도움이 되며, 장기 사용 시 피부 톤 균일화에 기여합니다.","benefits":["주름·잔주름 개선","콜라겐 합성 촉진","피부 재생 가속","모공 정화"],"concerns":["초반 각질·건조·홍조 유발 가능","자외선 감수성 증가(야간 사용 권장)","임산부 사용 금지"],"suitable_for":"노화 피부, 주름·색소침착 고민","concentration":"0.025~1%","found_in":"세럼, 크림, 앰플(야간용)"},
    "세라마이드": {"description":"세라마이드는 피부 각질층을 구성하는 지질 성분으로, 세포 간 결합을 강화해 피부 장벽을 회복시킵니다. 수분 손실을 방지하고 외부 자극으로부터 피부를 보호하며, 민감성 피부 진정에 탁월합니다.","benefits":["피부 장벽 회복","수분 보유력 향상","자극 완화·진정","피부 유연성 개선"],"concerns":["민감성 피부는 소량부터 적용 권장"],"suitable_for":"건성, 민감성, 손상된 피부","concentration":"0.1~3%","found_in":"크림, 로션, 세럼, 토너, 에센스"},
    "살리실산": {"description":"살리실산(BHA)은 지용성 각질 제거 성분으로 모공 속 피지와 각질을 용해합니다. 항균·항염 작용으로 여드름 균을 억제하고, 모공을 청결하게 유지해 여드름성 피부에 효과적입니다.","benefits":["모공 각질 제거","피지 조절","항균·항염 작용","여드름 예방"],"concerns":["임산부 사용 주의","민감성 피부에 자극 가능","과다 사용 시 건조증 유발"],"suitable_for":"지성, 여드름성, 모공 고민 피부","concentration":"0.5~2%","found_in":"토너, 패드, 앰플, 클렌저"},
    "판테놀": {"description":"판테놀(비타민 B5)은 피부에서 판토텐산으로 전환되어 세포 재생과 피부 장벽 회복을 돕습니다. 보습력이 뛰어나고 자극이 거의 없어 민감한 피부에도 안전하게 사용할 수 있습니다.","benefits":["수분 공급·보습","피부 재생 촉진","진정·완화","피부 장벽 강화"],"concerns":["극도로 민감한 피부에서 드물게 자극 가능"],"suitable_for":"민감성, 건성, 자극받은 피부","concentration":"0.5~5%","found_in":"에센스, 크림, 로션, 마스크"},
    "비타민c": {"description":"비타민C(아스코르빅산)는 강력한 항산화 성분으로 멜라닌 생성을 억제해 미백 효과를 냅니다. 콜라겐 합성에 필수적인 조효소로 작용해 피부 탄력과 주름 개선에도 기여합니다.","benefits":["강력한 미백 효과","콜라겐 합성 촉진","항산화·항노화","피부 톤 균일화"],"concerns":["산화 안정성이 낮아 보관 주의","고농도 사용 시 자극 가능","자외선 감수성 증가"],"suitable_for":"색소침착, 노화, 칙칙한 피부","concentration":"5~20%","found_in":"세럼, 앰플, 에센스"},
    "아데노신": {"description":"아데노신은 세포 에너지 대사에 관여하는 성분으로, 피부 세포 재생을 촉진하고 콜라겐 생성을 늘려 주름을 완화합니다. 식약처 고시 주름 개선 기능성 원료로 인정받은 성분입니다.","benefits":["주름 개선·예방","피부 탄력 향상","세포 재생 촉진"],"concerns":["효과가 서서히 나타남(4~8주)","단독 사용보다 복합 케어 권장"],"suitable_for":"노화, 주름, 탄력 저하 피부","concentration":"0.04%","found_in":"크림, 세럼, 앰플"},
    "글리세린": {"description":"글리세린은 피부의 천연 보습인자(NMF)와 유사한 수분 흡수제로, 공기 중 수분을 끌어당겨 피부 표면에 수분막을 형성합니다. 안전성이 높아 거의 모든 제품에 기본 보습 원료로 사용됩니다.","benefits":["즉각적인 수분 공급","피부 유연성 향상","피부 장벽 보조"],"concerns":["단독 고농도 사용 시 끈적임"],"suitable_for":"모든 피부 타입","concentration":"5~30%","found_in":"토너, 에센스, 크림, 클렌저 등 대부분"},
    "병풀추출물": {"description":"병풀(센텔라 아시아티카) 추출물은 아시아티코사이드, 마데카소사이드 등 활성 성분이 피부 재생과 콜라겐 합성을 촉진합니다. 강력한 진정·항염 작용으로 민감성 피부와 손상 피부 회복에 탁월합니다.","benefits":["강력한 진정·항염","피부 재생 촉진","콜라겐 합성 지원","민감 피부 장벽 강화"],"concerns":["국화과 알레르기 있는 경우 주의"],"suitable_for":"민감성, 자극받은 피부, 트러블 피부","concentration":"0.1~5%","found_in":"세럼, 크림, 앰플, 마스크"},
}

async def _ingredient_info(name: str) -> dict:
    """성분 상세 정보 — 로컬 DB 우선, 없으면 Claude Haiku 조회."""
    # 캐시 확인 (빈 dict는 캐시 무시)
    if name in _ingredient_cache and _ingredient_cache[name]:
        return _ingredient_cache[name]

    # 로컬 DB 확인 (나이아신아마이드 등 주요 성분)
    local_key = name.lower().replace(" ", "").replace("-", "")
    for k, v in _LOCAL_INGREDIENT_DB.items():
        if k.lower().replace(" ", "") == local_key:
            _ingredient_cache[name] = v
            return v

    client = _claude_client()
    if not client:
        return {"description": f"'{name}' 성분 정보를 불러올 수 없습니다. ANTHROPIC_API_KEY를 설정하세요.", "benefits": [], "concerns": [], "suitable_for": "-", "found_in": "-"}

    try:
        prompt = f"""화장품 성분 '{name}'에 대해 아래 JSON 형식으로만 응답하세요 (마크다운 없이 순수 JSON만).

{{"description": "성분 개요 2-3문장 한국어", "benefits": ["효과1", "효과2", "효과3"], "concerns": ["주의사항1"], "suitable_for": "적합 피부 타입", "concentration": "일반 사용 농도", "found_in": "주로 쓰이는 제품 유형"}}"""
        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        import re
        text = msg.content[0].text.strip()
        # 마크다운 코드블록 제거
        text = re.sub(r"```[a-z]*\n?", "", text).strip()
        m = re.search(r"\{[\s\S]+\}", text)
        if m:
            result = json.loads(m.group())
            if result:  # 빈 dict는 캐싱하지 않음
                _ingredient_cache[name] = result
                return result
        return {"description": f"'{name}' 성분 정보를 가져오지 못했습니다.", "benefits": [], "concerns": [], "suitable_for": "-", "found_in": "-"}
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
        user = register_user(body.username, body.password)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    token = create_session(user["id"])
    return {"token": token, "user": {"id": user["id"], "username": user["email"]}}


@app.post("/api/login")
def api_login(body: AuthBody):
    user = login_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    token = create_session(user["id"])
    return {"token": token, "user": {"id": user["id"], "username": user["email"]}}


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
    # email 컬럼을 username으로 노출
    if "email" in user and "username" not in user:
        user = {**user, "username": user["email"]}
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

    # NaN/Inf → None 정리 (JSON 직렬화 오류 방지)
    import math
    def _sanitize(obj):
        if isinstance(obj, float):
            return None if (math.isnan(obj) or math.isinf(obj)) else obj
        if isinstance(obj, dict):
            return {k: _sanitize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_sanitize(v) for v in obj]
        return obj
    result = _sanitize(result)

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


