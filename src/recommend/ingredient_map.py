"""
피부 속성 → 권장/회피 성분 매핑 테이블.
피부과 가이드라인 기반으로 직접 구축.
"""

from src.data.aihub_loader import ANNOTATION_MAX

HIGH_SCORE = 65  # 이 이상이면 집중 케어 성분 전체 추천
MID_SCORE  = 35  # 이 이상이면 기본 케어 성분 추천

ATTRIBUTE_TO_RECOMMENDED: dict[str, list[str]] = {
    # 집중 케어 (score >= 65)
    "dryness_high":      ["히알루론산", "세라마이드", "글리세린", "스쿠알란", "판테놀"],
    "pigmentation_high": ["비타민C", "알부틴", "트라넥삼산", "나이아신아마이드"],
    "wrinkle_high":      ["레티놀", "펩타이드", "비타민C", "아데노신"],
    "pore_high":         ["살리실산", "AHA", "나이아신아마이드"],
    "sagging_high":      ["펩타이드", "레티놀", "아데노신", "콜라겐"],
    # 기본 케어 (score >= 35, 자극 적은 성분 위주)
    "dryness_mid":       ["글리세린", "판테놀"],
    "pigmentation_mid":  ["나이아신아마이드"],
    "wrinkle_mid":       ["펩타이드", "아데노신"],
    "pore_mid":          ["나이아신아마이드"],
    "sagging_mid":       ["아데노신", "콜라겐"],
    # 폼 입력 전용
    "sensitive":         ["센텔라아시아티카", "판테놀", "마데카소사이드", "알란토인"],
    "acne_high":         ["살리실산", "티트리", "벤조일퍼옥사이드", "나이아신아마이드"],
}

ALLERGY_TO_AVOID: dict[str, list[str]] = {
    "알코올":    ["에탄올", "알코올", "SD알코올"],
    "향료":      ["향료", "프래그런스", "퍼퓸"],
    "에센셜오일": ["티트리오일", "라벤더오일", "페퍼민트오일", "로즈오일"],
    "파라벤":    ["메틸파라벤", "에틸파라벤", "프로필파라벤", "부틸파라벤"],
}

PREGNANCY_AVOID = ["레티놀", "레틴산", "살리실산", "벤조일퍼옥사이드"]


def normalize_cnn_output(raw_preds: dict) -> dict:
    """CNN 속성별 예측 클래스(0~N) → 0~100 정규화 점수.

    raw_preds 키: MULTITASK_TARGETS 중 일부
    반환 키: wrinkle, pigmentation, pore, dryness, sagging
    부위가 여러 개인 속성은 평균이 아닌 최대값(더 심한 부위 기준)으로 집계.
    """
    out: dict[str, float] = {}

    wrinkle_vals = [
        raw_preds[t] / ANNOTATION_MAX[t] * 100
        for t in ("forehead_wrinkle", "l_perocular_wrinkle")
        if t in raw_preds
    ]
    if wrinkle_vals:
        out["wrinkle"] = max(wrinkle_vals)

    pig_vals = [
        raw_preds[t] / ANNOTATION_MAX[t] * 100
        for t in ("forehead_pigmentation", "l_cheek_pigmentation")
        if t in raw_preds
    ]
    if pig_vals:
        out["pigmentation"] = max(pig_vals)

    if "l_cheek_pore" in raw_preds:
        out["pore"] = raw_preds["l_cheek_pore"] / ANNOTATION_MAX["l_cheek_pore"] * 100

    if "lip_dryness" in raw_preds:
        out["dryness"] = raw_preds["lip_dryness"] / ANNOTATION_MAX["lip_dryness"] * 100

    if "chin_sagging" in raw_preds:
        out["sagging"] = raw_preds["chin_sagging"] / ANNOTATION_MAX["chin_sagging"] * 100

    return out


# 연령대별 속성 점수 보정값 (추천 민감도 조정용)
_AGE_SCORE_BOOST: dict[str, dict[str, float]] = {
    "10대":     {"pore": 15},
    "20대":     {"pore": 10},
    "30대":     {},
    "40대":     {"wrinkle": 10, "sagging": 10},
    "50대 이상": {"wrinkle": 20, "sagging": 20, "pigmentation": 10},
}


def sensitivity_from_form(sensitivity_str: str) -> int:
    """Form 민감도 문자열 → 0(보통/둔감) / 1(민감/매우민감)."""
    return 1 if sensitivity_str in ("매우 민감", "민감") else 0


