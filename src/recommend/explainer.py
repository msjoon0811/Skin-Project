"""룰베이스 추천 이유 템플릿 생성."""

ATTR_KO: dict[str, str] = {
    "wrinkle":      "주름",
    "pigmentation": "색소침착",
    "pore":         "모공",
    "dryness":      "건조도",
    "sagging":      "탄력저하",
}

MID_THRESHOLD  = 35
HIGH_THRESHOLD = 65

# 제품명 키워드 → 제품 유형 + 사용 단계
_PRODUCT_TYPE_MAP = [
    (["마스크", "팩", "마스크팩"],             "마스크/팩",     "주 1-2회 세안 후 10-15분 도포, 잔여 에센스는 손으로 흡수"),
    (["세럼", "앰플", "에센스", "세화"],       "세럼/에센스",   "세안·토너 후 2-3방울 얼굴에 고르게 펴 바르고 가볍게 흡수"),
    (["크림", "로션", "에멀젼", "모이스처"],   "크림/로션",     "에센스 흡수 후 마지막 단계에 덮어주듯 도포"),
    (["토너", "스킨", "미스트"],              "토너/스킨",     "세안 직후 화장솜 또는 손바닥으로 가볍게 패팅"),
    (["선", "자외선", "SPF", "UV"],           "선크림",        "외출 30분 전 자외선 노출 부위에 충분히 도포"),
    (["클렌징", "폼", "클렌저", "워시"],      "클렌저",        "세안 시 30초 이상 거품을 내어 마사지 후 헹굼"),
    (["오일", "밸런싱"],                      "오일/밸런서",   "토너 후 손바닥에 1-2방울 데워 가볍게 압착"),
]

_RANK_FOCUS = {
    1: ("1순위 케어",  "가장 시급한 피부 고민에 직접 작용하는 제품"),
    2: ("2순위 케어",  "주요 고민 완화를 돕는 보조 케어 제품"),
    3: ("3순위 케어",  "피부 전반의 밸런스를 잡아주는 보완 제품"),
}


def _infer_product_type(product_name: str) -> tuple[str, str]:
    """제품명 → (유형 라벨, 사용법 문자열)."""
    lower = product_name
    for keywords, label, usage in _PRODUCT_TYPE_MAP:
        if any(kw in lower for kw in keywords):
            return label, usage
    return "기능성 화장품", "피부 상태에 따라 세안 후 적당량 사용"


def build_skin_summary(attributes: dict, sensitivity_class: int = 0) -> str:
    """정규화 속성 점수(0~100) + 민감도 클래스 → 피부 상태 요약 문자열."""
    highlights = []
    for attr, label in ATTR_KO.items():
        val = attributes.get(attr, 0)
        if val >= HIGH_THRESHOLD:
            highlights.append(f"{label} 높음")
        elif val >= MID_THRESHOLD:
            highlights.append(f"{label} 중간")
    if sensitivity_class == 1:
        highlights.append("민감성")
    return ", ".join(highlights) if highlights else "정상"


def _top_concern(attributes: dict, sensitivity_class: int) -> str:
    """가장 점수 높은 속성 하나를 한국어로 반환."""
    best = max(
        ((v, ATTR_KO[k]) for k, v in attributes.items() if k in ATTR_KO),
        default=(0, ""),
        key=lambda x: x[0],
    )
    if sensitivity_class == 1 and best[0] < HIGH_THRESHOLD:
        return "민감성"
    return best[1] or "복합성"


def explain_recommendation(
    attributes: dict,
    sensitivity_class: int,
    recommended: list[str],
    avoid: list[str],
    product_name: str,
    rank: int = 1,
) -> str:
    """제품별로 다른 추천 이유 생성 (rank 1~3 기준으로 내용 차별화)."""
    rank_label, rank_desc = _RANK_FOCUS.get(rank, _RANK_FOCUS[1])
    product_type, usage   = _infer_product_type(product_name)
    concern               = _top_concern(attributes, sensitivity_class)

    # rank별 핵심 성분 포커스
    focus_ings = recommended[:3] if rank == 1 else recommended[1:4] if rank == 2 else recommended[2:5]
    focus_str  = ", ".join(focus_ings) if focus_ings else recommended[0] if recommended else "기본 케어 성분"

    avoid_str = ", ".join(avoid[:2]) if avoid else None

    lines = [
        f"[{rank_label}] {rank_desc}.",
        f"주요 고민 '{concern}' 개선에 '{focus_str}' 성분이 작용합니다.",
    ]
    if avoid_str:
        lines.append(f"'{avoid_str}' 성분은 포함되지 않은지 전성분을 확인하세요.")
    lines.append(f"사용법: {usage}")

    return " · ".join(lines)
