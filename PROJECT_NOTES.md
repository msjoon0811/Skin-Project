# 한국인 피부 분석 기반 맞춤형 화장품 추천 시스템
## 프로젝트 전체 기록 — 개인 비서 노트

> 작성일: 2026-06-01  
> 브랜치: develop  
> 팀: 학부 ML 학기 프로젝트 (3~4인)

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택 및 환경](#2-기술-스택-및-환경)
3. [데이터 구조](#3-데이터-구조)
4. [전체 시스템 아키텍처](#4-전체-시스템-아키텍처)
5. [모델 진화 경로 (v1 → v5 + acne)](#5-모델-진화-경로)
6. [멀티태스크 CNN 상세](#6-멀티태스크-cnn-상세)
7. [여드름 전용 모델 상세](#7-여드름-전용-모델-상세)
8. [추론 파이프라인 상세](#8-추론-파이프라인-상세)
9. [속성별 점수 계산 로직](#9-속성별-점수-계산-로직)
10. [종합점수 공식 변천사](#10-종합점수-공식-변천사)
11. [성분·제품 추천 로직](#11-성분제품-추천-로직)
12. [이번 세션 전체 수정 내역](#12-이번-세션-전체-수정-내역)
13. [현재 시스템 한계 및 문제점](#13-현재-시스템-한계-및-문제점)
14. [파일 구조](#14-파일-구조)
15. [서버 실행 방법](#15-서버-실행-방법)
16. [Future Work](#16-future-work)

---

## 1. 프로젝트 개요

### 한 줄 정의
사용자의 셀카 이미지 + 폼 입력을 받아, 한국인 피부 데이터로 학습한 CNN으로 피부 속성을 추정하고, **하드코딩 룰 기반 성분 추천 + Claude AI·네이버 쇼핑 API 기반 실제 구매 가능 제품 추천**을 제공하는 시스템.

### 추천 시스템 실제 구조 ⚠️

| 추천 종류 | 실제 소스 | 비고 |
|---------|---------|------|
| **권장·회피 성분** | `ingredient_map.py` 하드코딩 룰 테이블 | 피부과 지식 기반 수동 작성, CSV 조회 없음 |
| **실제 제품** | **Claude Haiku** 검색어 생성 → **네이버 쇼핑 API** | 이미지·가격·링크 포함, 실패 시 빈 배열 |
| **피부 분석 설명** | **Claude Haiku** (구조화 JSON) | API 키 없으면 룰베이스 폴백 |

**식약처 데이터 실제 사용 현황**:
- `FunctionalProductSearch` 클래스 (functional.csv) → 정의는 있으나 `analyze` 엔드포인트에서 **호출 없음** (데드 코드)
- `ingredient.csv`, `restricted.csv`, `regulation.csv` → 현재 추론 파이프라인에서 **미사용**
- 식약처 데이터는 프로젝트 초기 수집했으나 현재 서비스 플로우에서 제외됨

### 차별화 포인트
- **한국인 전용 학습 데이터**: AI Hub 한국인 피부상태 측정 데이터 11,154장 (비상업 연구·교육 목적)
- **멀티태스크 CNN**: 7개 피부 속성 동시 예측
- **여드름 전용 모델**: EfficientNetV2-M, acc=85.29% (팀원 학습)
- **이미지 + 폼 멀티모달**: CNN이 못 잡는 주관적 정보는 폼으로 보완
- **실제 구매 가능 제품**: Claude + 네이버 쇼핑 API — 이미지·가격·구매 링크 포함
- **Claude AI 피부 설명**: 분석 결과를 자연어로 개인화 생성
- **"진단" 금지**: "분석·추정·추천"으로 통일

### 개발 원칙
1. 의료 진단 표현 절대 금지 → "분석", "추정", "추천"으로 대체
2. 학습 데이터: AI Hub 공식 채널 (비상업 교육 목적)
3. 제품 추천: Claude AI + 네이버 쇼핑 API
4. 단계별 진행: 베이스라인 → 멀티태스크 → 통합 → 개선

---

## 2. 기술 스택 및 환경

| 항목 | 내용 |
|------|------|
| OS | Windows 11 Pro |
| GPU | RTX 5070 Ti (VRAM 15.9GB) |
| CUDA | 13.0 |
| Python | 3.12 (venv) |
| PyTorch | 2.11.0+cu128 |
| 백엔드 | FastAPI 0.4 + uvicorn |
| 프론트엔드 | React (design/ 폴더, vanilla JSX) |
| 데모 UI | Streamlit 1.57.0 |
| 모델 라이브러리 | timm (EfficientNet-B0), torchvision (EfficientNetV2-M) |
| DB | SQLite (data/history.db) |
| 외부 API | 네이버 쇼핑 API (제품 조회), Claude Haiku API (검색어 생성·분석 설명) |

### 실행 명령
```bash
# 백엔드 (React 프론트엔드 포함)
python -m uvicorn api.server:app --reload

# 데모 앱
streamlit run app/streamlit_app.py

# venv 활성화
.\venv\Scripts\activate
```

---

## 3. 데이터 구조

### 3.1 AI Hub 데이터

**경로**: `028.한국인 피부상태 측정 데이터/3.개방데이터/1.데이터/`

| 폴더 | 내용 | 크기 |
|------|------|------|
| Training/01.원천데이터 | 학습 이미지 11,154장 | 해제됨 |
| Training/02.라벨링데이터 | 학습 JSON 라벨 100,386개 | 해제됨 |
| Validation/01.원천데이터 | 검증 이미지 1,391장 | 해제됨 |
| Validation/02.라벨링데이터 | 검증 JSON 라벨 12,519개 | 해제됨 |

**JSON 구조 (한 파일 = 한 이미지의 한 얼굴부위)**
```json
{
  "info": {
    "filename": "0001_01_F.jpg",
    "id": "0001",
    "gender": "F",
    "age": 55,
    "skin_type": 0,
    "sensitive": 1
  },
  "images": {
    "device": 0,
    "facepart": 0,
    "bbox": [x1, y1, x2, y2]
  },
  "annotations": {
    "acne": null | [{name, points}],
    "forehead_wrinkle": 0~6,
    "forehead_pigmentation": 0~5,
    "l_perocular_wrinkle": 0~6,
    "l_cheek_pore": 0~4,
    "l_cheek_pigmentation": 0~5,
    "r_cheek_pore": 0~4,
    "r_cheek_pigmentation": 0~5,
    "lip_dryness": 0~4,
    "chin_sagging": 0~5,
    "glabellus_wrinkle": 0~6
  },
  "equipment": {
    "forehead_moisture": 75.0,
    "l_cheek_pore_count": 608,
    ...
  }
}
```

**skin_type 코드**: 0=건성, 1=지성, 3=복합건성, 4=복합지성, 5=중성

**acne 처리 방식**:
- null → grade 0 (없음)
- 병변 수 → 심각도: 0개=0, 1-5=1, 6-15 또는 cyst/pustule=2, 16+또는 다발성cyst=3

### 3.2 식약처 데이터 (수집했으나 현재 미사용)

**경로**: `data/raw/mfds/`

| 파일 | 건수 | 현재 상태 |
|------|------|---------|
| ingredient.csv | 21,801건 | **미사용** — 성분 추천은 하드코딩 룰 테이블로 대체 |
| restricted.csv | 31,191건 | **미사용** |
| functional.csv | 190,630건 | **미사용** — `FunctionalProductSearch` 클래스 존재하나 호출 안 됨 |
| regulation.csv | 7,257건 | **미사용** |

> 프로젝트 초기에 식약처 Open API로 수집 완료했으나, 이후 제품 추천이 Claude+네이버 API 방식으로 교체되면서 실질적으로 사용되지 않게 됨.

### 3.3 사용하지 않는 AI Hub 데이터

멀티태스크 모델에서 **학습했지만 현재 미사용**:
- `r_cheek_pore`, `r_cheek_pigmentation` — 오른쪽 볼 (왼쪽만 사용 중)
- `r_perocular_wrinkle` — 오른쪽 눈가
- `glabellus_wrinkle` — 미간 주름

**이미지로 판단 불가라 학습 대상 제외**:
- equipment 측정값 (수분, 탄력 R0~R9, 주름 Ra 등) — 추론 시 사용 불가
- 피험자 나이/성별 — 폼 입력으로 대체

---

## 4. 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  입력 레이어                                              │
│  [셀카 이미지] + [폼 입력] + [생활습관]                   │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
┌────────▼──────────┐    ┌────────▼──────────┐
│ MultiTask CNN v5  │    │ Acne Severity     │
│ EfficientNet-B0   │    │ EfficientNetV2-M  │
│ + CORAL Loss      │    │ acc=85.29%        │
│ 7속성 동시 예측    │    │ 4-class 심각도    │
│ val_acc=51.7%     │    │ (팀원 학습)        │
└────────┬──────────┘    └────────┬──────────┘
         │                        │
         └───────────┬────────────┘
                     │
          normalize_cnn_output()
          7속성 → {wrinkle, pigmentation,
                   pore, dryness, sagging,
                   acne} (0~100)
                     │
          build_frontend_attrs()
          폼+CNN+생활습관 → 7속성 최종값
          + 폼 보정 (주름 cap, 여드름 보정)
                     │
          composite_score()
          육안 3요소 기반 종합점수
                     │
┌────────────────────▼────────────────────┐
│  출력 레이어                              │
│  - 7개 속성 낮음/중간/높음               │
│  - 종합점수 (10~95)                      │
│  - 피부타입 라벨                          │
│  - 권장/회피 성분                         │
│  - 추천 제품 Top 3                        │
│  - Claude AI 설명                        │
└─────────────────────────────────────────┘
```

---

## 5. 모델 진화 경로

### 베이스라인
- **목표**: 단일 속성 3-class 분류로 시스템 구축 가능 여부 확인
- **결과**: forehead_wrinkle val_acc = **70.09%** (이마 주름만)
- **의의**: 파이프라인 검증 완료, 이후 멀티태스크 확장의 기준선

### v1 → v5 진화

| 버전 | Backbone | 손실함수 | val_acc | 상태 | 비고 |
|------|----------|---------|---------|------|------|
| v1 | EfficientNet-B0 | CrossEntropy | 낮음 | 폐기 | 초기 버전 |
| **v2** | EfficientNet-B0 | CrossEntropy | **51.70%** | 이전 Streamlit 사용 | 안정 버전 |
| v3 | EfficientNet-B3 | CrossEntropy | 낮음 | 폐기 | B3 과적합 |
| v4 | EfficientNet-B3 | CORAL | 낮음 | 폐기 | B3 여전히 과적합 |
| **v5** | EfficientNet-B0 | **CORAL** | 51.70%+ | **현재 사용** | 경량화+순서형 |

### v3/v4 실패 원인
B3는 파라미터가 너무 많아(43MB) 11,000장 데이터로 과적합. B0로 축소(16MB)하고 CORAL 손실로 교체.

### CORAL 손실이란
Ordinal Regression 방법. 주름 0→1→2→3 같이 순서가 있는 분류에서 "2를 0으로 예측하는 것"이 "2를 1로 예측하는 것"보다 더 나쁜 패널티를 줌. 일반 CrossEntropy는 이 순서 관계를 무시.

```
CORAL Head: Linear(1280 → K-1)  # K = 클래스 수
예측: sigmoid(logit) > 0.5 → 임계값 개수 합산 = 등급
```

### v5 하이퍼파라미터
```python
BACKBONE     = "efficientnet_b0"
DROPOUT      = 0.4   # v4 0.3에서 강화
WEIGHT_DECAY = 2e-4  # v4 1e-4에서 강화
EPOCHS       = 20
LR           = 1e-4  (AdamW)
SCHEDULER    = CosineAnnealingLR(T_max=20, eta_min=1e-6)
BATCH_SIZE   = 32
AUGMENTATION = RandomCrop + HorizontalFlip + ColorJitter +
               RandomRotation(15) + RandomPerspective +
               GaussianBlur + RandomErasing(p=0.2)
```

---

## 6. 멀티태스크 CNN 상세

### 6.1 학습 대상 속성 (MULTITASK_TARGETS)

```python
MULTITASK_TARGETS = [
    "forehead_wrinkle",       # 이마 주름 0~6 (7클래스)
    "forehead_pigmentation",  # 이마 색소침착 0~5 (6클래스)
    "l_perocular_wrinkle",    # 왼쪽 눈가 주름 0~6 (7클래스)
    "l_cheek_pore",           # 왼쪽 볼 모공 0~4 (5클래스)
    "l_cheek_pigmentation",   # 왼쪽 볼 색소침착 0~5 (6클래스)
    "lip_dryness",            # 입술 건조도 0~4 (5클래스)
    "chin_sagging",           # 턱 탄력/처짐 0~5 (6클래스)
]
```

### 6.2 모델 구조 (MultiTaskSkinModelCORAL)

```
Input: 224×224×3

EfficientNet-B0 Backbone (pretrained=True, num_classes=0)
  → GlobalAvgPool → 1280차원 feature

Dropout(p=0.4)

7개 독립 CORAL Head:
  forehead_wrinkle:      Linear(1280 → 6)   # K-1=6
  forehead_pigmentation: Linear(1280 → 5)   # K-1=5
  l_perocular_wrinkle:   Linear(1280 → 6)
  l_cheek_pore:          Linear(1280 → 4)
  l_cheek_pigmentation:  Linear(1280 → 5)
  lip_dryness:           Linear(1280 → 4)
  chin_sagging:          Linear(1280 → 5)

Output: dict {target_name → logits (batch, K-1)}
```

### 6.3 얼굴 부위 크롭 전략

CNN이 각 속성에 최적화된 얼굴 부위만 보도록 크롭 적용.

```python
FACEPART_TARGETS = {
    "forehead":   ["forehead_wrinkle", "forehead_pigmentation"],
    "periocular": ["l_perocular_wrinkle"],
    "cheek":      ["l_cheek_pore", "l_cheek_pigmentation"],
    "lips":       ["lip_dryness"],
    "chin":       ["chin_sagging"],
}
```

얼굴 감지: OpenCV Haar Cascade → 얼굴 bbox → 비율로 각 부위 크롭.

### 6.4 TTA (Test-Time Augmentation)

3종 변형 적용 후 평균:
```python
_TTA_TRANSFORMS = [
    원본 이미지,
    ColorJitter(brightness=0.15),
    ColorJitter(brightness=(0.7, 0.9)),
]
```

CORAL 예측 방식 (신뢰도 블렌딩 제거 후):
```python
# logit 평균 → sigmoid → 임계값 합산
sigs = sigmoid(avg_logit)
grade = (sigs > 0.5).sum()  # 순수 CORAL 예측
```

> **중요**: 이전에 신뢰도 블렌딩 (`grade * confidence + mid * (1-confidence)`)을 적용했으나 모든 속성이 중간값(50점)으로 수렴하는 문제 발생 → 완전 제거.

---

## 7. 여드름 전용 모델 상세

### 7.1 모델 종류

현재 사용 중인 모델은 **EfficientNetV2-M** 기반 모델.

| 항목 | 내용 |
|------|------|
| 파일 | `checkpoints/acne_best.pth` |
| 원본 파일 | `acne_best_local(0.8529).pt` (바탕화면) |
| Backbone | torchvision EfficientNetV2-M |
| 파라미터 | 53,872,597 (약 206MB) |
| 정확도 | **85.29%** |
| 학습 데이터 | Kaggle + AI Hub |
| 에포크 | 80 epochs, allfolds |
| 출력 | 4클래스 (0=없음, 1=경증, 2=중간, 3=심함) |

### 7.2 모델 클래스 구조 (AcneSeverityModel)

```python
class AcneSeverityModel(nn.Module):
    def __init__(self):
        base = tvm.efficientnet_v2_m(weights=None)
        base.classifier = nn.Sequential(
            nn.Linear(1280, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 4),
        )
        self.backbone = base
```

### 7.3 여드름 추론 방식

전체 얼굴 이미지(크롭 없음) 사용. TTA 3종 + 신뢰도 스케일링:

```python
logit_sum = zeros(1, 4)
for tfm in tta:
    logit_sum += softmax(acne_model(tfm(img)))

probs      = logit_sum / 3
grade      = argmax(probs)
confidence = max(probs)

# confidence < 0.67이면 점수 감쇄
# 불확실 예측 (false positive) 완화
acne_score = grade/3 * 100 * min(1.0, confidence * 1.5)
```

### 7.4 폼 보정 (형태별)

여드름 모델 오분류 보정을 위해 폼 concern 선택 여부로 sanity check:

```python
# "여드름" 고민 미선택 → 과탐지 완화
if "여드름" not in concerns:
    acne_cnn = min(acne_cnn, 30.0)

# "여드름" 고민 선택 + CNN이 낮음 → 미탐지 보완
elif acne_cnn < 35:
    acne_cnn = max(acne_cnn, 40.0)
```

---

## 8. 추론 파이프라인 상세

### 8.1 전체 흐름 (FastAPI server.py)

```
POST /api/analyze
  ↓
이미지 bytes 수신
  ↓
_run_inference(img_bytes)
  ├─ crop_faceparts() → 5개 부위 크롭
  ├─ MultiTaskSkinModelCORAL → 7속성 raw grades
  ├─ _get_acne_model() → acne grade + TTA 신뢰도
  └─ normalize_cnn_output() → {wrinkle, pigmentation,
                               pore, dryness, sagging,
                               acne} (0~100)
  ↓
compute_lifestyle_deltas(form) → 생활습관 델타
  ↓
build_frontend_attrs(cnn, form, deltas)
  → 7개 속성 dict (value, level, desc)
  ↓
composite_score(fe_attrs) → 종합점수 10~95
  ↓
skin_type_label(fe_attrs, form) → "복합성 + 민감성"
  ↓
get_recommended_ingredients() → 권장 성분
  ↓
get_avoid_ingredients() → 회피 성분
  ↓
_oliveyoung_recommend() → Claude+네이버API → Top 3 제품
  ↓
_generate_explanation() → Claude AI 피부 요약
  ↓
JSON 응답 반환
```

### 8.2 생활습관 델타 (lifestyle.py)

폼의 생활습관 항목이 CNN 속성 점수에 가산:

| 항목 | 속성 영향 |
|------|---------|
| 음주 자주 | dryness +12, pigmentation +8 |
| 흡연 | wrinkle +15, pigmentation +10, sagging +8 |
| 클렌징 빠짐 | pore +15, sens_boost +10 |
| 스트레스 심함 | sens_boost +15, pigmentation +8 |
| 수면 5h 미만 | dryness +15, sagging +10 |
| 물 부족 | dryness +18 |
| 고열 샤워 | sens_boost +15, pore +8 |
| 고오염 환경 | pore +10, pigmentation +8 |
| 야식/정제탄수화물 | oil_boost +8~15, pore +5~10 |

최대 누적 ±20점.

### 8.3 normalize_cnn_output

멀티태스크 raw grade → 0~100 점수 변환:

```python
# 주름: 이마+눈가 중 최대값 (더 나쁜 부위 기준)
wrinkle = max(
    forehead_wrinkle / 6 * 100,
    l_perocular_wrinkle / 6 * 100
)

# 색소침착: 이마+볼 중 최대값
pigmentation = max(
    forehead_pigmentation / 5 * 100,
    l_cheek_pigmentation / 5 * 100
)

# 모공: 왼쪽 볼만
pore = l_cheek_pore / 4 * 100

# 건조도: 입술 건조도
dryness = lip_dryness / 4 * 100

# 탄력: 턱
sagging = chin_sagging / 5 * 100

# 여드름: grade/3 * 100 * confidence_scale
acne = grade / 3 * 100 * min(1.0, confidence * 1.5)
```

---

## 9. 속성별 점수 계산 로직

### 9.1 7개 표시 속성 (build_frontend_attrs)

| 속성 | 출처 | 계산 | 높을수록 |
|------|------|------|---------|
| **유분** | 폼 (피부타입) | SKIN_TYPE_OIL 고정값 | 나쁨 |
| **수분** | 폼+CNN | 피부타입 베이스 + lip_dryness 보정 + 건조함concern | 좋음 |
| **민감도** | 폼 (민감도 선택) | FORM_SENS_SCORE 고정값 | 나쁨 |
| **색소침착** | CNN | normalize 결과 + 생활습관 | 나쁨 |
| **주름** | CNN+폼 | normalize 결과, "주름"미선택시 52 cap | 나쁨 |
| **모공** | CNN | normalize 결과 + 생활습관 | 나쁨 |
| **여드름** | CNN+폼 | TTA+신뢰도 + concern 보정 | 나쁨 |

### 9.2 수분 계산 상세

```python
# 피부타입 기반 베이스
SKIN_TYPE_HYDRO_BASE = {
    "건성": 28, "복합건성": 38, "민감성": 42,
    "중성": 62, "복합성": 55, "복합지성": 50, "지성": 45,
}

# CNN 보정 (±12 범위)
# dryness: 0=촉촉→+12, 50=중립→0, 100=건조→-12
hydro = base + (50 - dryness) * 0.24

# 건조함 고민 → 상한 38로 강제
if "건조함" in concerns:
    hydro = min(hydro, 38)
```

### 9.3 주름 폼 보정

```python
wrinkle = cnn_wrinkle + lifestyle_delta
if "주름" not in concerns:
    wrinkle = min(wrinkle, 52.0)  # 고민 없으면 MID 상단 제한
```

이유: 주름은 본인이 가장 잘 앎. CNN이 없는 주름을 높게 예측하는 오류가 빈번하여 사용자 self-report 우선.

### 9.4 여드름 폼 보정

```python
acne_cnn = cnn["acne"]

if "여드름" not in concerns:
    acne_cnn = min(acne_cnn, 30.0)  # false positive 완화

elif acne_cnn < 35:
    acne_cnn = max(acne_cnn, 40.0)  # false negative 보완
```

### 9.5 level 판단 (전 속성 공통)

```python
if value >= 65: level = "hi"   → 높음
if value >= 35: level = "mid"  → 중간
else:           level = "lo"   → 낮음
```

---

## 10. 종합점수 공식 변천사

### 1세대: 2차 곡선 공식 (최초)

```python
p = weighted_avg(oil, pore, sens, pigment, wrinkle)
base = -0.0107*p² - 0.717*p + 100.6
score = max(15, base + adjustment)
```

문제: 대부분의 케이스에서 15점 고착 (극단 구간 과적합).

### 2세대: 선형 공식 (PR 머지 후)

```python
raw = g_avg * 0.4 + (100 - p_avg) * 0.6
scaled = raw * 0.68 + 30
```

문제: 바닥 30점 고정. 나쁜 피부(56점)와 좋은 피부(69점) 차이 13점뿐. 폼 고정값(oil=78, sens=35) 포함으로 CNN 신호 희석.

### 3세대: CNN 중심 공식 (오늘 적용)

```python
cnn_worst   = max(wrinkle, pore, pigment)
cnn_avg     = (wrinkle + pore + pigment) / 3
cnn_badness = cnn_worst * 0.4 + cnn_avg * 0.6
base = 100 - cnn_badness
```

개선: oil/sens 제거, CNN 3속성만 사용. 점수 범위 24~79 확보.

### 4세대: 육안 판단 3요소 중심 공식 (최종)

```python
# 사람이 피부를 볼 때 인식하는 순서로 가중치
visible_bad = pore * 0.40 + pigment * 0.35 + wrinkle * 0.25
base = 100 - visible_bad
base += (hydro - 50) * 0.10     # 수분 소량 보너스
base -= acne * 0.25              # 여드름 패널티 (직접 보임)
score = max(10, min(95, round(base)))
```

**가중치 근거**:
- 모공 40%: 피부결 직접 체감, 가장 눈에 띔
- 색소침착 35%: 잡티/기미, 육안으로 매우 뚜렷
- 주름 25%: 나이 관련, 상대적으로 덜 직관적
- oil 제거: 유분은 피부 특성이지 시각적 문제 기준 아님

**기대 범위**:
```
나쁜 피부  →  20~30점
보통 피부  →  40~60점
좋은 피부  →  70~90점
최악       →  10점
최고       →  95점
```

---

## 11. 성분·제품 추천 로직

### 11.1 권장 성분 (get_recommended_ingredients)

**소스**: `ingredient_map.py`의 `ATTRIBUTE_TO_RECOMMENDED` 하드코딩 딕셔너리.  
식약처 CSV를 동적으로 읽지 않음. 피부과 가이드라인 기반으로 수동 작성한 룰 테이블.

속성 점수 기반 매핑:

```
dryness   >= 65 → 히알루론산, 세라마이드, 글리세린, 스쿠알란, 판테놀
dryness   >= 35 → 글리세린, 판테놀
pigment   >= 65 → 비타민C, 알부틴, 트라넥삼산, 나이아신아마이드
wrinkle   >= 65 → 레티놀, 펩타이드, 비타민C, 아데노신
pore      >= 65 → 살리실산, AHA, 나이아신아마이드
acne      >= 65 → 살리실산, 티트리, 벤조일퍼옥사이드, 나이아신아마이드
acne 35~64     → 나이아신아마이드
홍조 concern   → 센텔라, 판테놀, 마데카소사이드
민감도 high    → 센텔라, 판테놀, 마데카소사이드, 알란토인
```

연령대 보정:
- 10대: pore +15
- 20대: pore +10
- 40대: wrinkle +10, sagging +10
- 50대+: wrinkle +20, sagging +20, pigmentation +10

### 11.2 회피 성분 (get_avoid_ingredients)

알레르기 선택 + 임신 여부:
```
알코올 → 에탄올, 알코올, SD알코올
향료   → 향료, 프래그런스, 퍼퓸
에센셜오일 → 티트리오일, 라벤더오일, 페퍼민트오일
파라벤 → 메틸파라벤, 에틸파라벤, 프로필파라벤
임신중 → 레티놀, 레틴산, 살리실산, 벤조일퍼옥사이드 추가
```

### 11.3 제품 추천

**우선순위 1**: Claude가 피부 분석 기반 네이버 쇼핑 검색어 3개 생성 → 네이버 API로 실제 제품 조회

```python
# Claude Haiku에게 요청
prompt = f"""
피부 분석: {attr_text}
피부 고민: {concerns_text}
권장 성분: {rec_text}

→ 네이버 쇼핑 검색어 3개 JSON으로 반환
  (서로 다른 제품 타입: 토너/세럼/크림 등)
"""
```

**실패 시**: `products = []` 빈 배열 반환. 식약처 DB 폴백 없음 (현재 코드에서 `_get_search()` 미호출).

---

## 12. 이번 세션 전체 수정 내역

### 12.1 v5 CORAL 모델 Streamlit 적용

**파일**: `app/streamlit_app.py`

**변경**:
- import `MultiTaskSkinModel` → `MultiTaskSkinModelCORAL`
- 체크포인트: `multitask_v2_best.pth` → `multitask_v5_best.pth`
- `load_model()` dropout=0.4, backbone_name="efficientnet_b0"
- 추론 방식: softmax+argmax → CORAL sigmoid 합산

### 12.2 acne 파이프라인 통합

**배경**: `train_acne.py`는 있었지만 `acne_best.pth`가 없었고, 파이프라인 연결도 없었음. 여드름은 폼 선택으로만 처리.

**변경 내역**:

1. `src/models/cnn.py` — `AcneSeverityModel` 클래스 추가 (EfficientNetV2-M 래퍼)
2. `src/recommend/ingredient_map.py` — `normalize_cnn_output()`에 acne 키 추가
3. `src/recommend/skin_profile.py` — `build_frontend_attrs()`에 acne 속성 추가
4. `api/server.py` — `_get_acne_model()`, acne TTA 추론 추가
5. `app/streamlit_app.py` — `load_acne_model()`, acne TTA 추론 추가

**train_acne.py 데이터 로딩 최적화**:
```python
# Before: JSON마다 rglob 호출 → O(n×m) → 수십분 소요
candidates = list(img_dir.rglob(filename))

# After: 인덱스 한 번 구축 → O(m) + O(1) 조회
img_index = {p.name: str(p) for p in img_dir.rglob("*.jpg")}
path = img_index.get(filename)
```

### 12.3 팀원 acne 모델 적용

**첫 번째 적용** (`acne_best_ep80_allfolds.pt`):
- EfficientNetV2-M, 80 epochs, 5380만 파라미터, Kaggle+AI Hub 학습
- 구조 확인: 첫 conv [24,3,3,3] → EfficientNetV2-M 확인
- AcneSeverityModel로 완벽 로드 (missing/unexpected 없음)

**두 번째 적용** (`acne_best_local(0.8529).pt`):
- 동일 구조, **정확도 85.29%**로 대폭 향상
- `checkpoints/acne_best.pth`에 복사하여 교체

### 12.4 PR 머지 (팀원 작업 반영)

**PR #9 (feature/jongin-improvements-2)**:
- UI/UX 2차 개선

**PR #10 (feature/jongin-cam-mypage)**:
- 웹캠 촬영 기능
- 분석 폼 자동완성 (마지막 분석 데이터 불러오기)
- `api/server.py` 대폭 개선:
  - `_oliveyoung_recommend()` 추가: Claude가 검색어 생성 → 네이버 API로 실제 제품
  - `api/db.py` 확장: 알림, 식단 일기, 위시리스트, 프로필
  - 인증 시스템 강화

**충돌 해결**: `api/server.py`에서 팀원의 `_naver_search`, `_oliveyoung_recommend`와 내 acne 코드 병합.

### 12.5 신뢰도 블렌딩 제거

**문제**: 멀티태스크 속성에 신뢰도 블렌딩 적용 시 모든 속성이 중간값으로 수렴.

```python
# 제거된 코드 (주름=56, 56, 56 고착 원인)
confidence = min(1.0, (sigs - 0.5).abs().mean() * 3.0)
mid = ANNOTATION_MAX[t] / 2.0
preds[t] = grade * confidence + mid * (1 - confidence)

# 현재: 순수 CORAL 예측
preds[t] = (sigs > 0.5).sum()
```

CORAL 모델은 자체적으로 순서형 회귀를 처리하므로 추가 블렌딩이 불필요했음.

### 12.6 폼에서 여드름/트러블 항목 처리

**흐름**:
- 제거: `analyze.jsx`, `streamlit_app.py`에서 "트러블" 삭제
- 여드름 재추가: CNN 모델이 있어도 보조 신호로 유지 (이미지 없는 케이스 폴백)
- 역할 재정립: CNN 우선, 폼은 false positive/negative 보정용

```
이미지 있음 → CNN acne 모델 판단 (폼은 보정 역할만)
이미지 없음 → 폼 "여드름" 선택 → acne=70 힌트
```

### 12.7 톤 균일도 삭제

**문제**: `tone = 90 - sagging * 0.8` → chin_sagging이 항상 0으로 예측돼 tone이 항상 90 HIGH로 고착.

**해결**: 톤 균일도 속성 자체를 제거. sagging은 여전히 ingredient recommendation에서 내부 활용.

**삭제 범위**:
- `ATTR_DESC`에서 "tone" 제거
- `build_frontend_attrs()`에서 tone 항목 제거
- `composite_score()`에서 tone 제거

### 12.8 수분(hydro) 재설계

**기존 문제**: `hydro = 100 - lip_dryness` → 입술 건조도 하나로 전체 피부 수분 역산. 입술만 건조해도 수분 낮음 표시.

**새로운 공식**:
```python
# 피부타입 기반 베이스 (가장 신뢰 가능)
base = SKIN_TYPE_HYDRO_BASE[skin_type]

# CNN lip_dryness로 소폭 보정 (±12)
base += (50 - dryness_cnn) * 0.24

# 생활습관 영향
base -= lifestyle_deltas["dryness"]

# 건조함 고민 → 수분 낮음 보장
if "건조함" in concerns:
    base = min(base, 38)
```

### 12.9 연령 기반 주름 캡 → 폼 concern 기반 캡으로 전환

**처음 시도**: 연령대별 주름 최대값 설정 (20대 → 40 cap).

**문제**: CNN 판단이 나이에 의존하게 되어 이미지 분석 의미 퇴색. 30대 실제 주름 환자가 40캡에 잘려버림.

**최종 방식**: 연령 캡 제거 → "주름" 고민 선택 여부로 전환.
```
"주름" 선택 → CNN 무제한
"주름" 미선택 → CNN 52 cap (주름은 본인이 앎)
```

### 12.10 종합점수 4세대 공식

**변경 이유**: 2/3세대 공식이 oil/sens 폼 고정값을 포함해 피부 상태가 다른 3개 케이스 점수 차이가 13점에 불과.

**새 공식 핵심**: 육안으로 가장 직접 보이는 3가지에 가중치 집중.
```
모공 40% + 색소침착 35% + 주름 25% = visible_bad
score = 100 - visible_bad + hydro보너스 - acne패널티
```

oil 패널티 완전 제거: 지성 피부라도 모공/색소침착/여드름 없으면 점수 높아야 함.

### 12.11 결과 화면 숫자 → 낮음/중간/높음 변경

**파일**: `design/skin/screens/results.jsx`

**변경**:
```jsx
// Before
<span className="val">{a.value}</span>
<div className="val">{a.value}/100</div>

// After
<span className={"tag tag-" + a.level}>
  {a.level === 'hi' ? '높음' : a.level === 'lo' ? '낮음' : '중간'}
</span>
```

**이유**: 모델 val_acc 51.7%에서 "56점"과 "48점"의 차이는 신뢰 불가. 반면 HIGH/MID/LOW 3단계 분류는 70~80% 신뢰 가능. 등급 표시가 모델 정확도에 맞는 정직한 표현.

바 차트의 너비는 여전히 `a.value + '%'`로 시각적 차이 유지.

### 12.12 explainer.py ATTR_KO 업데이트

```python
# Before (sagging 포함, acne 없음)
ATTR_KO = {
    "wrinkle": "주름", "pigmentation": "색소침착",
    "pore": "모공", "dryness": "건조도", "sagging": "탄력저하"
}

# After (acne 추가, sagging 제거)
ATTR_KO = {
    "acne": "여드름", "wrinkle": "주름",
    "pigmentation": "색소침착", "pore": "모공", "dryness": "건조도"
}
```

이유: 여드름이 표시 속성에 추가됐으므로 summary 텍스트에도 반영 필요. sagging은 더 이상 표시 속성이 아님.

### 12.13 server.py concern 힌트 버그 수정

```python
# Before (여드름 → pore만)
"여드름": {"pore": 60},
"트러블": {"pore": 55},

# After (acne 키 추가)
"여드름": {"acne": 70, "pore": 50},
"트러블": {"acne": 55, "pore": 45},
```

이미지 없을 때 여드름 concern이 acne 점수로 직접 반영되지 않던 버그.

### 12.14 lifestyle_adjusted_attrs에 acne 추가

```python
# Before
for k in ("wrinkle", "pigmentation", "pore", "dryness", "sagging")

# After
for k in ("wrinkle", "pigmentation", "pore", "dryness", "sagging", "acne")
```

acne가 성분 추천 로직(`get_recommended_ingredients`)에 전달되지 않아 CNN 감지 여드름이 성분 추천에 반영되지 않던 문제 해결.

---

## 13. 현재 시스템 한계 및 문제점

### 13.1 모델 정확도 한계

| 속성 | 정확도 수준 | 비고 |
|------|-----------|------|
| 모공 | 중간 | 시각적 신호 명확 |
| 색소침착 | 중간 | 잡티/기미 시각적 명확 |
| 여드름 | **높음 (85.29%)** | 전용 모델, 가장 신뢰 |
| 주름 | 낮음 | val_acc 불명확, 폼 cap으로 보완 |
| 건조도 | 낮음 | 입술만 봄, 전체 수분 대표 불가 |
| 유분 | 없음 | 폼 100% |
| 민감도 | 없음 | 폼 100% |

### 13.2 Domain Mismatch

AI Hub 학습 이미지: 전문 스튜디오, 고화질, 통제된 조명
실제 사용자: 셀카, 다양한 조명, 각도, 카메라 품질

→ 같은 피부 상태라도 조명/각도에 따라 CNN 예측이 달라질 수 있음.

### 13.3 클래스 불균형

대부분의 사람이 grade 0~1 (정상~경미)에 분포.
grade 3~6 (심각) 샘플 부족 → 모델이 중간값으로 수렴하는 경향.

### 13.4 왼쪽 얼굴만 사용

r_cheek, r_perocular 미사용. 오른쪽 데이터로 좌우 평균 낼 경우 더 안정적 예측 가능.

### 13.5 수분의 간접 측정

전체 피부 수분은 피부과 장비 측정이 정확하나, 현재는 피부타입 + lip_dryness 추정에 의존.

### 13.6 종합점수 vs 각 속성 일관성

종합점수는 모공/색소침착/주름/여드름 기반이지만, 화면에 표시되는 7개 속성에는 유분/수분/민감도도 포함. 점수에 영향을 안 주는 속성이 표시되어 사용자 혼란 가능.

---

## 14. 파일 구조

```
skin project/
│
├── api/
│   ├── server.py          ★ FastAPI 메인 서버 (ML 추론 + 추천 + 인증)
│   └── db.py              SQLite 인증/분석기록/알림/위시리스트
│
├── app/
│   └── streamlit_app.py   ★ Streamlit 데모 (v5 CORAL + acne TTA)
│
├── src/
│   ├── models/
│   │   └── cnn.py         ★ MultiTaskSkinModel / CORAL / AcneSeverityModel
│   │
│   ├── data/
│   │   ├── aihub_loader.py    MULTITASK_TARGETS, ANNOTATION_MAX 상수
│   │   └── dataset.py         PyTorch Dataset 클래스
│   │
│   ├── train/
│   │   ├── train.py           학습 루프
│   │   ├── eval.py            평가
│   │   └── losses.py          MultiTaskLoss, CoralMultiTaskLoss
│   │
│   ├── recommend/
│   │   ├── ingredient_map.py  ★ 속성→성분 매핑, normalize_cnn_output
│   │   ├── skin_profile.py    ★ build_frontend_attrs, composite_score
│   │   ├── product_search.py  식약처 기능성화장품 검색
│   │   ├── explainer.py       ★ 추천 이유 텍스트, build_skin_summary
│   │   ├── lifestyle.py       생활습관 델타 계산
│   │   ├── food_recommend.py  음식 추천
│   │   └── procedure_map.py   시술 추천
│   │
│   ├── form/
│   │   └── schema.py          UserFormInput dataclass
│   │
│   └── utils/
│       └── face_crop.py       OpenCV 얼굴 부위별 크롭
│
├── scripts/
│   ├── train_multitask_v5.py  ★ 현재 모델 학습 스크립트
│   ├── train_acne.py          ★ 여드름 모델 학습 (최적화된 버전)
│   ├── train_baseline.py      베이스라인 (이마주름 단일)
│   └── scrape_oliveyoung.py   (팀원 추가) 올리브영 스크래핑
│
├── checkpoints/
│   ├── multitask_v5_best.pth  ★ 현재 멀티태스크 (B0+CORAL)
│   ├── acne_best.pth          ★ 현재 여드름 (EfficientNetV2-M, acc=85.29%)
│   ├── multitask_v2_best.pth  이전 안정 버전 (B0+CE)
│   └── multitask_v3_best.pth  폐기된 B3 버전
│
├── design/
│   ├── index.html
│   ├── app.jsx
│   ├── styles.css
│   └── skin/screens/
│       ├── results.jsx    ★ 결과 화면 (숫자→낮음/중간/높음 변경됨)
│       ├── analyze.jsx    ★ 분석 폼 (여드름 concern 포함)
│       ├── dashboard.jsx
│       ├── mypage.jsx
│       ├── clinic.jsx     시술 추천
│       └── diet.jsx       식단 추천
│
├── data/
│   ├── raw/mfds/              식약처 CSV (ingredient, restricted, functional)
│   └── history.db             분석 기록 SQLite
│
└── 028.한국인 피부상태 측정 데이터/   AI Hub 원본 (gitignore)
```

★ = 이번 세션에서 수정된 파일

---

## 15. 서버 실행 방법

```bash
# 1. 가상환경 활성화
.\venv\Scripts\activate

# 2. FastAPI 서버 실행 (React 프론트 포함)
python -m uvicorn api.server:app --reload
# → http://localhost:8000 접속

# 3. Streamlit 데모
streamlit run app/streamlit_app.py
# → http://localhost:8501 접속

# 4. 멀티태스크 모델 재학습 (v5)
.\venv\Scripts\python.exe scripts/train_multitask_v5.py

# 5. 여드름 모델 재학습
.\venv\Scripts\python.exe scripts/train_acne.py
```

---

## 16. Future Work

### 우선순위 높음

1. **속성별 전문 모델**: 주름, 모공, 색소침착 각각 별도 학습. 여드름처럼 전문 모델은 정확도가 크게 향상됨.

2. **r_cheek 추가 → v6 학습**: `r_cheek_pore`, `r_cheek_pigmentation`, `r_perocular_wrinkle`을 MULTITASK_TARGETS에 추가. 좌우 평균으로 예측 안정화.

3. **glabellus_wrinkle 추가**: 미간 주름 (0~6). 데이터 있으나 현재 미사용.

### 우선순위 중간

4. **폼 세분화**: 주름/여드름 심각도를 사용자가 직접 4단계로 입력. 모델 보다 본인이 더 정확.

5. **Late Fusion 멀티모달**: 이미지 feature(1280차원)와 폼 feature(20차원)를 concat 후 최종 예측. 이미지+폼 정보 동시 학습.

6. **WeightedRandomSampler 추가**: 멀티태스크 모델의 클래스 불균형 해결. 현재 grade 0이 60%+ 이상으로 추정.

### 우선순위 낮음

7. **equipment 보조 타겟**: 학습 시 수분/탄력 장비 측정값을 auxiliary regression target으로 추가. 추론 시 사용 불가이지만 학습 신호 강화 가능.

8. **톤 균일도 재설계**: sagging 역산 방식 대신 색소침착 패턴이나 피부결 이미지 분석으로 대체.

9. **Ablation Study**: CNN만 vs 폼+CNN, 멀티태스크 vs 단일태스크 비교 실험.

---

## 발표 포인트 정리

### 강점으로 어필할 것
1. **한국인 전용 데이터** — AI Hub 11,000장, 인종 편향 없음
2. **멀티모달 설계** — 이미지로 불가능한 정보(민감도, 유분)는 폼으로 보완
3. **실제 제품 추천** — Claude + 네이버 쇼핑 API (이미지·가격·링크 포함)
4. **Claude AI 설명** — 분석 결과 자연어 개인화 생성
4. **여드름 전용 모델 acc=85.29%** — 팀원이 별도 학습, 전문화 효과 입증
5. **v1→v5 진화 과정** — 베이스라인 70% → 멀티태스크 51.7% → CORAL 적용 → 신뢰도 개선

### 한계로 인정할 것
- 멀티태스크 val_acc 51.7% — "7개 동시 예측의 어려움, 속성별 전문 모델로 개선 가능"
- Domain mismatch — "스튜디오 이미지 학습, 셀카 추론 간 도메인 차이"

---

*이 문서는 2026-06-01 개발 세션에서 Claude Code와 함께 작업한 내용을 기반으로 작성됐습니다.*
