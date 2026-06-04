# PPT 제작을 위한 프로젝트 전체 지식 문서

> 이 문서는 Claude Web에서 PPT를 제작할 때 참고할 프로젝트 전체 내용을 담고 있습니다.
> PPT 슬라이드 구성은 `PPT_STRUCTURE.md`를 함께 참고하세요.
> "진단(diagnosis)" 표현 절대 금지 — 모든 표현은 "분석·추정·추천"으로 통일.

---

## 1. 프로젝트 정체성

### 한 줄 정의
사용자의 셀카 이미지와 폼 입력을 받아, 한국인 피부 데이터로 학습한 CNN으로 7가지 피부 속성을 추정하고, Claude AI와 네이버 쇼핑 API를 통해 실제 구매 가능한 화장품을 추천하는 웹 서비스.

### 개발 배경
- K-뷰티 시장 성장에도 불구하고 AI 피부 분석 서비스의 대부분이 서양인 데이터 기반 → 한국인 피부톤·특성에 부정확
- 기존 서비스(화해, 올리브영)는 이미지 분석 없이 설문 기반 추천만 / ModiFace·Olay는 이미지 분석하지만 자사 제품만
- 이미지만으로는 민감도·유분 같은 주관적 정보 파악 불가 → 설문+생활습관 통합 필요

### 프로젝트 성격
학부 ML 학기 프로젝트 (3~4인 팀). 합법적 공개 데이터만 사용. 의료 행위 아님.

---

## 2. 전체 시스템 흐름

```
[입력]
  셀카 이미지 (선택) + 폼 입력 (필수) + 생활습관 11개 항목 (선택)

[처리 — 7단계]
  ① CNN 추론 (TTA 3종 앙상블)
     - MultiTaskSkinModelCORAL → 7개 피부 속성 raw grade
     - AcneSeverityModel → 여드름 심각도 grade + 신뢰도
     - normalize → 각 속성 0~100점으로 변환

  ② 생활습관 델타 계산
     - 11개 항목(음주/흡연/수면/물 등) → 속성별 ±최대20점 보정

  ③ 7속성 최종값 생성
     - CNN 결과 + 폼 + 생활습관 → {유분, 수분, 민감도, 색소침착, 주름, 모공, 여드름}
     - 각 속성: value(0~100) + level(낮음/중간/높음)

  ④ 종합점수 계산 (10~95)
  ⑤ 성분 추천/회피 (룰 기반)
  ⑥ 제품 추천 (Claude Haiku → 네이버 쇼핑 API 병렬 호출)
  ⑦ Claude AI 피부 설명 생성

[출력 — React 결과 화면]
  피부 속성 바 차트 | 종합점수 | Claude 설명 | 권장 성분 | 제품 Top 3
```

---

## 3. 데이터

### 학습 데이터 — AI Hub 한국인 피부상태 측정 데이터
- 피험자: 1,100명 (10~60대, 남녀)
- 학습 이미지: **11,154장** / JSON 라벨: 100,386개
- 검증 이미지: 1,391장
- 촬영: 디지털 카메라·스마트패드·스마트폰, 최대 7각도
- 라벨링: 전문의 5인 육안 평가

#### JSON 라벨 구조 (한 파일 = 한 이미지의 한 얼굴 부위)
```json
{
  "info": { "age": 55, "gender": "F", "skin_type": 0, "sensitive": 1 },
  "images": { "facepart": 1, "bbox": [x1, y1, x2, y2] },
  "annotations": {
    "forehead_wrinkle":      3,   // 0~6 (7등급)
    "forehead_pigmentation": 2,   // 0~5 (6등급)
    "l_perocular_wrinkle":   1,   // 0~6 (7등급)
    "l_cheek_pore":          2,   // 0~4 (5등급)
    "l_cheek_pigmentation":  1,   // 0~5 (6등급)
    "lip_dryness":           2,   // 0~4 (5등급)
    "chin_sagging":          1,   // 0~5 (6등급)
    "acne": null                  // null=없음, 병변 좌표 리스트=있음
  }
}
```
- skin_type: 0=건성, 1=지성, 3=복합건성, 4=복합지성, 5=중성
- facepart: 1=이마, 3=눈가, 5=볼, 7=입술, 8=턱

