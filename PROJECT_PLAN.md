# 한국인 피부 분석 기반 맞춤형 화장품 추천 시스템

> **머신러닝 프로젝트 (학기 단위)**
> 이 문서는 Claude Code에서 프로젝트를 진행하기 위한 단일 기획·실행 가이드입니다.
> Claude Code가 이 문서를 읽고 작업을 시작할 수 있도록 작성되었습니다.

---

## 0. Claude Code 에이전트에게 (먼저 읽을 것)

이 프로젝트는 **3~4인 팀의 학부 ML 학기 프로젝트**입니다. 다음 원칙을 지켜주세요:

1. **"진단(diagnosis)" 단어 절대 금지.** 의료 행위로 해석될 여지가 있음. 대체어: "분석(analysis)", "속성 추정(attribute estimation)", "추천(recommendation)".
2. **데이터는 합법적 공식 채널로만.** AI Hub + 공공데이터포털(식약처) 위주. 화해/올리브영 크롤링은 약관·법적 리스크로 보류.
3. **욕심내지 않기.** 학기 안에 끝낼 수 있는 범위를 지킬 것. 새 아이디어는 future work로.
4. **단계별 진행.** Multi-task 모델 만들기 전에 단일 속성 분류 베이스라인부터.
5. **EDA 우선.** 데이터 구조 파악 안 된 상태에서 모델 코드부터 짜지 말 것.

---

## 1. 프로젝트 개요

### 1.1 한 줄 정의
사용자의 셀카(이미지)와 폼 입력(텍스트/카테고리)을 받아, 한국인 피부 데이터로 학습한 CNN으로 피부 속성을 추정하고, 식약처 공공 데이터 기반으로 맞춤 화장품·성분을 추천하는 시스템.

### 1.2 차별화 포인트
- **국내 최초 한국인 피부 공개 데이터(AI Hub) 활용** → 인종 편향 극복
- **공식·공공 데이터로만 구성** → 윤리·법적 문제 없음
- **Multi-task 학습** → 단일 피부타입 분류가 아닌 7개 속성 동시 추정
- **이미지 + 폼 멀티모달** → 시각적 추정 가능/불가능 정보 명확 분리
- **회피 성분도 함께 제시** → 식약처 사용제한 원료 DB 연동

### 1.3 시스템 아키텍처
```
┌─────────────── INPUT ───────────────┐
│  [이미지] 사용자 셀카                │
│  [폼]    필수 7 + 선택 5 항목        │
└────────────────┬────────────────────┘
                 ↓
┌─── Module 1: 피부 속성 추정 (CV) ───┐
│  Backbone: EfficientNet-B0 (전이학습)│
│  Head: Multi-task (7개 속성)         │
│  학습: AI Hub 한국인 피부 데이터     │
│  출력: 속성별 점수 (회귀+분류 혼합)  │
└────────────────┬────────────────────┘
                 ↓
   [CV 출력 7차원] + [폼 일부 feature]
                 ↓
┌─── Module 2: 성분 매칭 (지식 기반) ─┐
│  DB: 식약처 원료성분 / 사용제한     │
│  로직: 속성→권장성분 / 회피성분 매핑│
│  출력: 추천 성분 N, 회피 성분 M     │
└────────────────┬────────────────────┘
                 ↓
┌─── Module 3: 제품 추천 ─────────────┐
│  DB: 식약처 기능성화장품 + 보조 DB  │
│  방법: 콘텐츠 기반 필터링           │
│        (TF-IDF + 성분 매칭)         │
│  필터: 폼의 제약조건 (예산/카테고리)│
│  출력: Top-K 제품                   │
└────────────────┬────────────────────┘
                 ↓
┌─── Module 4: 설명 생성 ─────────────┐
│  룰베이스 템플릿                    │
│  "당신의 [건조도 높음 + 민감성]에   │
│   적합한 [세라마이드 포함] 제품"    │
└────────────────┬────────────────────┘
                 ↓
┌─────────────── OUTPUT ──────────────┐
│  1. 피부 속성 리포트 (속성별 점수)  │
│  2. 추천 성분 / 회피 성분           │
│  3. 추천 제품 Top-K + 추천 이유     │
└─────────────────────────────────────┘
```

