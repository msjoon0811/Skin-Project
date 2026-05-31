"""룰베이스 추천 이유 템플릿 생성."""

ATTR_KO: dict[str, str] = {
    "wrinkle":      "주름",
    "pigmentation": "색소침착",
    "pore":         "모공",
    "dryness":      "건조도",
    "sagging":      "탄력저하",
}

HIGH_THRESHOLD = 65


def build_skin_summary(attributes: dict, sensitivity_class: int = 0) -> str:
    """정규화 속성 점수(0~100) + 민감도 클래스 → 피부 상태 요약 문자열."""
    highlights = []
    for attr, label in ATTR_KO.items():
        val = attributes.get(attr, 0)
        if val >= HIGH_THRESHOLD:
            highlights.append(f"{label} 높음")
    if sensitivity_class == 1:
        highlights.append("민감성")
    return ", ".join(highlights) if highlights else "복합성"


def explain_recommendation(
    attributes: dict,
    sensitivity_class: int,
    recommended: list[str],
    avoid: list[str],
    product_name: str,
) -> str:
    """속성 + 성분 정보 → 추천 이유 문자열 (의료 진단 표현 배제)."""
    summary  = build_skin_summary(attributes, sensitivity_class)
    rec_str  = ", ".join(recommended[:3]) if recommended else "없음"
    avoid_str = ", ".join(avoid[:3]) if avoid else "없음"

    return (
        f"피부 상태 [{summary}]으로 추정됩니다. "
        f"[{rec_str}] 성분이 도움될 수 있으며, "
        f"[{avoid_str}]는 피하는 것이 좋습니다. "
        f"추천 제품 [{product_name}]을(를) 확인해 보세요."
    )