#### EDA 핵심 발견
- 대부분의 샘플이 grade 0~1 (정상~경미) → **클래스 불균형** 심각
- grade 5~6 (심각) 샘플 수 매우 부족
- → 모델이 중간값으로 수렴하는 경향

### 여드름 모델 학습 데이터
- Kaggle ACNE04 + AI Hub acne 라벨 (~1,400장)
- 4클래스: 0=없음, 1=경증(병변 1~5개), 2=중간(6~15개 또는 낭포), 3=심함(16개+)

### 제품 추천 데이터
- 네이버 쇼핑 API (실시간): 이미지·가격·구매 링크 포함

---

## 4. 데이터 전처리 — 얼굴 부위 크롭

OpenCV Haar Cascade로 얼굴 bbox 검출 → 해부학적 비율로 5개 부위 분할.
CNN이 각 속성에 최적화된 부위만 보도록 설계.

```
얼굴 높이 비율 (0.0=상단, 1.0=하단):
  이마   y: 0.02~0.32  → forehead_wrinkle, forehead_pigmentation
  눈가   y: 0.28~0.52  → l_perocular_wrinkle  (카메라 기준 왼쪽 눈)
  볼     y: 0.46~0.72  → l_cheek_pore, l_cheek_pigmentation  (왼쪽 볼)
  입술   y: 0.63~0.83  → lip_dryness
  턱     y: 0.76~1.00  → chin_sagging
```

- 얼굴 미검출 시 → 원본 이미지 전체로 fallback
- 왼쪽 얼굴만 사용 (flip 제외 — 방향 고정 필요)

---

## 5. 모델 학습 전 과정

### 5-1. 학습 전략 개요
```
STEP 1: 단일 속성 베이스라인
  → 파이프라인 검증, val_acc 70.09%

STEP 2: 멀티태스크 CNN (v1~v5)
  → 7속성 동시 예측, B3 과적합 실패 경험 → B0+CORAL 도출
  → val_acc 51.70%+

STEP 3: 여드름 전용 모델
  → 멀티태스크 내 acne 부정확 → 전용 분리
  → acc 85.29%
```

---

### 5-2. 베이스라인 — 단일 속성 분류

**설계**
- 타겟: forehead_wrinkle (이마 주름) 1개만
- 모델: EfficientNet-B0 (pretrained ImageNet) → Linear(1280→7) → CrossEntropy
- 목표: val_acc ≥ 60% (random 14.3%의 4배)

**결과: val_acc = 70.09% ✅**

**의의**: 전체 파이프라인(데이터로더→크롭→학습→평가) 검증 완료 → 멀티태스크 확장 결정

```python
model = timm.create_model("efficientnet_b0", pretrained=True, num_classes=7)
optimizer = AdamW(model.parameters(), lr=1e-4)
criterion = CrossEntropyLoss()
```

---

### 5-3. 멀티태스크 설계 동기

- 단일태스크: 7개 속성 × 별도 모델 = 7개 모델 → 메모리·속도 비효율
- 멀티태스크: 공유 backbone + 7개 독립 head = 1개 모델, 한 번의 forward pass
- 추가 장점: 공유 feature에서 속성 간 상관관계 학습 가능

---

### 5-4. MultiTaskSkinModel 구조

```
[224×224 이미지]
      ↓
EfficientNet-B0 Backbone (pretrained=True, num_classes=0, global_pool="avg")
      ↓  GlobalAvgPool → 1280차원 feature
      ↓  Dropout(p=0.4)
      ↓
┌──────────────────────────────────────────────────┐
│ head₁: forehead_wrinkle      Linear(1280 → 7)   │  CORAL: Linear(1280 → 6)
│ head₂: forehead_pigmentation Linear(1280 → 6)   │  CORAL: Linear(1280 → 5)
│ head₃: l_perocular_wrinkle   Linear(1280 → 7)   │  CORAL: Linear(1280 → 6)
│ head₄: l_cheek_pore          Linear(1280 → 5)   │  CORAL: Linear(1280 → 4)
│ head₅: l_cheek_pigmentation  Linear(1280 → 6)   │  CORAL: Linear(1280 → 5)
│ head₆: lip_dryness           Linear(1280 → 5)   │  CORAL: Linear(1280 → 4)
│ head₇: chin_sagging          Linear(1280 → 6)   │  CORAL: Linear(1280 → 5)
└──────────────────────────────────────────────────┘
      ↓
dict { target_name → logits (batch, K 또는 K-1) }
```