---

## 2. 데이터 (전부 합법 공식 채널)

| 용도 | 데이터 | 출처 | 신청 방법 | 상태 |
|---|---|---|---|---|
| 학습 메인 | 한국인 피부상태 측정 데이터 | AI Hub | 휴대폰 인증 후 신청 | ✅ 승인 완료 |
| 학습 보조 | 한국인 안면 이미지 | AI Hub / K-Face | 동일 | (선택) |
| 성분 사전 | 화장품 원료성분정보 | 공공데이터포털 (식약처) | Open API | 신청 필요 |
| 위험 성분 | 화장품 사용제한 원료정보 | 식약처 | Open API | 신청 필요 |
| 기능성 제품 | 기능성화장품 보고품목정보 | 식약처 | Open API | 신청 필요 |
| 규제 정보 | 화장품 규제정보 | 식약처 | Open API | 신청 필요 |

### 2.1 AI Hub 데이터 구조
- 안면 이미지 ~13,936장
- 피부 상태 측정 데이터 ~84,688건
- 라벨링 데이터 ~125,424건
- 연령: 10~60대 이상, 남녀 1,100명
- 촬영 장비: 디지털 카메라, 스마트패드, 스마트폰
- 촬영 각도: 최대 7각도
- 라벨: 전문의 5인 육안 평가 + 정밀 기기 측정값 (색소침착, 입술건조도, 모공, 턱선처짐, 주름 등)

**다운로드 우선순위** (전체 다운 오래 걸려서 샘플로 시작):
1. `Other.zip` (171KB) — 메타정보/README
2. `TL.zip` (47MB) — Training 라벨
3. `VL.zip` (6MB) — Validation 라벨
4. `VS.zip` (2GB) — Validation 이미지
5. `TS.zip` (19GB) — Training 이미지 (마지막)

### 2.2 백업 데이터 (AI Hub 승인 지연 대비)
- Kaggle "Skin Type" 데이터셋 (oily/dry/normal ~700장)
- ACNE04 (여드름 severity ~1,400장)
- Kaggle "Cosmetics Datasets" (Sephora 기반 ~1,500 제품)

### 2.3 데이터 보관 원칙
- **AI Hub 데이터는 재배포 금지** → `.gitignore`에 `data/` 추가, GitHub에 절대 push 금지
- 학습된 모델 가중치만 공유 가능
- 비상업 연구·교육 목적임을 발표·보고서에 명시

---

## 3. 입력 폼 설계

### 3.1 필수 입력 (7)
1. **연령대** (10대/20대/30대/40대/50대 이상) — 드롭다운
2. **성별** (M/F/무응답) — 라디오
3. **민감도** (매우 민감/민감/보통/둔감) — 라디오 ⭐ 이미지로 추정 불가
4. **알레르기 성분** (알코올/향료/에센셜오일/파라벤/기타) — 멀티 체크
5. **현재 피부 고민** (여드름/모공/색소침착/건조함/주름/탄력/홍조/트러블) — 멀티 체크, 최대 3개
6. **예산 범위** (1만원 이하/1~3만원/3~5만원/5만원 이상) — 라디오
7. **선호 카테고리** (스킨토너/에센스/크림/선크림 등) — 멀티 체크

### 3.2 선택 입력 (5) — Ablation Study용
8. 계절별 피부 변화 (겨울 건조/여름 유분/사계절 비슷/환절기 트러블)
9. 자외선 노출 (적음/보통/많음)
10. 수면/스트레스 수준
11. 임신/수유 여부 (회피 성분 추가 필터)
12. 비건/크루얼티프리 선호

