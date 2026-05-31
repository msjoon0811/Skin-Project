"""피부 속성별 피부과 시술 추천 매핑"""

PROCEDURE_DB = [
    {
        "id": "rejuran",
        "name": "리쥬란 힐러",
        "category": "스킨부스터",
        "description": "연어 DNA에서 추출한 PN 성분을 주사하여 피부 장벽을 강화하고 속건조를 해결합니다. 재생 효과가 뛰어나 민감하고 얇아진 피부에도 안전하게 적용 가능합니다.",
        "target_attr": ["dryness", "wrinkle"],
        "target_concerns": ["속건조 해결", "피부 장벽 강화", "주름 개선"],
        "min_score": 60,
        "safe_for_sensitive": True,
        "is_safe_for_sensitive": True,
        "price_range": "20~40만원",
        "price_bracket": "스탠다드 (10~30만원)",
        "price_level": 1,
        "downtime": "당일 시술 후 바로 일상 가능",
        "downtime_level": 0,
        "pain_level": "따끔함 (마취 크림 사용)",
        "cycle": "3~4주 간격, 3회 세트",
    },
    {
        "id": "ldm",
        "name": "LDM 물방울 리프팅",
        "category": "리프팅/진정",
        "description": "고밀도 초음파 에너지를 이용해 피부 속 수분을 끌어올리고 민감한 피부를 진정시킵니다. 비침습 시술로 자극 없이 즉각적인 효과를 경험할 수 있습니다.",
        "target_attr": ["dryness", "sens", "sagging"],
        "target_concerns": ["속건조 해결", "탄력 개선", "피부 장벽 강화"],
        "min_score": 50,
        "safe_for_sensitive": True,
        "is_safe_for_sensitive": True,
        "price_range": "5~15만원",
        "price_bracket": "가성비 (10만원 이하)",
        "price_level": 0,
        "downtime": "당일 화장 가능, 즉시 일상복귀",
        "downtime_level": 0,
        "pain_level": "거의 없음",
        "cycle": "주 1~2회, 4~8회",
    },
    {
        "id": "ultherapy",
        "name": "울쎄라 리프팅",
        "category": "리프팅",
        "description": "고강도 집속 초음파(HIFU)를 근막층까지 전달해 처진 피부를 강력하게 끌어올립니다. 1회 시술로 6~12개월 효과가 지속되는 고효율 시술입니다.",
        "target_attr": ["sagging"],
        "target_concerns": ["탄력 개선", "주름 개선"],
        "min_score": 65,
        "safe_for_sensitive": False,
        "is_safe_for_sensitive": False,
        "price_range": "80~150만원",
        "price_bracket": "프리미엄 (30만원 이상)",
        "price_level": 2,
        "downtime": "2~3일 붉은기, 당일 일상 가능",
        "downtime_level": 1,
        "pain_level": "시술 중 강한 통증 (마취 필수)",
        "cycle": "6개월~1년 1회",
    },
    {
        "id": "picotoning",
        "name": "피코 토닝",
        "category": "레이저",
        "description": "기존 레이저보다 1000배 빠른 속도로 에너지를 조사하여 기미, 잡티, 색소침착을 잘게 부수어 배출합니다. 열 손상을 최소화하여 회복이 빠릅니다.",
        "target_attr": ["pigmentation"],
        "target_concerns": ["색소 침착", "잡티 제거"],
        "min_score": 60,
        "safe_for_sensitive": False,
        "is_safe_for_sensitive": False,
        "price_range": "5~15만원",
        "price_bracket": "가성비 (10만원 이하)",
        "price_level": 0,
        "downtime": "1~2일 붉은기",
        "downtime_level": 1,
        "pain_level": "따끔거림 (마취 크림 선택)",
        "cycle": "2~3주 간격, 5~8회",
    },
    {
        "id": "fraxel",
        "name": "프락셀 레이저",
        "category": "레이저",
        "description": "피부에 미세한 구멍을 뚫어 새살이 돋아나게 함으로써 넓은 모공과 흉터를 개선합니다. 자연스러운 재생 과정을 통해 피부 결을 전반적으로 매끄럽게 개선합니다.",
        "target_attr": ["pore"],
        "target_concerns": ["모공 축소", "흉터 개선"],
        "min_score": 65,
        "safe_for_sensitive": False,
        "is_safe_for_sensitive": False,
        "price_range": "10~25만원",
        "price_bracket": "스탠다드 (10~30만원)",
        "price_level": 1,
        "downtime": "3~5일 (붉은기, 각질, 부종 가능)",
        "downtime_level": 2,
        "pain_level": "강한 따끔거림 (마취 크림 필수)",
        "cycle": "4~6주 간격, 3~5회",
    },
    {
        "id": "botox",
        "name": "주름 보톡스",
        "category": "주사시술",
        "description": "표정 근육의 움직임을 일시적으로 마비시켜 이마, 미간, 눈가 등의 표정 주름을 개선합니다. 빠른 효과와 짧은 회복 기간이 장점입니다.",
        "target_attr": ["wrinkle"],
        "target_concerns": ["주름 개선"],
        "min_score": 60,
        "safe_for_sensitive": True,
        "is_safe_for_sensitive": True,
        "price_range": "3~10만원",
        "price_bracket": "가성비 (10만원 이하)",
        "price_level": 0,
        "downtime": "당일 세안/화장 가능",
        "downtime_level": 0,
        "pain_level": "따끔함 (매우 짧음)",
        "cycle": "3~6개월 1회",
    },
    {
        "id": "aqua_peel",
        "name": "아쿠아필",
        "category": "스킨케어",
        "description": "모공 속 피지와 노폐물을 부드럽게 녹여내고 수분을 채워주어 블랙헤드와 유분 관리에 효과적입니다. 진정 효과까지 있어 민감성 피부도 시술 가능합니다.",
        "target_attr": ["pore"],
        "target_concerns": ["모공 축소", "피부 장벽 강화"],
        "min_score": 50,
        "safe_for_sensitive": True,
        "is_safe_for_sensitive": True,
        "price_range": "3~8만원",
        "price_bracket": "가성비 (10만원 이하)",
        "price_level": 0,
        "downtime": "당일 즉시 일상복귀",
        "downtime_level": 0,
        "pain_level": "없음",
        "cycle": "2~4주 1회",
    }
]