```python
class MultiTaskSkinModel(nn.Module):
    def __init__(self, targets, dropout=0.3):
        self.backbone = timm.create_model(
            "efficientnet_b0", pretrained=True,
            num_classes=0, global_pool="avg",
        )
        self.dropout = nn.Dropout(p=dropout)
        self.heads = nn.ModuleDict({
            t: nn.Linear(1280, ANNOTATION_MAX[t] + 1)
            for t in targets
        })

    def forward(self, x):
        feats = self.dropout(self.backbone(x))
        return {t: head(feats) for t, head in self.heads.items()}
```

---

### 5-5. v3·v4 실패 — EfficientNet-B3 과적합

**시도**: v3(B3+CE), v4(B3+CORAL) → 둘 다 val_acc 낮음 → 폐기

**실패 원인**
- EfficientNet-B3: 파라미터 43MB (vs B0: 16MB)
- 학습 데이터: 11,000장 (소규모)
- 모델이 데이터보다 너무 크면 train 데이터를 외워버리고 val에서 일반화 실패 = 과적합
- 학습 곡선: train_loss 계속 감소 / val_acc 정체 (전형적인 과적합 패턴)

**결론**: B0으로 크기 유지 + 정규화 강화(Dropout↑, WeightDecay↑, RandomErasing 추가)

---

### 5-6. CORAL Loss — 순서형 회귀

**왜 CrossEntropy가 부족한가?**
- 주름 등급: 0 < 1 < 2 < 3 < 4 < 5 < 6 (순서형)
- CrossEntropy: 각 클래스를 독립 취급 → 0을 6으로 예측하는 것이 0을 1로 예측하는 것과 같은 패널티
- CORAL: 순서형 구조를 손실에 반영 → 인접 클래스 오분류가 먼 클래스 오분류보다 패널티 낮음

**CORAL 원리**
```
K 클래스 → K-1개의 binary 임계값으로 분해
질문: "grade ≥ 1인가?" / "grade ≥ 2인가?" / ... / "grade ≥ 6인가?"

Head 출력: Linear(1280 → K-1)  ← K-1개 binary logit
예측: sigmoid(logit) > 0.5 → True 개수 합산 = grade
손실: bin_labels[k] = 1 if label > k else 0
      BCE(logits, bin_labels)
```

참고 논문: Cao et al. 2020, "Rank Consistent Ordinal Regression for Neural Networks"

```python
class CoralMultiTaskLoss(nn.Module):
    def forward(self, preds, labels):
        for i, t in enumerate(self.targets):
            t_labels = labels[:, i]
            t_logits = preds[t]          # (B, K-1)
            valid = t_labels != -1       # 결측 제외
            lv = t_labels[valid]
            # binary label matrix
            thresholds = torch.arange(n_thresh)
            bin_labels = (lv.unsqueeze(1) > thresholds.unsqueeze(0)).float()
            loss = BCE_with_logits(t_logits[valid], bin_labels)
```

---

### 5-7. v5 최종 학습 설정 & 전체 버전 비교

| 버전 | Backbone | Loss | Dropout | val_acc | 결과 |
|-----|---------|------|---------|---------|------|
| 베이스라인 | B0 | CE | 0.3 | 70.09% (단일) | ✅ 파이프라인 검증 |
| v2 | B0 | CE | 0.3 | 51.70% (7속성) | ✅ 폴백용 유지 |
| v3 | B3 | CE | 0.3 | 낮음 | ❌ 과적합 (43MB) |
| v4 | B3 | CORAL | 0.3 | 낮음 | ❌ B3 여전히 과적합 |
| **v5** | **B0** | **CORAL** | **0.4** | **51.70%+** | ✅ **현재 사용** |