def get_recommended_ingredients(
    attributes: dict,
    form_sensitivity: int = 0,
    form_concerns: list[str] | None = None,
    age_group: str | None = None,
) -> list[str]:
    """정규화 속성 점수(0~100) + 폼 입력 → 우선순위 정렬된 권장 성분 리스트.

    - score >= 65: 집중 케어 성분 전체
    - score >= 35: 기본 케어 성분 (자극 적은 성분)
    - 결과는 관련 속성 점수 높은 순 정렬 (가장 시급한 고민 우선)
    - form_concerns: 폼에서 선택한 고민 목록 (여드름/트러블 처리용)
    - age_group: 연령대별 속성 점수 보정 적용
    """
    priority: dict[str, float] = {}  # 성분 → 최대 우선순위 점수

    # 연령대 보정 적용 (원본 dict 변경 방지)
    adj = dict(attributes)
    if age_group and age_group in _AGE_SCORE_BOOST:
        for attr, boost in _AGE_SCORE_BOOST[age_group].items():
            adj[attr] = min(100.0, max(0.0, adj.get(attr, 0) + boost))

    attr_map = {
        "dryness":      ("dryness_high",      "dryness_mid"),
        "pigmentation": ("pigmentation_high",  "pigmentation_mid"),
        "wrinkle":      ("wrinkle_high",       "wrinkle_mid"),
        "pore":         ("pore_high",          "pore_mid"),
        "sagging":      ("sagging_high",       "sagging_mid"),
    }

    for attr, (high_key, mid_key) in attr_map.items():
        score = adj.get(attr, 0)
        if score >= HIGH_SCORE:
            for ing in ATTRIBUTE_TO_RECOMMENDED[high_key]:
                priority[ing] = max(priority.get(ing, 0), score)
        elif score >= MID_SCORE:
            for ing in ATTRIBUTE_TO_RECOMMENDED[mid_key]:
                priority[ing] = max(priority.get(ing, 0), score)

    # CNN에 없는 여드름/트러블은 폼 고민에서 처리
    if form_concerns and any(c in form_concerns for c in ("여드름", "트러블")):
        for ing in ATTRIBUTE_TO_RECOMMENDED["acne_high"]:
            priority[ing] = max(priority.get(ing, 0), 70)

    # 홍조는 진정·민감 성분으로 처리
    if form_concerns and "홍조" in form_concerns:
        for ing in ATTRIBUTE_TO_RECOMMENDED["sensitive"]:
            priority[ing] = max(priority.get(ing, 0), 70)

    if form_sensitivity == 1:
        for ing in ATTRIBUTE_TO_RECOMMENDED["sensitive"]:
            priority[ing] = max(priority.get(ing, 0), 75)

    # 점수가 낮아 아무것도 안 잡힌 경우 → 피부 타입 무관 기본 케어 성분 보장
    if not priority:
        for ing in ["글리세린", "판테놀", "히알루론산"]:
            priority[ing] = 30

    return [ing for ing, _ in sorted(priority.items(), key=lambda x: -x[1])]


def get_avoid_ingredients(
    allergies: list[str],
    is_pregnant: bool = False,
) -> list[str]:
    """알레르기 목록 + 임신 여부 → 회피 성분 리스트."""
    avoid: set[str] = set()
    for allergy in allergies:
        avoid.update(ALLERGY_TO_AVOID.get(allergy, []))
    if is_pregnant:
        avoid.update(PREGNANCY_AVOID)
    return sorted(avoid)


# ── 성분 메타데이터 (태그 + 이유 설명) ──────────────────────────────

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


_CAUTION_META: dict[str, dict] = {
    "에탄올":           {"tag": "건성·민감 주의",  "why": "건성·민감 피부 장벽을 약화시킬 수 있어요. 고농도 제품 주의"},
    "향료":             {"tag": "민감성 주의",      "why": "민감성 피부에서 자극·홍조 반응이 나타날 수 있어요"},
    "살리실산":         {"tag": "건성 주의",        "why": "건성 피부에 고농도 사용 시 건조함을 심화시킬 수 있어요"},
    "AHA":              {"tag": "민감성 주의",      "why": "각질 박리 성분으로 민감한 날에는 사용량 조절 권장"},
    "레티놀":           {"tag": "초보자 주의",      "why": "처음 사용 시 소량부터 시작, 주 1-2회 저녁에만 권장"},
    "미네랄오일":       {"tag": "모공 주의",        "why": "모공이 넓은 피부에서 막힘 가능성 있어요"},
    "코코넛오일":       {"tag": "지성·여드름 주의", "why": "지성·여드름 피부에서 모공 막힘 유발 가능"},
    "벤조일퍼옥사이드": {"tag": "건성 주의",        "why": "건성 피부에 고농도 사용 시 건조감이 심해질 수 있어요"},
    "나이아신아마이드": {"tag": "고농도 주의",      "why": "10% 이상 고농도에서 일부 피부 홍조 가능 (저농도는 안전)"},
}

_CAUTION_BY_ATTR: list[tuple[str, float, list[str]]] = [
    # (attribute, threshold, caution_ingredients)
    ("dryness",      50, ["에탄올", "살리실산", "AHA"]),
    ("dryness",      60, ["벤조일퍼옥사이드"]),
    ("pore",         50, ["미네랄오일", "코코넛오일"]),
    ("pigmentation", 60, ["레티놀"]),
    ("wrinkle",      55, ["레티놀"]),
    ("sagging",      55, ["레티놀"]),
]


def get_caution_ingredients(attributes: dict, sensitivity_class: int) -> list[str]:
    """느슨한 기준의 주의 성분 반환 (절대 회피가 아닌 조심 권장)."""
    caution: set[str] = set()
    for attr, threshold, ings in _CAUTION_BY_ATTR:
        if attributes.get(attr, 0) >= threshold:
            caution.update(ings)
    if sensitivity_class >= 1:
        caution.update(["에탄올", "향료", "AHA"])
    return [i for i in _CAUTION_META if i in caution]


def enrich_caution(names: list[str]) -> list[dict]:
    """주의 성분 이름 리스트 → 태그·이유 포함 dict 리스트."""
    return [{"name": n, **_CAUTION_META.get(n, {"tag": "주의", "why": "피부 상태에 따라 주의가 필요해요"})} for n in names]


def enrich_rec(names: list[str]) -> list[dict]:
    """권장 성분 이름 리스트 → 태그·이유 포함 dict 리스트."""
    return [{"name": n, **_REC_META.get(n, {"tag": "성분", "why": "피부 개선에 도움"})} for n in names]


def enrich_avoid(names: list[str]) -> list[dict]:
    """회피 성분 이름 리스트 → 태그·이유 포함 dict 리스트."""
    return [{"name": n, **_AVOID_META.get(n, {"tag": "주의", "why": "피부 자극 가능"})} for n in names]