### 3.3 폼 입력의 모델 통합 방식 (중요)
**Late Fusion 채택**:
```
CNN → 피부 속성 벡터 (7차원)
폼  → 원핫/임베딩 벡터 (~20차원)
        ↓ concat
   [27차원 통합 벡터]
        ↓
   추천 모듈
```

**각 폼 항목 위치**:
- 모델 입력: 연령대, 성별
- 추천 단계 feature: 민감도, 알레르기, 현재 고민
- 후처리 필터: 예산, 카테고리, 임신 여부, 비건 선호

---

## 4. 모델 설계

### 4.1 Module 1: CNN (Multi-task)
- **Backbone**: EfficientNet-B0 (ImageNet pre-trained)
- **Head 구조** (속성별 독립 head):
  - 회귀 (regression): 유분도, 건조도, 색소침착, 모공, 주름
  - 분류 (classification): 여드름 정도 (0~3), 민감 여부
- **Loss**: `MSE(회귀) + CrossEntropy(분류)` weighted sum
- **Augmentation**: 좌우 flip, 약한 색상 변화(피부톤 보존), random crop, rotation
- **시작 방식**: 단일 속성 분류 베이스라인 → multi-task 확장

### 4.2 Module 2: 성분 매칭
- **속성 → 권장 성분 매핑 테이블** (피부과 가이드라인 참고해서 직접 구축):
  - 건조도 높음 → 히알루론산, 세라마이드, 글리세린, 스쿠알란
  - 유분도 높음 → 살리실산, 나이아신아마이드, 클레이
  - 색소침착 → 비타민C, 알부틴, 트라넥삼산, 나이아신아마이드
  - 주름 → 레티놀, 펩타이드, 비타민C
  - 모공 → 살리실산, AHA
  - 민감 → 센텔라, 판테놀, 마데카소사이드
  - 여드름 → 살리실산, 티트리, 벤조일퍼옥사이드
- **알레르기 → 회피 성분**: 식약처 데이터 + 폼 입력 결합

### 4.3 Module 3: 제품 추천
- 제품 ingredient list → TF-IDF 벡터화
- 사용자 "권장 성분 set" + "회피 성분 set" → query 벡터
- Cosine similarity로 Top-K 추출
- 후처리 필터: 예산, 카테고리, 임신 여부 등

### 4.4 Module 4: 설명 생성
- 룰베이스 템플릿. LLM 안 씀.
- 예: "당신의 피부는 [건조도 높음, 민감]으로 분석됩니다. [세라마이드, 판테놀] 성분이 도움될 수 있으며, [알코올, 향료]는 피하는 것이 좋습니다. 추천 제품 [P]는 [세라마이드] 성분을 포함합니다."

---

## 5. 평가 지표

### 5.1 Module 1 (CV)
- 회귀: MAE, RMSE per attribute
- 분류: F1, Accuracy per attribute
- **킬러 비교 실험**: 영어권 데이터 학습 모델 vs 한국인 데이터 학습 모델 (test: 한국인 데이터)

### 5.2 Module 3 (추천)
- Hit@K, MRR (리뷰 데이터에서 proxy ground truth)
- 정성 평가: 팀원/지인 5~10명 대상 만족도 설문

### 5.3 Ablation Study (발표 어필)
- 폼 입력 없이 CV만 vs 폼 입력 포함
- Multi-task vs Single-task CNN
- 선택 입력 항목 사용 vs 미사용

---

## 6. 12주 일정

| 주차 | 작업 |
|---|---|
| W1 | AI Hub + 식약처 API 신청, 환경 셋업, 팀 역할 분담, 백업 데이터 확보 |
| W2 | EDA, 라벨 구조 파악, 라벨 검수 (샘플 200장) |
| W3 | 식약처 API 데이터 수집 + DB 구축, 성분-속성 매핑 테이블 |
| W4 | CNN 베이스라인 (단일 속성 분류) |
| W5 | Multi-task CNN 확장, 학습/검증 |
| W6 | **중간 점검** — 베이스라인 완성, 중간 발표 |
| W7 | 추천 모듈 구현 (TF-IDF + 후처리 필터) |
| W8 | 모듈 통합, end-to-end 파이프라인 |
| W9 | 데모 인터페이스 (Streamlit/Gradio) |
| W10 | Ablation study, 영어 vs 한국 데이터 비교 실험 |
| W11 | 정성 평가, 최종 모델 튜닝 |
| W12 | 최종 발표, 보고서, 코드 정리, 시연 영상 |