**v5 핵심 변경 (v2 대비)**
- Loss: CrossEntropy → CORAL (순서형 구조 반영)
- Dropout: 0.3 → 0.4 (정규화 강화)
- WeightDecay: 1e-4 → 2e-4 (정규화 강화)
- Scheduler: StepLR → CosineAnnealingLR (부드러운 lr 감쇄)
- 증강: RandomErasing p=0.2 추가

**v5 학습 증강 전체**
```python
transforms.Compose([
    Resize(256), RandomCrop(224),
    RandomHorizontalFlip(),
    ColorJitter(brightness=0.35, contrast=0.35, saturation=0.2, hue=0.05),
    RandomRotation(15),
    RandomPerspective(distortion_scale=0.15, p=0.3),
    GaussianBlur(kernel_size=3),
    ToTensor(), Normalize([0.485,0.456,0.406],[0.229,0.224,0.225]),
    RandomErasing(p=0.2, scale=(0.02,0.1)),
])
```

**왜 val_acc가 베이스라인(70%)보다 멀티태스크(51.7%)가 낮은가?**
→ 7개 속성을 동시에 예측하면서 공유 feature에 여러 목표가 경쟁. 단일 속성일 때보다 각 속성에 집중된 학습이 어려움. 11,000장의 소규모 데이터에서 7개 동시 예측은 어려운 과제.

---

### 5-8. 여드름 전용 모델 — AcneSeverityModel

**도입 배경**
- 멀티태스크 모델 내 acne 예측이 불안정 (공유 feature 한계, 병변 좌표→등급 변환 노이즈)
- false positive(없는데 있다고)·false negative(있는데 없다고) 빈번
- 팀원이 여드름 전용 데이터(Kaggle ACNE04 + AI Hub)로 별도 학습

**모델 구조**
```
EfficientNetV2-M Backbone (53.8M 파라미터, ~206MB)
    ↓ GlobalAvgPool → 1280차원
    ↓
Linear(1280→512) → ReLU → Dropout(0.3)
    ↓
Linear(512→128)  → ReLU → Dropout(0.3)
    ↓
Linear(128→4)    → 4-class (없음/경증/중간/심함)
```

```python
class AcneSeverityModel(nn.Module):
    def __init__(self):
        base = tvm.efficientnet_v2_m(weights=None)
        base.classifier = nn.Sequential(
            nn.Linear(1280, 512), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(512, 128),  nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, 4),
        )
        self.backbone = base
```

**학습**: 80 epochs / K-fold 교차검증 / AdamW
**최종 정확도: acc = 85.29% ✅**
**비교**: 멀티태스크 내 acne → 불안정 / 전용 모델 → 85.29% = **전문 모델 분리 효과 입증**

---

### 5-9. TTA (Test-Time Augmentation) + 추론 파이프라인

**TTA 3종 변형** (flip 제외 — 왼쪽 얼굴 방향 고정)
```python
tta_transforms = [
    Compose([Resize(224), ToTensor(), Normalize(...)]),           # 원본
    Compose([Resize(224), ColorJitter(brightness=0.15), ...]),   # 밝게
    Compose([Resize(224), ColorJitter(brightness=(0.7,0.9)), ...]), # 어둡게
]
```

**멀티태스크 추론** (부위별 크롭 → 각 head)
```python
for part, targets in FACEPART_TARGETS.items():
    for tfm in tta_transforms:
        outputs = model(tfm(crops[part]).unsqueeze(0))
    avg = prob_sum[t] / 3
    raw[t] = float((avg[0] > 0.5).sum())  # CORAL: 0.5 초과 임계값 수 합산
```

**여드름 추론** (전체 이미지 → 신뢰도 스케일링)
```python
for tfm in tta_transforms:
    logit_sum += softmax(acne_model(tfm(img).unsqueeze(0)))
grade      = argmax(logit_sum / 3)
confidence = max(logit_sum / 3)
# 신뢰도 낮으면 점수 감쇄 (false positive 완화)
acne_score = grade/3 * 100 * min(1.0, confidence * 1.5)
```

---

