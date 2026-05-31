# 한국인 피부 분석 기반 맞춤형 화장품 추천 시스템

셀카 이미지 + 폼 입력 → CNN 피부 속성 추정 → 식약처 공공데이터 기반 화장품 추천

> 이 시스템은 화장품 추천 보조 도구입니다. 의료 진단이 아닙니다.

---

## 빠른 시작

### 1. Python 가상환경 세팅

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
```

### 2. 패키지 설치

```bash
pip install -r requirements.txt
```

PyTorch는 별도 설치 (GPU 유무에 따라 선택):

```bash
# GPU (NVIDIA CUDA 12.x)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128

# CPU만 사용
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

### 3. 데모 앱 실행

```bash
streamlit run app/streamlit_app.py
```

브라우저에서 `http://localhost:8501` 로 접속

---

## 프로젝트 구조

```
skin-project/
│
├── app/
│   └── streamlit_app.py        ← 데모 앱 (여기서 수정)
│
├── src/
│   ├── models/
│   │   └── cnn.py              ← MultiTaskSkinModel (EfficientNet-B0)
│   ├── form/
│   │   └── schema.py           ← 폼 입력 스키마 (UserFormInput dataclass)
│   ├── recommend/
│   │   ├── ingredient_map.py   ← 피부 속성 → 권장/회피 성분 매핑
│   │   ├── product_search.py   ← 식약처 기능성화장품 DB 검색
│   │   └── explainer.py        ← 추천 이유 텍스트 생성
│   ├── utils/
│   │   └── face_crop.py        ← 얼굴 부위별 자동 크롭 (OpenCV)
│   ├── data/
│   │   ├── aihub_loader.py     ← AI Hub 데이터 로더 (학습용)
│   │   ├── dataset.py          ← PyTorch Dataset
│   │   └── mfds_api.py         ← 식약처 API 수집 스크립트
│   └── train/
│       ├── train.py            ← 학습 루프
│       ├── eval.py             ← 평가
│       └── losses.py           ← 손실 함수
│
├── scripts/
│   ├── train_multitask.py      ← 멀티태스크 모델 학습
│   └── train_baseline.py       ← 베이스라인 모델 학습
│
├── checkpoints/
│   └── multitask_best.pth      ← 학습된 모델 가중치 (현재 사용 중)
│
├── data/                       ← 별도 전달 (용량 크고 재배포 금지)
│   └── raw/mfds/               ← 식약처 CSV (ingredient, restricted,
│       ├── ingredient.csv           functional, regulation)
│       ├── restricted.csv
│       ├── functional.csv      ← 제품 추천에 사용 (190,630건)
│       └── regulation.csv
│
├── notebooks/
│   └── 01_eda_aihub.ipynb
│
├── requirements.txt
└── PROJECT_PLAN.md             ← 전체 기획 문서
```

---

## 추론 파이프라인 사용법

백엔드에서 ML 추론을 호출할 때 `app/streamlit_app.py` 안의 함수들을 그대로 가져다 쓸 수 있습니다.

```python
from PIL import Image
from src.utils.face_crop import crop_faceparts, FACEPART_TARGETS
from src.recommend.ingredient_map import (
    normalize_cnn_output, sensitivity_from_form,
    get_recommended_ingredients, get_avoid_ingredients,
)
from src.recommend.product_search import FunctionalProductSearch
from src.recommend.explainer import build_skin_summary, explain_recommendation

# 1. 이미지 → 부위별 크롭 → CNN 추론
image = Image.open("photo.jpg").convert("RGB")
crops = crop_faceparts(image)          # 이마/눈가/볼/입술/턱 자동 크롭

# 2. 속성 정규화 (0~100)
raw_preds = {"forehead_wrinkle": 3, "lip_dryness": 2, ...}  # CNN argmax 결과
attributes = normalize_cnn_output(raw_preds)
# → {"wrinkle": 50.0, "pigmentation": 40.0, "pore": 50.0, ...}

# 3. 성분 추천
sensitivity_class = sensitivity_from_form("민감")   # 폼 입력
recommended = get_recommended_ingredients(attributes, sensitivity_class)
avoid       = get_avoid_ingredients(["향료", "파라벤"], is_pregnant=False)

# 4. 제품 검색
engine   = FunctionalProductSearch()   # data/raw/mfds/functional.csv 로드
products = engine.search(
    concerns=["주름", "색소침착"],
    categories=["에센스", "크림"],
    top_k=5,
)

# 5. 설명 생성
text = explain_recommendation(attributes, sensitivity_class, recommended, avoid, "제품명")
```

### 폼 입력 스키마

```python
from src.form.schema import (
    UserFormInput, AgeGroup, Gender,
    SensitivityLevel, AllergyIngredient,
    SkinConcern, BudgetRange, ProductCategory,
)

form = UserFormInput(
    age_group   = AgeGroup.TWENTIES,
    gender      = Gender.FEMALE,
    sensitivity = SensitivityLevel.SENSITIVE,
    allergies   = [AllergyIngredient.FRAGRANCE],
    concerns    = [SkinConcern.WRINKLE, SkinConcern.PIGMENTATION],
    budget      = BudgetRange.TEN_TO_30K,
    categories  = [ProductCategory.ESSENCE, ProductCategory.CREAM],
    is_pregnant = False,
    vegan_preference = False,
)
```

---

## 모델

- **아키텍처**: EfficientNet-B0 + 7개 속성 독립 분류 head
- **학습 데이터**: AI Hub 한국인 피부상태 측정 데이터 (21,450장)
- **출력**: 7개 속성 클래스 예측
  | 속성 | 클래스 수 | 설명 |
  |------|----------|------|
  | forehead_wrinkle | 7 (0~6) | 이마 주름 |
  | forehead_pigmentation | 6 (0~5) | 이마 색소침착 |
  | l_perocular_wrinkle | 7 (0~6) | 눈가 주름 |
  | l_cheek_pore | 5 (0~4) | 볼 모공 |
  | l_cheek_pigmentation | 6 (0~5) | 볼 색소침착 |
  | lip_dryness | 5 (0~4) | 입술 건조도 |
  | chin_sagging | 6 (0~5) | 턱 탄력 |

---

## 데이터 관련 주의사항

- `data/` 폴더는 용량이 크고 재배포 금지이므로 별도 전달
- `data/raw/mfds/*.csv` 파일은 반드시 있어야 제품 추천이 동작함
- `.env` 파일 (식약처 API 키)도 별도 전달 — 코드에 직접 넣지 말 것

---

## 데이터 출처

- **AI Hub 한국인 피부상태 측정 데이터**: 비상업 연구·교육 목적
- **식약처 기능성화장품 보고품목정보**: 공공데이터포털 Open API
