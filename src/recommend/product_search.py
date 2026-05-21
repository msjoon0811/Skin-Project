import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


class ProductSearchEngine:
    """TF-IDF 기반 성분 매칭 제품 추천."""

    def __init__(self, products_df: pd.DataFrame, ingredient_col: str = "ingredients"):
        self.df = products_df.reset_index(drop=True)
        self.vectorizer = TfidfVectorizer(analyzer="word", token_pattern=r"[^,]+")
        self.tfidf_matrix = self.vectorizer.fit_transform(
            self.df[ingredient_col].fillna("")
        )

    def search(
        self,
        recommended: list[str],
        avoid: list[str],
        budget_filter: str | None = None,
        category_filter: list[str] | None = None,
        is_pregnant: bool = False,
        top_k: int = 5,
    ) -> pd.DataFrame:
        query = ", ".join(recommended)
        query_vec = self.vectorizer.transform([query])
        scores = cosine_similarity(query_vec, self.tfidf_matrix).flatten()

        # 회피 성분 포함 제품 패널티
        avoid_pattern = "|".join(avoid) if avoid else None
        if avoid_pattern:
            mask = self.df["ingredients"].str.contains(avoid_pattern, case=False, na=False)
            scores[mask] = -1.0

        result = self.df.copy()
        result["score"] = scores

        # 후처리 필터
        if budget_filter:
            result = result[result["budget_range"] == budget_filter]
        if category_filter:
            result = result[result["category"].isin(category_filter)]

        return (
            result[result["score"] > 0]
            .sort_values("score", ascending=False)
            .head(top_k)
            .reset_index(drop=True)
        )