## 6. 추천 시스템 로직

### 6-1. normalize_cnn_output — raw grade → 0~100점

부위가 여러 개인 속성은 **최대값** 사용 (더 심한 부위 기준)

```python
wrinkle      = max(forehead_wrinkle/6, l_perocular_wrinkle/6) * 100
pigmentation = max(forehead_pigmentation/5, l_cheek_pigmentation/5) * 100
pore         = l_cheek_pore / 4 * 100
dryness      = lip_dryness  / 4 * 100
sagging      = chin_sagging / 5 * 100
acne         = grade / 3 * 100 * min(1.0, confidence * 1.5)
```

---

### 6-2. 7속성 최종값 계산 (build_frontend_attrs)

| 속성 | 키 | 출처 | 계산 방식 | 높을수록 |
|-----|-----|------|---------|--------|
| 유분 | oil | 폼 (피부타입) | SKIN_TYPE_OIL 고정값 + oil_boost 델타 | 나쁨 |
| 수분 | hydro | 폼+CNN | 피부타입 베이스 + (50-lip_dryness)×0.24 - dryness델타 | 좋음 |
| 민감도 | sens | 폼 (민감도) | FORM_SENS_SCORE 고정값 + sens_boost 델타 | 나쁨 |
| 색소침착 | pigment | CNN | pigmentation + 생활습관 델타 | 나쁨 |
| 주름 | wrinkle | CNN+폼 | wrinkle + 델타, "주름" 미선택 시 max 52 cap | 나쁨 |
| 모공 | pore | CNN | pore + 생활습관 델타 | 나쁨 |
| 여드름 | acne | CNN+폼 | TTA + 신뢰도 스케일링 + 폼 보정 | 나쁨 |

**피부 타입별 유분/수분 기본값**
```
지성:   oil=78, hydro_base=45
복합지성: oil=70, hydro_base=50
복합성: oil=62, hydro_base=55
중성:   oil=50, hydro_base=62
복합건성: oil=45, hydro_base=38
민감성: oil=40, hydro_base=42
건성:   oil=18, hydro_base=28
```

**폼 민감도 → 점수**
```
거의 없음 → 15점 (민감도 낮음)
가끔     → 35점
자주     → 65점
매번     → 85점 (민감도 높음)
```

**수분(hydro) 계산 상세**
```python
base = SKIN_TYPE_HYDRO_BASE[skin_type]        # 피부타입 기반 베이스
base += (50 - lip_dryness_cnn) * 0.24         # CNN 소폭 보정 (±12)
base -= lifestyle_deltas["dryness"]            # 생활습관 보정
if "건조함" in concerns:
    base = min(base, 38.0)                     # 건조함 고민 → 수분 낮음 보장
hydro = clamp(base, 10, 90)
```

**폼 보정 원칙**
- 주름: "주름" 고민 미선택 시 → wrinkle = min(wrinkle, 52) cap
  (이유: CNN이 없는 주름을 높게 예측하는 오류 빈번. 주름은 본인이 가장 잘 앎)
- 여드름: "여드름" 미선택 → min(acne, 30) / "여드름" 선택 + CNN<35 → max(acne, 40)
  (이유: false positive/negative 완화)

**레벨 판단 (전 속성 공통)**
```
value ≥ 65 → "높음" (hi)
value ≥ 35 → "중간" (mid)
value < 35 → "낮음" (lo)
```

---

### 6-3. 종합점수 공식 (4세대 최종, 10~95점)

```
visible_bad = pore × 0.40 + pigment × 0.35 + wrinkle × 0.25
base = 100 − visible_bad
base += (hydro − 50) × 0.10    # 수분 소량 보너스
base −= acne × 0.25            # 여드름 패널티
score = clamp(10, round(base), 95)
```

**가중치 근거** (사람이 피부를 볼 때 가장 먼저 인식하는 순서)
- 모공 40%: 피부결, 가장 직관적으로 체감
- 색소침착 35%: 잡티·기미, 육안으로 매우 뚜렷
- 주름 25%: 나이 연관, 상대적으로 덜 직관적

**유분 제거 이유**: 지성 피부라도 모공·색소·여드름 없으면 좋은 피부

