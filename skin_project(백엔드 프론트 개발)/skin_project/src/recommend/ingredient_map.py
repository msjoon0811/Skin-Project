"""
피부 속성 → 권장/회피 성분 매핑 테이블.
피부과 가이드라인 기반으로 직접 구축.
"""

from src.data.aihub_loader import ANNOTATION_MAX

ATTRIBUTE_TO_RECOMMENDED: dict[str, list[str]] = {
    "dryness_high":      ["히알루론산", "세라마이드", "글리세린", "스쿠알란", "판테놀"],
    "pigmentation_high": ["비타민C", "알부틴", "트라넥삼산", "나이아신아마이드"],
    "wrinkle_high":      ["레티놀", "펩타이드", "비타민C", "아데노신"],
    "pore_high":         ["살리실산", "AHA", "나이아신아마이드"],
    "sagging_high":      ["펩타이드", "레티놀", "아데노신", "콜라겐"],
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
    """
    out: dict[str, float] = {}

    wrinkle_vals = [
        raw_preds[t] / ANNOTATION_MAX[t] * 100
        for t in ("forehead_wrinkle", "l_perocular_wrinkle")
        if t in raw_preds
    ]
    if wrinkle_vals:
        out["wrinkle"] = sum(wrinkle_vals) / len(wrinkle_vals)

    pig_vals = [
        raw_preds[t] / ANNOTATION_MAX[t] * 100
        for t in ("forehead_pigmentation", "l_cheek_pigmentation")
        if t in raw_preds
    ]
    if pig_vals:
        out["pigmentation"] = sum(pig_vals) / len(pig_vals)

    if "l_cheek_pore" in raw_preds:
        out["pore"] = raw_preds["l_cheek_pore"] / ANNOTATION_MAX["l_cheek_pore"] * 100

    if "lip_dryness" in raw_preds:
        out["dryness"] = raw_preds["lip_dryness"] / ANNOTATION_MAX["lip_dryness"] * 100

    if "chin_sagging" in raw_preds:
        out["sagging"] = raw_preds["chin_sagging"] / ANNOTATION_MAX["chin_sagging"] * 100

    return out


def sensitivity_from_form(sensitivity_str: str) -> int:
    """Form 민감도 문자열 → 0(보통/둔감) / 1(민감/매우민감)."""
    return 1 if sensitivity_str in ("매우 민감", "민감") else 0


def get_recommended_ingredients(
    attributes: dict,
    form_sensitivity: int = 0,
) -> list[str]:
    """정규화 속성 점수(0~100) + 폼 민감도 → 권장 성분 리스트."""
    recommended: set[str] = set()

    thresholds = {
        "dryness":      ("dryness_high",      65),
        "pigmentation": ("pigmentation_high",  65),
        "wrinkle":      ("wrinkle_high",       65),
        "pore":         ("pore_high",          65),
        "sagging":      ("sagging_high",       65),
    }
    for attr, (key, thr) in thresholds.items():
        if attributes.get(attr, 0) >= thr:
            recommended.update(ATTRIBUTE_TO_RECOMMENDED[key])

    if form_sensitivity == 1:
        recommended.update(ATTRIBUTE_TO_RECOMMENDED["sensitive"])

    return sorted(recommended)


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