def get_recommended_procedures(attributes: dict, sensitivity_class: int, top_k: int = 5) -> list[dict]:
    """
    피부 속성(attributes)과 민감도(sensitivity_class)를 기반으로 
    적합한 피부과 시술을 추천합니다.
    민감성 피부라도 안전하지 않은 시술은 제외하지 않고, 경고 플래그만 표시합니다.
    """
    recommendations = []
    
    for proc in PROCEDURE_DB:
        # 해당 시술의 타겟 속성 중 현재 피부 상태가 기준 점수 이상인 것이 있는지 확인
        match_score = 0
        matched_reasons = []
        
        for attr in proc["target_attr"]:
            val = attributes.get(attr, 0.0)
            if val >= proc["min_score"]:
                match_score += val
                if attr == "wrinkle":      matched_reasons.append("주름 개선")
                elif attr == "sagging":    matched_reasons.append("탄력 개선")
                elif attr == "pigmentation": matched_reasons.append("색소 침착")
                elif attr == "dryness":    matched_reasons.append("속건조 해결")
                elif attr == "pore":       matched_reasons.append("모공 축소")
                elif attr == "sens":       matched_reasons.append("피부 장벽 강화")
                
        if match_score > 0:
            rec = proc.copy()
            rec["match_score"] = round(match_score, 1)
            rec["match_reasons"] = matched_reasons
            # target_concerns가 없으면 match_reasons로 대체
            if not rec.get("target_concerns"):
                rec["target_concerns"] = matched_reasons
            recommendations.append(rec)
            
    # 매치 점수 높은 순으로 정렬
    recommendations.sort(key=lambda x: x["match_score"], reverse=True)
    
    return recommendations[:top_k]