---

## 7. 팀 역할 분담 (3~4인)

- **A (데이터)**: AI Hub 데이터 처리, 식약처 API 수집, DB 구축
- **B (CV)**: CNN 모델 학습/평가, multi-task 설계
- **C (추천)**: 성분 매핑, TF-IDF, 추천 로직, 후처리 필터
- **D (통합/데모)**: 폼 설계, Streamlit/Gradio 데모, 발표·보고서 주도

---

## 8. 프로젝트 폴더 구조

```
skin-project/
├── data/                  # .gitignore (재배포 금지)
│   ├── raw/
│   │   ├── aihub/         # AI Hub 원본
│   │   └── mfds/          # 식약처 API 응답
│   ├── processed/         # 전처리된 데이터
│   └── README.md          # 데이터 출처/약관 명시
│
├── notebooks/             # 탐색용 주피터
│   ├── 01_eda_aihub.ipynb
│   ├── 02_eda_mfds.ipynb
│   ├── 03_baseline_cnn.ipynb
│   └── 04_recommendation.ipynb
│
├── src/
│   ├── data/
│   │   ├── aihub_loader.py
│   │   ├── mfds_api.py
│   │   └── dataset.py     # PyTorch Dataset
│   ├── models/
│   │   ├── cnn.py         # EfficientNet 기반
│   │   └── multitask.py
│   ├── train/
│   │   ├── train.py
│   │   ├── eval.py
│   │   └── losses.py
│   ├── recommend/
│   │   ├── ingredient_map.py
│   │   ├── product_search.py
│   │   └── explainer.py
│   ├── form/
│   │   └── schema.py      # 폼 입력 스키마
│   └── utils/
│
├── configs/
│   ├── baseline.yaml
│   └── multitask.yaml
│
├── app/                   # 데모
│   └── streamlit_app.py
│
├── reports/               # 보고서, 발표자료
│
├── requirements.txt
├── README.md
├── .gitignore
└── PROJECT_PLAN.md        # 이 문서
```

---

## 9. 환경 셋업

### 9.1 requirements.txt
```
# Core
torch>=2.0
torchvision>=0.15
numpy>=1.24
pandas>=2.0
pillow>=10.0

# ML / utils
scikit-learn>=1.3
albumentations>=1.3
timm>=0.9              # EfficientNet 등 모델
tqdm

# Visualization / EDA
matplotlib
seaborn
jupyter

# API / 데이터 수집
requests
beautifulsoup4

# Demo
streamlit              # 또는 gradio

# Config
pyyaml
hydra-core             # 선택 (configs 관리)
```

### 9.2 .gitignore
```
# Data
data/
*.zip
*.tar.gz

# Models
*.pth
*.ckpt
checkpoints/
runs/

# Python
__pycache__/
*.pyc
.ipynb_checkpoints/
.venv/
venv/

# IDE
.vscode/
.idea/

# OS
.DS_Store

# API keys
.env
configs/secrets.yaml
```

### 9.3 초기 설치
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

## 10. 단계별 실행 가이드 (Claude Code용)

### Phase 1: 셋업 (Day 1)
1. 프로젝트 폴더 구조 생성 (위 8번 참조)
2. `requirements.txt`, `.gitignore`, `README.md` 작성
3. GitHub 레포 초기화
4. 가상환경 + 패키지 설치 확인

### Phase 2: 샘플 데이터 EDA (Day 2~3)
**위치**: `notebooks/01_eda_aihub.ipynb`

