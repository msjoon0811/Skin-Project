"""생활습관 입력 → 피부 속성 델타 계산.

폼에서 수집한 생활습관 항목을 CNN 속성 점수 보정에 사용.
sens_boost / oil_boost 키는 피부 민감도·유분에 가산.
"""

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
        "임신 중":          {"pigmentation": 15, "sens_boost": 10},
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
        "부족 (<4잔)":  {"dryness": 18},
        "보통 (4-6잔)": {"dryness":  5},
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

_LIFESTYLE_CAP = 20.0

_LIFESTYLE_KEYS = [
    "drinking", "smoking", "cleansing", "hormone", "gut",
    "sleep", "water", "heat", "pollution", "sweat", "diet",
]

_NEUTRAL_VALUES = {
    "안 함", "비흡연", "매일 함", "없음", "해당 없음",
    "충분 (6잔+)", "7-8", "8+", "낮음 (주로 실내)", "적음", "보통",
}


def compute_lifestyle_deltas(form: dict) -> dict[str, float]:
    """폼 생활습관 항목 → 각 속성 누적 델타 (±최대 20점). 배열 값도 처리."""
    deltas: dict[str, float] = {}
    for key in _LIFESTYLE_KEYS:
        raw = form.get(key, "")
        if not raw:
            continue
        vals = raw if isinstance(raw, list) else [raw]
        for val in vals:
            for attr, delta in _LIFESTYLE_MODIFIERS.get(key, {}).get(val, {}).items():
                deltas[attr] = deltas.get(attr, 0.0) + delta
    for attr in list(deltas.keys()):
        deltas[attr] = max(-_LIFESTYLE_CAP, min(_LIFESTYLE_CAP, deltas[attr]))
    return deltas


def significant_lifestyle_flags(form: dict) -> list[str]:
    """의미 있는 생활습관 항목 값만 추출 (Claude 설명 생성용). 배열 값도 처리."""
    result = []
    for k in _LIFESTYLE_KEYS:
        raw = form.get(k, "")
        if not raw:
            continue
        vals = raw if isinstance(raw, list) else [raw]
        for v in vals:
            if v and v not in _NEUTRAL_VALUES:
                result.append(v)
    return result
