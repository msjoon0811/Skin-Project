"""
피부 속성 → 권장/회피 성분 매핑 테이블.
피부과 가이드라인 기반으로 직접 구축.
"""

ATTRIBUTE_TO_RECOMMENDED: dict[str, list[str]] = {
    "dryness_high": ["히알루론산", "세라마이드", "글리세린", "스쿠알란", "판테놀"],
    "oiliness_high": ["살리실산", "나이아신아마이드", "클레이", "BHA"],
    "pigmentation_high": ["비타민C", "알부틴", "트라넥삼산", "나이아신아마이드"],
    "wrinkle_high": ["레티놀", "펩타이드", "비타민C", "아데노신"],
    "pore_high": ["살리실산", "AHA", "나이아신아마이드"],
    "sensitive": ["센텔라아시아티카", "판테놀", "마데카소사이드", "알란토인"],
    "acne_high": ["살리실산", "티트리", "벤조일퍼옥사이드", "나이아신아마이드"],
}

ALLERGY_TO_AVOID: dict[str, list[str]] = {
    "알코올": ["에탄올", "알코올", "SD알코올"],
    "향료": ["향료", "프래그런스", "퍼퓸"],
    "에센셜오일": ["티트리오일", "라벤더오일", "페퍼민트오일", "로즈오일"],
    "파라벤": ["메틸파라벤", "에틸파라벤", "프로필파라벤", "부틸파라벤"],
}

PREGNANCY_AVOID = ["레티놀", "레틴산", "살리실산", "벤조일퍼옥사이드"]


def get_recommended_ingredients(attributes: dict) -> list[str]:
    """속성 점수 dict → 권장 성분 리스트 반환."""
    recommended = set()
    thresholds = {
        "dryness": ("dryness_high", 60),
        "oiliness": ("oiliness_high", 60),
        "pigmentation": ("pigmentation_high", 50),
        "wrinkle": ("wrinkle_high", 50),
        "pore": ("pore_high", 50),
    }
    for attr, (key, threshold) in thresholds.items():
        if attributes.get(attr, 0) >= threshold:
            recommended.update(ATTRIBUTE_TO_RECOMMENDED[key])

    if attributes.get("sensitivity_class", 0) == 1:
        recommended.update(ATTRIBUTE_TO_RECOMMENDED["sensitive"])
    if attributes.get("acne_grade", 0) >= 2:
        recommended.update(ATTRIBUTE_TO_RECOMMENDED["acne_high"])

    return sorted(recommended)


def get_avoid_ingredients(allergies: list[str], is_pregnant: bool = False) -> list[str]:
    """알레르기 목록 + 임신 여부 → 회피 성분 리스트 반환."""
    avoid = set()
    for allergy in allergies:
        avoid.update(ALLERGY_TO_AVOID.get(allergy, []))
    if is_pregnant:
        avoid.update(PREGNANCY_AVOID)
    return sorted(avoid)
