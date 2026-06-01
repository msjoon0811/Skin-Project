"""CNN 출력 + 폼 + 생활습관 델타 → 프론트엔드 표시용 피부 프로필.

FastAPI 폼 민감도 스케일: "거의 없음" / "가끔" / "자주" / "매번"
(Streamlit 스케일 "매우 민감/민감/보통/둔감" 과 별개)
"""

# 피부 타입 문자열 → 유분 점수(0~100)
SKIN_TYPE_OIL: dict[str, int] = {
    "지성": 78, "복합지성": 70, "복합성": 62,
    "중성": 50, "복합건성": 45, "민감성": 40, "건성": 18,
}

# 피부 타입 문자열 → 수분 기본값 (lip_dryness CNN 보정 전 기준)
SKIN_TYPE_HYDRO_BASE: dict[str, float] = {
    "건성": 28.0, "복합건성": 38.0, "민감성": 42.0,
    "중성": 62.0, "복합성": 55.0, "복합지성": 50.0, "지성": 45.0,
}

# FastAPI 폼 민감도 → 점수
FORM_SENS_SCORE: dict[str, int] = {
    "거의 없음": 15, "가끔": 35, "자주": 65, "매번": 85,
}

# FastAPI 폼 민감도 → 성분 추천 클래스 (0=보통, 1=민감)
FORM_SENSITIVITY_CLASS: dict[str, int] = {
    "거의 없음": 0, "가끔": 0, "자주": 1, "매번": 1,
}


ATTR_DESC: dict[str, dict[str, str]] = {
    "oil":     {"hi": "T존 중심 과다 분비",       "mid": "적정 유분 유지",          "lo": "피지 분비 부족 - 건조 주의"},
    "hydro":   {"hi": "수분 충분히 유지됨",        "mid": "보통 수준 수분 함량",     "lo": "각질층 수분 부족"},
    "sens":    {"hi": "홍반 반응 확인됨",           "mid": "약간의 민감 반응",        "lo": "민감도 낮음"},
    "pigment": {"hi": "광대뼈 부위 멜라닌 집중",   "mid": "국소적 색소침착",         "lo": "색소침착 낮음"},
    "wrinkle": {"hi": "이마/눈가 주름 선명",       "mid": "중간 단계 주름",          "lo": "경미한 잔주름"},
    "pore":    {"hi": "코/볼 부위 확장",           "mid": "부분적 모공 확장",        "lo": "모공 거의 보이지 않음"},
    "acne":    {"hi": "복합성 염증성 병변 확인",   "mid": "경증 여드름 또는 트러블", "lo": "여드름 거의 없음"},
}


def level(v: float) -> str:
    if v >= 65: return "hi"
    if v >= 35: return "mid"
    return "lo"


def _parse_concerns(form: dict) -> list[str]:
    """form dict에서 concerns 리스트 추출 (배열/문자열 모두 처리)."""
    raw = form.get("concerns", [])
    if isinstance(raw, list):
        return raw
    return [c.strip() for c in str(raw).split(",") if c.strip()]


