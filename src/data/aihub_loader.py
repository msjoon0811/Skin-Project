"""AI Hub 한국인 피부상태 측정 데이터 상수 및 로더.

MULTITASK_TARGETS / ANNOTATION_MAX: 모델 구조 정의에 사용되는 상수.
실제 데이터 로딩 함수(build_label_dataframe 등)는 학습 전용이며
추론/서버 실행에는 불필요.
"""

MULTITASK_TARGETS: list[str] = [
    "forehead_wrinkle",
    "forehead_pigmentation",
    "l_perocular_wrinkle",
    "l_cheek_pore",
    "l_cheek_pigmentation",
    "lip_dryness",
    "chin_sagging",
]

# 속성별 최대 등급 (클래스 수 = max + 1)
ANNOTATION_MAX: dict[str, int] = {
    "forehead_wrinkle":      6,  # 0~6 (7클래스)
    "forehead_pigmentation": 5,  # 0~5 (6클래스)
    "l_perocular_wrinkle":   6,  # 0~6 (7클래스)
    "l_cheek_pore":          4,  # 0~4 (5클래스)
    "l_cheek_pigmentation":  5,  # 0~5 (6클래스)
    "lip_dryness":           4,  # 0~4 (5클래스)
    "chin_sagging":          5,  # 0~5 (6클래스)
}


def build_label_dataframe(*args, **kwargs):
    raise NotImplementedError("학습 전용 함수입니다. 데이터가 필요합니다.")


def get_image_label_pairs(*args, **kwargs):
    raise NotImplementedError("학습 전용 함수입니다. 데이터가 필요합니다.")
