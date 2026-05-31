from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


class AgeGroup(str, Enum):
    TEENS = "10대"
    TWENTIES = "20대"
    THIRTIES = "30대"
    FORTIES = "40대"
    FIFTIES_PLUS = "50대 이상"


class Gender(str, Enum):
    MALE = "M"
    FEMALE = "F"
    NO_ANSWER = "무응답"


class SensitivityLevel(str, Enum):
    VERY_SENSITIVE = "매우 민감"
    SENSITIVE = "민감"
    NORMAL = "보통"
    INSENSITIVE = "둔감"


class AllergyIngredient(str, Enum):
    ALCOHOL = "알코올"
    FRAGRANCE = "향료"
    ESSENTIAL_OIL = "에센셜오일"
    PARABEN = "파라벤"
    OTHER = "기타"


class FoodAllergy(str, Enum):
    SEAFOOD = "해산물"
    NUT = "견과류"
    DAIRY = "유제품"
    EGG = "달걀"
    SOY = "대두"
    OTHER = "기타"


class SkinConcern(str, Enum):
    ACNE = "여드름"
    PORE = "모공"
    PIGMENTATION = "색소침착"
    DRYNESS = "건조함"
    WRINKLE = "주름"
    ELASTICITY = "탄력"
    REDNESS = "홍조"
    TROUBLE = "트러블"


class BudgetRange(str, Enum):
    UNDER_10K = "1만원 이하"
    TEN_TO_30K = "1~3만원"
    THIRTY_TO_50K = "3~5만원"
    OVER_50K = "5만원 이상"


class ProductCategory(str, Enum):
    TONER = "스킨토너"
    ESSENCE = "에센스"
    CREAM = "크림"
    SUNSCREEN = "선크림"
    SERUM = "세럼"
    CLEANSER = "클렌저"
    MASK = "마스크"
    EYE_CREAM = "아이크림"


@dataclass
class UserFormInput:
    # 필수 입력 (7)
    age_group: AgeGroup
    gender: Gender
    sensitivity: SensitivityLevel
    allergies: List[AllergyIngredient]
    concerns: List[SkinConcern]  # 최대 3개
    budget: BudgetRange
    categories: List[ProductCategory]

    # 선택 입력 (5+1)
    seasonal_change: Optional[str] = None
    uv_exposure: Optional[str] = None
    stress_level: Optional[str] = None
    is_pregnant: bool = False
    vegan_preference: bool = False
    food_allergies: List[FoodAllergy] = field(default_factory=list)

    def __post_init__(self):
        if len(self.concerns) > 3:
            raise ValueError("피부 고민은 최대 3개까지 선택 가능합니다.")