**기대 범위**
```
나쁜 피부: 20~30점
보통 피부: 40~60점
좋은 피부: 70~90점
```

**공식 변천사 (왜 4세대까지 왔는가)**
- 1세대: 2차 곡선 → 대부분 15점 고착 ❌
- 2세대: 선형 → 바닥 30점 고정, 좋은/나쁜 피부 차이 13점뿐 ❌
- 3세대: CNN 중심 → 유분/민감 폼 고정값 제거 ⚠️
- 4세대: 육안 3요소 중심 → 현재 ✅

---

### 6-4. 생활습관 델타 시스템

11개 항목 → 속성별 누적 델타, 각 속성 ±최대 20점 cap.

| 항목 | 값 | 속성 보정 |
|-----|-----|---------|
| 음주(drinking) | 자주 (주 1회+) | dryness +12, pigmentation +8 |
| 흡연(smoking) | 흡연 | wrinkle +15, pigmentation +10, sagging +8 |
| 클렌징(cleansing) | 자주 빠짐 | pore +15, sens_boost +10 |
| 호르몬(hormone) | 스트레스 심함 | sens_boost +15, pigmentation +8 |
| 호르몬(hormone) | 임신 중 | pigmentation +15, sens_boost +10 |
| 소화(gut) | 자주 있음 | sens_boost +10, pigmentation +8 |
| 수면(sleep) | 5시간 미만 | dryness +15, sagging +10, sens_boost +10 |
| 물(water) | 부족 (<4잔) | dryness +18 |
| 물(water) | 충분 (6잔+) | dryness −5 |
| 열 노출(heat) | 자주 (사우나/찜질) | sens_boost +15, pore +8 |
| 오염(pollution) | 높음 (도심/야외) | pore +10, pigmentation +8 |
| 식습관(diet) | 야식 자주 | oil_boost +10, pore +8 |
| 식습관(diet) | 정제탄수화물 자주 | oil_boost +8, pore +5 |

---

### 6-5. 성분 매핑 룰 테이블

(식약처 DB 아님 — 피부과 가이드라인 기반 수동 작성)

**권장 성분**
| 속성 | ≥65 (집중 케어) | 35~64 (기본 케어) |
|-----|----------------|-----------------|
| 건조도 | 히알루론산, 세라마이드, 글리세린, 스쿠알란, 판테놀 | 글리세린, 판테놀 |
| 색소침착 | 비타민C, 알부틴, 트라넥삼산, 나이아신아마이드 | 나이아신아마이드 |
| 주름 | 레티놀, 펩타이드, 비타민C, 아데노신 | 펩타이드, 아데노신 |
| 모공 | 살리실산, AHA, 나이아신아마이드 | 나이아신아마이드 |
| 여드름 | 살리실산, 티트리, 벤조일퍼옥사이드, 나이아신아마이드 | 나이아신아마이드 |
| 민감성 (폼) | 센텔라아시아티카, 판테놀, 마데카소사이드, 알란토인 | — |

**연령대 보정**
- 10대: pore +15 / 20대: pore +10
- 40대: wrinkle +10, sagging +10
- 50대+: wrinkle +20, sagging +20, pigmentation +10

**회피 성분 (알레르기·임신)**
- 알코올 → 에탄올, SD알코올
- 향료 → 프래그런스, 퍼퓸
- 파라벤 → 메틸/에틸/프로필/부틸파라벤
- 임신 중 추가 → 레티놀, 레틴산, 살리실산, 벤조일퍼옥사이드

---

### 6-6. 제품 추천 파이프라인

```
피부 분석 결과 (속성 점수 + 고민 + 권장 성분 4개)
        ↓
Claude Haiku에 프롬프트:
  "서로 다른 스텝(토너/세럼/크림)의 검색어 3개를 JSON으로 생성"
        ↓
검색어 3개 추출
        ↓
asyncio.gather → 네이버 쇼핑 API 3개 동시 호출
  GET https://openapi.naver.com/v1/search/shop.json
  params: query, display=3, sort=sim
        ↓
각 쿼리의 1등 제품 추출 → 최종 Top 3 제품
  (이름, 브랜드, 이미지, 가격, 구매 링크, 추천 이유)
```