def build_frontend_attrs(
    cnn: dict,
    form: dict,
    lifestyle_deltas: dict,
) -> list[dict]:
    """CNN 속성 + 폼 입력 + 생활습관 델타 → 프론트 표시용 7속성 리스트.

    폼 보정 원칙:
    - 주름: 사용자가 '주름' 고민 선택 안 하면 CNN 과다예측 cap
    - 여드름: 고민 선택 여부로 false positive/negative 보정
    - 수분: 피부타입 기반 베이스 + CNN 소폭 보정 + 건조함 concern
    """
    skin_type   = form.get("skinType", form.get("skin_type", ""))
    sensitivity = form.get("sensitivity", "거의 없음")
    concerns    = _parse_concerns(form)

    # ── 유분 ──────────────────────────────────────────────────────────
    oil = max(0.0, min(100.0,
        float(SKIN_TYPE_OIL.get(skin_type, 50)) + lifestyle_deltas.get("oil_boost", 0.0)
    ))

    # ── 수분 (피부타입 기반 + CNN lip_dryness 소폭 보정) ──────────────
    hydro_base  = SKIN_TYPE_HYDRO_BASE.get(skin_type, 55.0)
    # lip_dryness: 0=촉촉→+12, 50=중립→0, 100=건조→-12
    dryness_cnn = cnn.get("dryness", 50.0)
    hydro_base += (50.0 - dryness_cnn) * 0.24
    # 생활습관 보정 (water/sleep 등)
    hydro_base -= lifestyle_deltas.get("dryness", 0.0)
    # 건조함 고민 선택 → 수분 낮음 보장
    if "건조함" in concerns:
        hydro_base = min(hydro_base, 38.0)
    hydro = max(10.0, min(90.0, hydro_base))

    # ── 민감도 ────────────────────────────────────────────────────────
    sens = max(0.0, min(100.0,
        float(FORM_SENS_SCORE.get(sensitivity, 35)) + lifestyle_deltas.get("sens_boost", 0.0)
    ))

    # ── 색소침착 ──────────────────────────────────────────────────────
    pigment = max(0.0, min(100.0,
        cnn.get("pigmentation", 50.0) + lifestyle_deltas.get("pigmentation", 0.0)
    ))

    # ── 주름 (form 보정: 주름 고민 없으면 과다예측 cap) ───────────────
    wrinkle_raw = cnn.get("wrinkle", 20.0) + lifestyle_deltas.get("wrinkle", 0.0)
    if "주름" not in concerns:
        # 주름 고민 없는 사람: CNN 과다예측 가능성 → MID 상단으로 제한
        wrinkle_raw = min(wrinkle_raw, 52.0)
    wrinkle = max(0.0, min(100.0, wrinkle_raw))

    # ── 모공 ──────────────────────────────────────────────────────────
    pore = max(0.0, min(100.0,
        cnn.get("pore", 50.0) + lifestyle_deltas.get("pore", 0.0)
    ))

    # ── 여드름 (form 보정: false positive/negative 완화) ─────────────
    acne_cnn = cnn.get("acne", 0.0)
    if "여드름" not in concerns:
        # 여드름 고민 선택 안 함 → 경증 이하로 제한 (false positive 완화)
        acne_cnn = min(acne_cnn, 30.0)
    elif acne_cnn < 35:
        # 여드름 고민 선택했는데 CNN이 낮게 예측 → 경증 보장 (false negative 완화)
        acne_cnn = max(acne_cnn, 40.0)
    acne = max(0.0, min(100.0, acne_cnn + lifestyle_deltas.get("acne", 0.0)))

    entries = [
        ("oil",     "유분",     "OIL", oil),
        ("hydro",   "수분",     "HYD", hydro),
        ("sens",    "민감도",   "SEN", sens),
        ("pigment", "색소침착", "PIG", pigment),
        ("wrinkle", "주름",     "WRK", wrinkle),
        ("pore",    "모공",     "POR", pore),
        ("acne",    "여드름",   "ACN", acne),
    ]
    return [
        {
            "key":   k,
            "name":  name,
            "short": short,
            "value": int(round(v)),
            "max":   100,
            "level": level(v),
            "desc":  ATTR_DESC[k][level(v)],
        }
        for k, name, short, v in entries
    ]


def composite_score(fe_attrs: list[dict]) -> int:
    """육안 판단 3요소 중심 종합 피부 점수 (10~95).

    사람이 피부를 볼 때 가장 먼저 인식하는 순서로 가중치 설계:
      모공       (40%) - 피부결, 가장 직관적
      색소침착   (35%) - 잡티/기미, 매우 눈에 띔
      주름       (25%) - 나이 관련, 상대적으로 덜 직관적

    기준:
      나쁜 피부  → 20~30
      보통 피부  → 40~60
      좋은 피부  → 70~90
    """
    attr = {a["key"]: a["value"] for a in fe_attrs}

    wrinkle = attr.get("wrinkle", 20)
    pore    = attr.get("pore",    30)
    pigment = attr.get("pigment", 20)
    hydro   = attr.get("hydro",   55)
    acne    = attr.get("acne",     0)

    # 육안 3요소 가중 합산 (높을수록 나쁨)
    visible_bad = pore * 0.40 + pigment * 0.35 + wrinkle * 0.25

    base = 100.0 - visible_bad

    # 수분 소량 보너스
    base += (hydro - 50) * 0.10

    # acne 패널티 (여드름은 육안으로 가장 직접적)
    base -= acne * 0.25

    return max(10, min(95, round(base)))


def skin_type_label(fe_attrs: list[dict], form: dict) -> str:
    """속성 → 피부 타입 라벨 문자열."""
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
