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

# 제품명 키워드 → 제품 유형 + 상세 사용법
_PRODUCT_TYPE_MAP = [
    (["마스크", "팩", "마스크팩"],
     "마스크/팩",
     "세안 후 수분 토너로 기초를 잡은 뒤 얼굴에 밀착하세요. 10~15분 후 제거하고 남은 에센스는 가볍게 두드려 흡수시킵니다. 주 2~3회 저녁 루틴에 사용하면 효과적이며, 이후 보습 크림으로 마무리하세요."),
    (["패드", "필링패드", "필링"],
     "필링/패드",
     "세안 후 물기를 제거하고, 거친 면으로 결 방향을 따라 부드럽게 닦아낸 뒤 부드러운 면으로 마무리합니다. 주 2~3회 저녁에만 사용하고, 사용 후 반드시 수분 크림으로 진정 케어를 해주세요. 다음 날 자외선 차단제 사용을 잊지 마세요."),
    (["앰플"],
     "앰플",
     "토너로 피부 결을 정돈한 후, 2~3방울을 손바닥에 덜어 체온으로 데운 뒤 얼굴 중심부터 바깥쪽으로 펴 바릅니다. 손바닥으로 10초간 가볍게 압착해 흡수시키고, 그 위에 크림으로 마무리하세요. 아침·저녁 꾸준히 사용할수록 효과가 축적됩니다."),
    (["세럼"],
     "세럼",
     "토너 다음 단계에서 적당량을 이마·양볼·코·턱에 점을 찍어 올린 뒤 안쪽에서 바깥쪽으로 얇게 펴 바릅니다. 눈가 등 예민한 부위는 가볍게 두드려 흡수시키고, 완전히 흡수된 후 크림으로 마무리하세요. 저녁 사용 시 효과가 더욱 뛰어납니다."),
    (["에센스", "세화"],
     "에센스",
     "토너 후 적당량을 손바닥에 덜어 두 손을 모아 가볍게 비빈 뒤 얼굴 전체에 감싸듯 흡수시킵니다. 건조한 부위에는 한 번 더 덧발라 주세요. 아침저녁 꾸준히 사용할수록 피부 결이 고르게 정돈되며, 이후 보습 크림으로 마무리하세요."),
    (["크림"],
     "크림",
     "스킨케어 마지막 단계에서 콩알 크기를 이마·양볼·코·턱에 나눠 올린 뒤 안쪽에서 바깥쪽으로 부드럽게 펴 바릅니다. 눈가·입가 등 주름지기 쉬운 부위를 꼼꼼하게 커버하세요. 저녁에는 조금 넉넉히 발라 야간 집중 보습 케어로 활용하세요."),
    (["로션", "에멀젼", "모이스처"],
     "로션/에멀젼",
     "에센스 흡수 후 적당량을 손바닥에 펴서 얼굴 전체에 가볍게 두드리듯 흡수시킵니다. 여름·지성 피부는 크림 대신 단독 보습 마무리로, 건성 피부는 크림 전 레이어링 단계로 사용하면 더욱 효과적입니다."),
    (["토너", "스킨"],
     "토너/스킨",
     "세안 직후 물기가 약간 남아있을 때 사용하면 흡수율이 높아집니다. 화장솜에 충분히 적셔 결 방향으로 닦아내거나, 손바닥에 덜어 3~5회 반복 패팅하세요. 콧볼·이마 등 각질 부위는 화장솜으로 집중 케어하면 피부 결 정돈에 도움이 됩니다."),
    (["미스트"],
     "미스트",
     "메이크업 전·후 또는 수시로 30cm 거리에서 얼굴 전체에 고르게 분사하세요. 화장 위에 사용할 때는 눈을 감고 분사 후 손바닥으로 가볍게 눌러 흡수시키면 메이크업 밀착력이 높아집니다."),
    (["선크림", "선", "자외선", "SPF", "UV"],
     "선크림",
     "외출 30분 전 스킨케어 마지막 단계에 사용하세요. 동전 크기 이상의 넉넉한 양을 얼굴 전체에 고르게 펴 바르고, 귀·목·손등 노출 부위도 꼼꼼히 커버하세요. 야외 활동 시 2시간마다 덧바르고, 흐린 날에도 자외선 차단은 필수입니다."),
    (["클렌징", "폼", "클렌저", "워시"],
     "클렌저",
     "미온수로 얼굴을 적신 후 적당량을 손에 덜어 거품을 충분히 내세요. T존부터 U존까지 모공 속 노폐물을 부드럽게 마사지하듯 30초~1분간 세안하고, 미지근한 물로 충분히 헹궈 잔여물이 남지 않도록 마무리하세요."),
    (["오일", "밸런싱"],
     "오일",
     "토너 후 1~2방울을 손바닥에 덜어 체온으로 데운 뒤 얼굴에 가볍게 압착하며 흡수시킵니다. 건조한 계절이나 야간 집중 케어 시 에센스 위에 덧발라 수분 증발을 막는 마무리 오일로도 활용 가능합니다."),
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
    return "기능성 화장품", "세안 후 토너로 피부 결을 정돈하고 적당량을 얼굴 전체에 고르게 펴 바르세요. 민감성 피부는 처음 사용 시 소량으로 패치 테스트 후 사용을 권장합니다."


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
