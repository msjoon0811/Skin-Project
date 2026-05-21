"""룰베이스 추천 이유 템플릿 생성."""

from src.models.multitask import MultiTaskSkinModel


ATTRIBUTE_LABELS = {
    "dryness": "건조도",
    "oiliness": "유분도",
    "pigmentation": "색소침착",
    "pore": "모공",
    "wrinkle": "주름",
    "acne_grade": "여드름",
    "sensitivity_class": "민감성",
}

HIGH_THRESHOLD = 60


def build_skin_summary(attributes: dict) -> str:
    """속성 점수 dict → 피부 상태 요약 문자열."""
    highlights = []
    for attr in MultiTaskSkinModel.REGRESSION_ATTRS:
        val = attributes.get(attr, 0)
        label = ATTRIBUTE_LABELS.get(attr, attr)
        if val >= HIGH_THRESHOLD:
            highlights.append(f"{label} 높음")
        elif val <= 100 - HIGH_THRESHOLD:
            highlights.append(f"{label} 낮음")

    if attributes.get("sensitivity_class", 0) == 1:
        highlights.append("민감성")
    grade = attributes.get("acne_grade", 0)
    if grade >= 2:
        highlights.append(f"여드름 {grade}단계")

    return ", ".join(highlights) if highlights else "복합성"


def explain_recommendation(attributes: dict, recommended: list[str],
                            avoid: list[str], product_name: str,
                            matched_ingredients: list[str]) -> str:
    summary = build_skin_summary(attributes)
    rec_str = ", ".join(recommended[:3]) if recommended else "없음"
    avoid_str = ", ".join(avoid[:3]) if avoid else "없음"
    matched_str = ", ".join(matched_ingredients[:3]) if matched_ingredients else "해당 없음"

    return (
        f"당신의 피부는 [{summary}]으로 분석됩니다. "
        f"[{rec_str}] 성분이 도움될 수 있으며, "
        f"[{avoid_str}]는 피하는 것이 좋습니다. "
        f"추천 제품 [{product_name}]는 [{matched_str}] 성분을 포함합니다."
    )