확인할 항목:
1. **라벨 파일 구조**
   - JSON 한 파일 = 한 사람? 한 이미지?
   - 어떤 속성? 정량값(0~100)? 범주(상/중/하)?
   - 전문의 평가 vs 측정기기 값 분리 여부
   - 메타데이터: 연령, 성별, 촬영 장비, 각도
2. **이미지 파일**
   - 해상도, 모드
   - 7각도 구분 방식 (파일명? 폴더?)
   - 장비별 (카메라/패드/폰) 데이터 분포
3. **이미지-라벨 매칭** (가장 중요)
   - 매칭 키 확인
4. **라벨 분포**
   - 클래스 불균형
   - 결측치 비율
   - 연령/성별 분포

코드 템플릿:
```python
import json
from pathlib import Path
import pandas as pd
from PIL import Image

# 라벨 로드
label_files = list(Path("data/raw/aihub/labels").rglob("*.json"))
print(f"라벨 파일 개수: {len(label_files)}")

with open(label_files[0], encoding="utf-8") as f:
    sample = json.load(f)
print(json.dumps(sample, indent=2, ensure_ascii=False))

# 이미지 확인
img_files = list(Path("data/raw/aihub/images").rglob("*.jpg"))
print(f"이미지 개수: {len(img_files)}")
img = Image.open(img_files[0])
print(f"해상도: {img.size}, 모드: {img.mode}")

# 전체 라벨 → DataFrame
records = []
for f in label_files:
    with open(f, encoding="utf-8") as fp:
        records.append(json.load(fp))
df = pd.DataFrame(records)
print(df.describe())
df.hist(figsize=(15, 10))
```

### Phase 3: 식약처 API 수집 (Day 2~5, 병렬)
**위치**: `src/data/mfds_api.py`

작업:
1. 공공데이터포털에서 API 키 발급
2. API 4종 호출 → JSON/CSV 저장
3. 데이터 정제 → SQLite/Parquet
4. 성분-속성 매핑 테이블 초안 (`src/recommend/ingredient_map.py`)

### Phase 4: CNN 베이스라인 (Week 1~2)
**위치**: `src/models/cnn.py`, `src/train/train.py`

**시작은 단일 속성 단일 분류**:
- 타겟: 유분도 1개만, 3-class
- 모델: EfficientNet-B0 pretrained
- 목표: validation accuracy 60% 이상 (33% baseline)

코드 템플릿:
```python
# src/data/dataset.py
import torch
from torch.utils.data import Dataset
from PIL import Image

class SkinDataset(Dataset):
    def __init__(self, df, img_dir, transform=None):
        self.df = df
        self.img_dir = img_dir
        self.transform = transform

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        img = Image.open(self.img_dir / row['image_path']).convert('RGB')
        if self.transform:
            img = self.transform(img)
        label = row['oiliness_class']  # 단일 타겟부터
        return img, label

# src/models/cnn.py
import torch.nn as nn
import timm

def build_baseline_model(num_classes=3):
    model = timm.create_model('efficientnet_b0', pretrained=True, num_classes=num_classes)
    return model
```

### Phase 5: Multi-task 확장 (Week 3)
- 베이스라인 검증 후 7개 속성 head 추가
- Weighted loss tuning

### Phase 6: 추천 모듈 (Week 4)
**위치**: `src/recommend/`

- `ingredient_map.py`: 속성 → 성분 매핑
- `product_search.py`: TF-IDF 기반 제품 검색
- `explainer.py`: 추천 이유 템플릿 생성

### Phase 7: 통합 + 데모 (Week 5~6)
**위치**: `app/streamlit_app.py`

- Streamlit으로 폼 + 이미지 업로드 UI
- 결과 페이지: 속성 점수 + 추천 성분 + 추천 제품 + 이유

---

## 11. 위험 요소 & 대응