---

## 7. 웹 서비스 구조

### 7-1. 기술 스택
- 백엔드: FastAPI 0.4 + uvicorn (Python 3.12)
- 프론트엔드: React (vanilla JSX, 별도 빌드 없음)
  → FastAPI가 `design/` 폴더를 FileResponse로 직접 서빙
- DB: SQLite (data/history.db)
- 외부 API: Claude Haiku (Anthropic), 네이버 쇼핑

### 7-2. 전체 아키텍처

```
FRONTEND (React — design/)
  analyze.jsx → results.jsx → dashboard / mypage / clinic / diet
        ↕ HTTP (multipart/form-data + JSON)
BACKEND (FastAPI — api/server.py)
  POST /api/analyze  ★ 메인
  GET  /api/history, /api/ingredient/{name}
  POST /api/clinic/recommend, /api/diet/recommend
  CRUD /api/me/notifications, /diary, /wishlist
        ↕                    ↕                ↕
  ML 모델 (지연 로딩)    외부 API           SQLite DB
  MultiTaskCNN          Claude Haiku       6개 테이블
  AcneCNN               네이버 쇼핑
```

### 7-3. 분석 API 처리 흐름 (POST /api/analyze)

```
요청: multipart/form-data (image 선택 + form_data JSON)
        ↓
① CNN 추론 — crop_faceparts() → TTA 3종 → 7속성 + acne
② 생활습관 델타 — 11개 항목 → 속성별 ±최대 20점
③ 7속성 생성 — build_frontend_attrs()
④ 종합점수 + 피부타입 라벨
⑤ 성분 추천/회피 — 룰 테이블 → 최대 6개
⑥ 제품 추천 — Claude Haiku → 네이버 쇼핑 API 병렬 3개
⑦ Claude AI 설명 — {skin_summary, care_tips, lifestyle_note, key_ingredient}
        ↓
응답 JSON → React 결과 화면
```

### 7-4. 주요 API 엔드포인트

```
[인증]
POST /api/register    회원가입
POST /api/login       로그인 → Bearer 토큰 발급
POST /api/logout
GET  /api/me          내 정보
PATCH /api/me         닉네임 수정
DELETE /api/me        회원 탈퇴

[분석]
POST /api/analyze              ★ 핵심 (비로그인도 가능)
GET  /api/history              최근 분석 기록 20개
GET  /api/history/last_form    마지막 폼 (자동완성용)
GET  /api/history/{id}         분석 상세 (로그인 필요)
DELETE /api/history/{id}

[AI 기능]
GET  /api/ingredient/{name}    성분 상세 (Claude 생성)
POST /api/clinic/recommend     피부과 시술 추천 (Claude)
POST /api/diet/recommend       식단 추천 (Claude)

[개인화]
CRUD /api/me/notifications
CRUD /api/me/diary
CRUD /api/me/wishlist
```

### 7-5. 프론트엔드 화면 구성

```
analyze.jsx  ★ 분석 메인 (3단계)
  Step 0: 사진 업로드
    - 파일 선택 (JPG/PNG)
    - 웹캠 촬영 (navigator.mediaDevices.getUserMedia → canvas → Blob)
    - 얼굴 가이드 오버레이
  Step 1: 폼 입력
    - 필수: 피부타입 / 나이대 / 성별 / 민감도 / 피부 고민 / 알러지
    - 선택(생활습관): 음주/흡연/클렌징/호르몬/소화/수면/물/열/오염/땀/식습관
    - 이전 분석 자동완성 (로그인 시)
  Step 2: 로딩 + API 호출
    - 5단계 애니메이션 (총 4.5초 누적)
    - POST /api/analyze → 서버 처리

results.jsx  ★ 분석 결과
  - 7개 속성 바 차트: 바 너비(a.value%), 레벨 표시(낮음/중간/높음)
  - 종합점수 + 피부 타입 라벨
  - Claude AI 피부 요약 카드
  - 권장 성분 / 회피 성분 / 주의 성분 카드
  - 추천 제품 Top 3 (이미지·가격·링크 포함)

dashboard.jsx  히스토리 점수 변화 그래프
mypage.jsx     프로필·위시리스트·알림
clinic.jsx     피부과 시술 추천 (Claude AI)
diet.jsx       식단 추천 (피부 맞춤)
```

