import random
import pandas as pd
from pathlib import Path
from typing import List, Dict, Optional

class FoodRecommender:
    def __init__(self, csv_path: str = "data/raw/food_map.csv"):
        # Load the CSV file
        path = Path(csv_path)
        if path.exists():
            self.df = pd.read_csv(path)
        else:
            self.df = pd.DataFrame()

    def _determine_condition(self, attributes: Dict[str, float], sensitivity_class: str, concerns: List[str]) -> str:
        """피부 속성, 민감도, 폼 고민을 바탕으로 핵심 타겟 피부 상태(CSV 기준)를 결정합니다."""
        # 1. 명시적인 폼 고민 우선
        if "여드름" in concerns or "트러블" in concerns:
            return "유분(지성)"
        if "홍조" in concerns or "매우 민감" in sensitivity_class or "민감" == sensitivity_class:
            return "민감도"
            
        # 2. 점수가 가장 높은 CNN 속성 기반
        if attributes:
            worst_attr = max(attributes.items(), key=lambda x: x[1])[0]
            mapping = {
                "wrinkle": "주름",
                "pigmentation": "색소침착",
                "pore": "모공",
                "dryness": "수분(건성)",
                "sagging": "주름" # 탄력저하는 주름/콜라겐 식단과 공유
            }
            return mapping.get(worst_attr, "수분(건성)")
            
        # 기본값
        return "수분(건성)"

    def recommend(
        self, 
        attributes: Dict[str, float], 
        sensitivity_class: str, 
        concerns: List[str], 
        is_vegan: bool, 
        food_allergies: List[str],
        seed: Optional[int] = None
    ) -> Optional[List[Dict]]:
        """
        맞춤형 추천 식재료 2개를 반환합니다.
        반환 형태: [{"food_name": "사과", "reason": "...", "key_nutrients": "..."}, ...]
        """
        if self.df.empty:
            return None

        # 타겟 피부 상태 결정
        condition = self._determine_condition(attributes, sensitivity_class, concerns)
        
        # 1. 조건에 맞는 추천 식품 필터링
        df = self.df[(self.df["skin_condition"] == condition) & (self.df["food_type"] == "추천")]
        
        # 2. 비건 필터링 (csv의 is_vegan 컬럼이 True인 것만)
        if is_vegan:
            df = df[df["is_vegan"] == True]
            
        # 3. 알레르기 필터링 (csv의 allergen 컬럼 확인)
        if food_allergies:
            for allergy in food_allergies:
                if allergy != "기타":
                    # 해당 알레르기와 일치하지 않는 것만 남김 (NaN 처리 고려)
                    df = df[df["allergen"] != allergy]
                    
        if df.empty:
            # 필터링 후 남은게 없다면 톤균일도/수분 등 무난한 것으로 다시 조회
            df = self.df[(self.df["skin_condition"] == "수분(건성)") & (self.df["food_type"] == "추천")]
            if is_vegan: df = df[df["is_vegan"] == True]
            if df.empty: return None

        # 최대 10개 랜덤 샘플링 (프론트에서 새로고침 지원)
        sample_size = min(10, len(df))
        sampled = df.sample(n=sample_size, random_state=seed).to_dict(orient="records")
        return sampled