| 위험 | 대응 |
|---|---|
| AI Hub 데이터 다운/처리 지연 | 샘플 데이터로 선행, 백업 데이터(Kaggle)로 파이프라인 검증 |
| GPU 자원 부족 | 학교 클러스터 신청 / Colab Pro / Kaggle 노트북 |
| 라벨 노이즈 | W2에 샘플 200장 직접 검수, 노이즈 분석 |
| 추천 결과 평가 어려움 | 지인 정성 평가 + 리뷰 기반 proxy 평가 |
| "진단" 용어 지적 | 보고서/발표 전수 검토, "분석/추정"으로 통일 |
| 시연 폼 입력 시간 | 프리셋 페르소나 3~5개 준비 |
| 클래스 불균형 | weighted sampling, focal loss 검토 |
| Train/Val leakage | 같은 사람 이미지가 양쪽에 들어가지 않게 split (person-level split) |

---

## 12. 발표 예상 질문 & 답변

| 질문 | 답변 |
|---|---|
| 왜 영어권 데이터 안 쓰고 AI Hub? | 인종 편향 극복 + K-뷰티 적용. 실험으로 성능 차이 입증. |
| 추천 정확도 검증? | Hit@K + 정성 평가 + ablation study |
| 이미지로 민감도까지 알 수 있나? | 못함. 그래서 폼 입력으로 분리. 이게 멀티모달 설계 의도. |
| 의료 진단 아닌가? | 진단 아님. 화장품 추천 보조 도구. 의료 행위 회피 가이드라인 준수. |
| GPT/LLM 안 쓰는 이유? | 학부 ML 프로젝트 범위. 룰베이스로 해석 가능성 확보. Future work에서 LLM 설명 생성 검토. |
| 데이터 출처 합법성? | 전부 AI Hub + 공공데이터포털 공식 채널. 비상업 연구·교육 목적. |

---

## 13. 차별화 어필 슬라이드 5장 (발표용)

1. **문제 정의**: 기존 영어권 데이터 기반 시스템의 한국인 적용 한계
2. **데이터**: AI Hub 한국인 피부 데이터 + 식약처 공공 데이터 (윤리·법 OK)
3. **아키텍처**: 멀티모달 입력 (이미지 + 폼), Multi-task CNN
4. **결과**: 7개 속성 추정 성능 + 영어 vs 한국 데이터 비교 + Ablation
5. **응용**: K-뷰티 산업 연결, 회피 성분 제시로 안전성 강화

---

## 14. 다음 단계 (지금 당장)

### 오늘
- [ ] 프로젝트 폴더 구조 생성
- [ ] GitHub 레포 초기화 + `.gitignore` 설정
- [ ] `requirements.txt` 작성 + 가상환경 셋업
- [ ] 공공데이터포털 식약처 API 4종 활용 신청
- [ ] 샘플 데이터 압축 풀고 폴더 구조 확인

### 이번 주
- [ ] `notebooks/01_eda_aihub.ipynb` 작성 — 라벨 구조 파악
- [ ] 라벨 JSON 1개 분석 → 어떤 속성을 학습 타겟으로 쓸지 결정
- [ ] 식약처 API 응답 구조 확인 → `src/data/mfds_api.py` 초안
- [ ] 성분-속성 매핑 테이블 초안 (50개 성분 정도)

### 다음 주
- [ ] 단일 속성 베이스라인 CNN 학습
- [ ] Validation accuracy 60% 이상 달성

---

## 15. 참고 자료

- AI Hub 한국인 피부상태 측정 데이터: https://www.aihub.or.kr/aihubdata/data/view.do?dataSetSn=71645
- 공공데이터포털 식약처 화장품 원료성분정보: https://www.data.go.kr/data/15111774/openapi.do
- 식약처 화장품 사용제한 원료정보: https://www.data.go.kr/data/15111772/openapi.do
- 식약처 기능성화장품 보고품목정보: https://www.data.go.kr/data/15095680/openapi.do

---

**문서 끝.**
**Claude Code에서 이 문서를 기반으로 작업을 시작하세요. 막히는 부분이 있으면 이 문서의 해당 섹션을 참조하거나, 새로 결정해야 할 사항은 팀과 논의 후 이 문서를 업데이트하세요.**
