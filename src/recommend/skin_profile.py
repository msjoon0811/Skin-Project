"""CNN 출력 + 폼 + 생활습관 델타 → 프론트엔드 표시용 피부 프로필.

FastAPI 폼 민감도 스케일: "거의 없음" / "가끔" / "자주" / "매번"
(Streamlit 스케일 "매우 민감/민감/보통/둔감" 과 별개)
"""

# 피부 타입 문자열 → 유분 점수(0~100)
SKIN_TYPE_OIL: dict[str, int] = {
    "지성": 78, "복합지성": 70, "복합성": 62,
    "중성": 50, "복합건성": 45, "민감성": 40, "건성": 18,
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
    "tone":    {"hi": "피부 처짐/불균일 두드러짐", "mid": "국소적 불균일",           "lo": "균일한 피부 톤"},
}


def level(v: float) -> str:
    if v >= 65: return "hi"
    if v >= 35: return "mid"
    return "lo"


def build_frontend_attrs(
    cnn: dict,
    form: dict,
    lifestyle_deltas: dict,
) -> list[dict]:
    """CNN 5속성 + 폼 입력 + 생활습관 델타 → 프론트 표시용 7속성 리스트."""
    skin_type   = form.get("skinType", form.get("skin_type", ""))
    sensitivity = form.get("sensitivity", "거의 없음")

    oil   = max(0.0, min(100.0,
        float(SKIN_TYPE_OIL.get(skin_type, 50)) + lifestyle_deltas.get("oil_boost", 0.0)
    ))
    hydro = max(0.0, min(100.0,
        100.0 - cnn.get("dryness", 50.0) - lifestyle_deltas.get("dryness", 0.0)
    ))
    sens  = max(0.0, min(100.0,
        float(FORM_SENS_SCORE.get(sensitivity, 35)) + lifestyle_deltas.get("sens_boost", 0.0)
    ))
    pigment = max(0.0, min(100.0, cnn.get("pigmentation", 50.0) + lifestyle_deltas.get("pigmentation", 0.0)))
    wrinkle = max(0.0, min(100.0, cnn.get("wrinkle",      30.0) + lifestyle_deltas.get("wrinkle",      0.0)))
    pore    = max(0.0, min(100.0, cnn.get("pore",         50.0) + lifestyle_deltas.get("pore",         0.0)))
    tone    = max(0.0, min(100.0, 100.0 - cnn.get("sagging", 30.0) - lifestyle_deltas.get("sagging",   0.0)))

    entries = [
        ("oil",     "유분",     "OIL", oil),
        ("hydro",   "수분",     "HYD", hydro),
        ("sens",    "민감도",   "SEN", sens),
        ("pigment", "색소침착", "PIG", pigment),
        ("wrinkle", "주름",     "WRK", wrinkle),
        ("pore",    "모공",     "POR", pore),
        ("tone",    "톤 균일도","TON", tone),
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
    """7속성 → 종합 피부 점수 (0~100).

    raw 공식: g_avg×0.4 + (100-p_avg)×0.6
    raw는 0~100이지만 기본 폼값만으로도 58이 나와
    체감 점수와 괴리가 크다. 선형 보정으로 직관에 맞게 조정:
      raw 0  → 표시 30  (최악)
      raw 58 → 표시 70  (평균)
      raw 80 → 표시 84  (좋은 피부)
      raw 100→ 표시 98  (완벽)
    """
    problem = {"oil", "sens", "pigment", "wrinkle", "pore"}
    good    = {"hydro", "tone"}
    p_avg = sum(a["value"] for a in fe_attrs if a["key"] in problem) / len(problem)
    g_avg = sum(a["value"] for a in fe_attrs if a["key"] in good) / len(good)
    raw = g_avg * 0.4 + (100 - p_avg) * 0.6
    scaled = raw * 0.68 + 30
    return max(0, min(100, round(scaled)))


def skin_type_label(fe_attrs: list[dict], form: dict) -> str:
    """7속성 → 피부 타입 라벨 문자열."""
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