**왜 숫자 대신 낮음/중간/높음?**
→ 멀티태스크 val_acc 51.7%에서 "56점 vs 48점" 차이는 신뢰 불가.
→ 낮음/중간/높음 3단계 분류는 ~70~80% 신뢰 가능.
→ 바의 너비는 여전히 value%로 시각적 차이 유지.

### 7-6. SQLite DB 테이블 구조 (6개)

```
users
  id, username(UNIQUE), password_hash(pbkdf2_sha256), created_at, nickname

sessions
  token(PK, token_hex(32)), user_id(FK), created_at

analyses
  id, user_id(FK, NULL 허용), created_at, composite(점수), skin_label(피부타입),
  attributes(JSON), full_data(전체 결과 JSON)

user_notifications
  id, user_id(FK), type, title, message, is_read(0/1), created_at

user_diaries
  id, user_id(FK), date, food, skin_effect, notes, created_at

user_wishlist
  id(token_hex(8)), user_id(FK), item_type, title, subtitle, created_at
```

**인증 방식**
- 비밀번호: pbkdf2_hmac("sha256", password, salt, 100,000회) 해싱
- 세션: Authorization: Bearer {token} 헤더
- 비로그인도 분석 가능 (user_id=NULL로 저장)
- 분석 상세 조회는 로그인 + 소유권 검증 필요

---

## 8. 한계점 & Future Work

### 현재 한계
1. 멀티태스크 val_acc 51.7% — 7개 동시 예측 + 11,000장 소규모 데이터 한계
2. Domain Mismatch — 학습: 스튜디오 고화질 / 추론: 셀카 + 다양한 조명·각도
3. 수분 간접 측정 — lip_dryness만으로 전체 피부 수분 추정의 한계
4. 클래스 불균형 — grade 0~1 과잉으로 모델이 중간값 수렴 경향

### Future Work
- 속성별 전문 모델 분리 (여드름처럼 주름·모공·색소침착 각각 전용 모델)
- r_cheek + glabellus_wrinkle 추가 → v6 학습 (현재 왼쪽만 사용)
- WeightedRandomSampler로 클래스 불균형 해결
- Late Fusion: 이미지 feature(1280) + 폼 feature(20) concat 학습
- 성분 매핑 룰 → LLM 기반 동적 생성으로 확장

---

## 9. 발표 시 주의사항

- **"진단" 표현 절대 금지** — "분석·추정·추천"으로 통일
- 모든 숫자: val_acc 70.09%(베이스라인), 51.70%(멀티태스크), 85.29%(여드름)
- 의의 표현: "화장품 추천 보조 도구입니다. 의료 진단이 아닙니다."
- 데이터 출처: AI Hub (비상업 연구·교육 목적), 네이버 Developers (공식 API)

---

## 10. 슬라이드 순서 요약 (PPT_STRUCTURE.md 기준)

```
01 표지
02 목차
03 개발 배경 및 필요성
04 전체 시스템 흐름
05 데이터 소스
06 AI Hub 데이터 구조 & EDA
07 얼굴 부위 크롭
08 베이스라인 — 단일 속성 분류
09 멀티태스크 모델 설계
10 멀티태스크 코드
11 v3·v4 실패 원인 분석
12 CORAL Loss
13 v5 학습 설정 & 전체 버전 비교 (Ablation 포함)
14 여드름 전용 모델 — 도입 배경
15 여드름 모델 구조 & 추론 결과
16 전체 추론 파이프라인 코드
17 성분 매핑 룰 테이블
18 7속성 계산 & 종합점수 공식
19 생활습관 델타 시스템
20 제품 추천 파이프라인
21 전체 시스템 아키텍처
22 프론트엔드 화면 구성
23 분석 화면 UX 흐름
24 API & DB 구조
25 POST /api/analyze 처리 흐름
26 한계점 & Future Work
27 결론
```
