"""
기능성화장품 보고품목정보 기반 피부 관심사 매칭 제품 추천.

functional.csv에 성분 목록이 없으므로 EE_CODE(효능 코드) + SPF + ITEM_NAME
키워드 매칭 기반으로 점수화하여 반환한다.

EE_CODE 의미 (화장품법 고시):
  1 → 미백
  2 → 주름개선
  3 → 미백 + 주름개선
"""

import pandas as pd
from pathlib import Path

_EE_CODE_WHITENING   = {1.0, 3.0}
_EE_CODE_ANTIWRINKLE = {2.0, 3.0}

_CONCERN_EFFICACY: dict[str, list[str]] = {
    "색소침착": ["미백"],
    "주름":    ["주름개선"],
    "탄력":    ["주름개선"],
}

_CONCERN_KEYWORDS: dict[str, list[str]] = {
    "건조함": ["수분", "보습", "히알루론", "세라마이드", "모이스처", "moisture"],
    "모공":   ["모공", "pore", "필링", "각질"],
    "여드름": ["여드름", "트러블", "acne", "아크네", "클리어"],
    "홍조":   ["진정", "센텔라", "cica", "수딩", "soothing"],
    "트러블": ["트러블", "진정", "수딩", "calming"],
    "탄력":   ["탄력", "리프팅", "펩타이드", "콜라겐", "firming"],
    "주름":   ["리프팅", "안티에이징", "탄력", "anti-aging"],
    "색소침착": ["미백", "화이트닝", "brightening", "브라이트닝"],
}

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "스킨토너": ["토너", "스킨", "toner", "water", "워터"],
    "에센스":   ["에센스", "essence"],
    "크림":     ["크림", "cream", "로션", "lotion", "밤"],
    "선크림":   ["선크림", "선블록", "선스크린", "sun", "sunscreen"],
    "세럼":     ["세럼", "앰플", "serum", "ampoule"],
    "클렌저":   ["클렌저", "폼클", "클렌징", "cleanser", "wash"],
    "마스크":   ["마스크", "패드", "mask", "pad"],
    "아이크림": ["아이크림", "아이", "eye cream", "eye"],
}


class FunctionalProductSearch:
    """functional.csv 기반 제품 점수화 및 Top-K 반환."""

    DEFAULT_CSV = Path("data/raw/mfds/functional.csv")

    def __init__(self, csv_path: str | Path | None = None):
        path = Path(csv_path) if csv_path else self.DEFAULT_CSV
        df = pd.read_csv(path, encoding="utf-8-sig", low_memory=False)

        df["EE_CODE"] = pd.to_numeric(df["EE_CODE"], errors="coerce")
        df["_is_whitening"]   = df["EE_CODE"].isin(_EE_CODE_WHITENING)
        df["_is_antiwrinkle"] = df["EE_CODE"].isin(_EE_CODE_ANTIWRINKLE)
        df["_has_spf"] = df["SPF"].notna() & (df["SPF"].astype(str).str.strip() != "")
        df["_item_lower"] = df["ITEM_NAME"].fillna("").str.lower()

        self.df = df

    def search(
        self,
        concerns: list[str],
        categories: list[str],
        is_pregnant: bool = False,
        uv_exposure: str | None = None,
        top_k: int = 5,
    ) -> pd.DataFrame:
        """
        Parameters
        ----------
        concerns    : 피부 고민 리스트 (폼 입력)
        categories  : 선호 카테고리 리스트 (폼 입력)
        is_pregnant : 임신/수유 여부
        uv_exposure : 자외선 노출 수준 ("낮음"/"보통"/"높음") — 높으면 SPF 제품 가산
        top_k       : 반환 최대 개수

        Note
        ----
        budget(예산): 식약처 기능성화장품 DB에 가격 정보가 없어 필터링 미적용.

        Returns
        -------
        DataFrame with columns: 제품명, 업체명, 효능, SPF, 점수
        """
        df = self.df
        score = pd.Series(0.0, index=df.index)

        # 효능 코드 매칭 (+2점)
        target_efficacy: set[str] = set()
        for c in concerns:
            target_efficacy.update(_CONCERN_EFFICACY.get(c, []))

        if "미백" in target_efficacy:
            score += df["_is_whitening"].astype(float) * 2
        if "주름개선" in target_efficacy:
            score += df["_is_antiwrinkle"].astype(float) * 2

        # 선크림 카테고리 또는 자외선 노출 높음 → SPF 보유 제품 가산
        if "선크림" in categories:
            score += df["_has_spf"].astype(float) * 3
        if uv_exposure == "높음":
            score += df["_has_spf"].astype(float) * 2

        item = df["_item_lower"]

        # 피부 고민 키워드 매칭 (+1점 per keyword hit)
        for concern in concerns:
            for kw in _CONCERN_KEYWORDS.get(concern, []):
                score += item.str.contains(kw, na=False, regex=False).astype(float)

        # 카테고리 키워드 매칭 (+1점 per keyword hit)
        for cat in categories:
            for kw in _CATEGORY_KEYWORDS.get(cat, []):
                score += item.str.contains(kw, na=False, regex=False).astype(float)

        # 임신 페널티: 레티놀 계열 제품 제외
        if is_pregnant:
            preg_mask = item.str.contains("레티놀|레틴산", na=False, regex=True)
            score = score.where(~preg_mask, other=-1.0)

        result = df.copy()
        result["_score"] = score

        out_cols = ["ITEM_NAME", "ENTP_NAME", "EE_NAME", "SPF", "_score"]
        return (
            result[result["_score"] > 0]
            .sort_values("_score", ascending=False)
            .head(top_k)[out_cols]
            .rename(columns={
                "ITEM_NAME": "제품명",
                "ENTP_NAME": "업체명",
                "EE_NAME":   "효능",
                "_score":    "점수",
            })
            .reset_index(drop=True)
        )
