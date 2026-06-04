# 피부 분석 기반 화장품 추천 시스템 — PPT 슬라이드 구성안 (v2)

> 총 슬라이드 수: 27장  
> 시연: PPT 외부에서 별도 진행  
> [📸]: 스크린샷 캡처 공간 — 어떤 화면 캡처할지 가이드 포함  
> 슬라이드는 핵심 시각화·표 위주 / 세부 설명은 발표 중 구두로 진행

---

## SECTION 0 — 표지 · 목차 (2장)

---

### Slide 1 — 표지
```
한국인 피부 분석 기반
맞춤형 화장품 추천 시스템

부제: AI Hub × CNN 멀티태스크 × Claude AI 추천

팀원 | 과목명 | 날짜
```

---

### Slide 2 — 목차
```
① 프로젝트 개요
② 데이터 수집 & 전처리
③ 모델 학습 전 과정
   베이스라인 → 멀티태스크 v5 → 여드름 전용 모델
④ 추천 시스템 로직
⑤ 웹 서비스 구조
⑥ 결과 & 결론
```

---

## SECTION 1 — 프로젝트 개요 (2장)

---

### Slide 3 — 개발 배경 및 필요성
```
레이아웃: 상단 배경 / 하단 필요성

[배경]
  K-뷰티 시장 규모 지속 성장 — 소비자의 피부 관심도 증가
  하지만 기존 피부 분석 서비스의 한계:

  ① 인종 편향
     시중 대부분의 AI 피부 분석: 서양인 데이터 기반 학습
     → 한국인 피부톤·특성에 부정확한 결과

  ② 이미지 분석 OR 추천 — 둘 중 하나
     화해·올리브영: 성분 검색 기반 추천 (이미지 분석 없음)
     ModiFace·Olay: 이미지 분석만, 자사 제품만 추천

  ③ 주관적 정보의 한계
     이미지만으론 민감도·유분 특성 파악 불가
     → 사용자 설문·생활습관 데이터 통합 필요

[필요성]
  ● 한국인 전용 데이터로 학습한 CNN 기반 피부 속성 분석
  ● 이미지 + 폼 + 생활습관 멀티모달 입력
  ● 분석 결과에서 실제 구매까지 end-to-end 연결
```

---

### Slide 4 — 전체 시스템 흐름
```
레이아웃: 가로 플로우차트 (심플하게)

[셀카 이미지]
[폼 + 생활습관]
      ↓
 CNN 추론 (TTA)          생활습관 델타
 ├ MultiTask (7속성)  +  (음주/흡연/수면 등)
 └ AcneModel (여드름)
      ↓
 7속성 점수 (0~100)  →  종합점수 (10~95)
                      →  성분 추천 / 회피
                      →  Claude → 네이버 API → 제품 Top 3
                      →  Claude AI 설명
      ↓
 결과 화면 (React)
```

---

## SECTION 2 — 데이터 수집 & 전처리 (3장)

---

### Slide 5 — 데이터 소스
```
레이아웃: 표

| 용도 | 데이터 | 출처 | 규모 |
|------|-------|------|------|
| 모델 학습 (메인) | 한국인 피부상태 측정 데이터 | AI Hub | 이미지 11,154장 / JSON 100,386개 |
| 여드름 모델 | 여드름 Severity 데이터 | Kaggle + AI Hub | ~1,400장 |
| 실시간 제품 추천 | 쇼핑 검색 API | 네이버 Developers | 실시간 |

모든 데이터: 공식 채널 / 크롤링·무단 수집 없음
```

---

### Slide 5 — AI Hub 데이터 구조 & EDA
```
레이아웃: 좌 JSON 구조 / 우 [📸 분포 그래프 2개]

왼쪽 — JSON 라벨 핵심 구조:
  {
    "info":   { age, gender, skin_type, sensitive },
    "images": { facepart, bbox },
    "annotations": {
      forehead_wrinkle:      0~6   ← 7등급
      forehead_pigmentation: 0~5
      l_cheek_pore:          0~4
      lip_dryness:           0~4
      chin_sagging:          0~5
      acne:  null | [병변 좌표 리스트]
    }
  }
  ※ 한 파일 = 한 이미지의 한 얼굴 부위

오른쪽 — [📸 캡처 2개]
  캡처 1: 속성별 라벨 분포 히스토그램
           → grade 0~1 과잉, grade 5~6 부족 (클래스 불균형 시각화)
  캡처 2: df.head() 또는 df.describe() 출력

[📸 캡처 가이드]
  notebooks/01_eda_aihub.ipynb 실행
  df[MULTITASK_TARGETS].hist(bins=7, figsize=(14,6)) 캡처
```

---

### Slide 5 — 데이터 전처리 — 얼굴 부위 크롭
```
레이아웃: 좌 다이어그램 / 우 코드+캡처

왼쪽 — 얼굴 분할 다이어그램:
  [정면 얼굴]
  y: 0.02~0.32 → 이마   → forehead_wrinkle, forehead_pigmentation
  y: 0.28~0.52 → 눈가   → l_perocular_wrinkle
  y: 0.46~0.72 → 볼     → l_cheek_pore, l_cheek_pigmentation
  y: 0.63~0.83 → 입술   → lip_dryness
  y: 0.76~1.00 → 턱     → chin_sagging

  OpenCV Haar Cascade로 얼굴 bbox 검출 → 비율로 5개 부위 분할
  미검출 시 → 원본 이미지로 fallback

오른쪽 코드:
  face = detectMultiScale(gray_img)
  for part, (yt,yb,xl,xr) in PART_BOXES.items():
      crops[part] = image.crop((fx+xl*fw, fy+yt*fh, ...))

[📸 캡처]
  실제 얼굴에 5개 부위 박스 그려진 결과 이미지
  (PIL.ImageDraw 또는 OpenCV rectangle로 시각화)
```

---

## SECTION 3 — 모델 학습 전 과정 (9장)

---

### Slide 5 — 베이스라인 — 단일 속성 분류
```
레이아웃: 좌 구조 / 우 코드+캡처

왼쪽:
  [학습 전략]
  단일 속성 분류 → 멀티태스크 확장 → 여드름 전용 모델 분리
  각 단계에서 실패를 분석하고 개선하며 진행

  [베이스라인 설계]
  타겟: forehead_wrinkle (이마 주름) 1개
  목표: val_acc ≥ 60% (random 14.3%의 4배 이상)

  EfficientNet-B0 (pretrained)
      ↓ GlobalAvgPool → [1280차원]
      ↓
  Linear(1280 → 7)   ← 7-class CE Loss
      ↓
  val_acc = 70.09% ✅
  의의: 전체 파이프라인 검증 → 멀티태스크 확장 결정

오른쪽 코드:
  model = timm.create_model(
      "efficientnet_b0",
      pretrained=True,
      num_classes=7,
  )
  optimizer = AdamW(model.parameters(), lr=1e-4)
  criterion = CrossEntropyLoss()

[📸 캡처]
  베이스라인 학습 곡선 (val_acc per epoch)
  또는 터미널 학습 로그 마지막 5 epoch
```

---

### Slide 5 — 멀티태스크 모델 설계
```
레이아웃: 구조도 중심

단일태스크: 7개 속성 × 별도 모델 = 7개 모델 → 비효율
멀티태스크: 공유 backbone + 7개 독립 head = 1개 모델 → 한 번의 forward pass

[224×224 이미지]
      ↓
EfficientNet-B0 Backbone  (pretrained, num_classes=0)
      ↓ GlobalAvgPool → [1280차원] → Dropout(p=0.4)
      ↓
┌─────────────────────────────────────────────────┐
│ head₁ forehead_wrinkle      Linear(1280 → 7)   │
│ head₂ forehead_pigmentation Linear(1280 → 6)   │
│ head₃ l_perocular_wrinkle   Linear(1280 → 7)   │
│ head₄ l_cheek_pore          Linear(1280 → 5)   │
│ head₅ l_cheek_pigmentation  Linear(1280 → 6)   │
│ head₆ lip_dryness           Linear(1280 → 5)   │
│ head₇ chin_sagging          Linear(1280 → 6)   │
└─────────────────────────────────────────────────┘
      ↓
dict { target_name → logits (batch, K) }
```

---

### Slide 5 — 멀티태스크 코드 (MultiTaskSkinModel)
```
레이아웃: 코드블록 + [📸 캡처 공간]

코드:
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

  # 손실함수: 7개 head 평균 CE (결측 -1 제외)
  class MultiTaskLoss(nn.Module):
      def forward(self, preds, labels):
          total = sum(CE(ignore_index=-1)(preds[t], labels[:,i])
                      for i, t in enumerate(self.targets))
          return total / len(self.targets)

[📸 캡처]
  VS Code — src/models/cnn.py → MultiTaskSkinModel 클래스 전체
```

---

### Slide 5 — v3·v4 실패와 원인 분석
```
레이아웃: 좌우 비교

[시도한 것]
  v3: EfficientNet-B3 + CrossEntropy  ❌
  v4: EfficientNet-B3 + CORAL Loss    ❌
  → 둘 다 val_acc 낮음

[실패 원인]
  EfficientNet-B3: 파라미터 43MB
  EfficientNet-B0: 파라미터 16MB
  학습 데이터:     11,000장 (소규모)

  "모델이 데이터보다 너무 크면 train은 외워버리고
   val에서는 일반화 실패 = 과적합"

[📸 캡처]
  v3 또는 v4 학습 곡선: train_loss ↓ 지속 / val_acc 정체
  → 과적합 패턴이 명확히 보이는 그래프

[결론]
  → B0 유지 + Dropout 0.4 + WeightDecay 2e-4 강화
```

---

### Slide 5 — CORAL Loss — 핵심 개선
```
레이아웃: 좌 직관 설명 / 우 구조+코드

왼쪽 — 왜 CORAL인가?
  주름 등급: 0 < 1 < 2 < 3 < 4 < 5 < 6
  CrossEntropy: 순서 구조 무시 (0을 6으로 예측 = 1을 6으로 예측)
  CORAL:        순서 보장 ("grade≥1?", "grade≥2?", ... 임계값 분해)

  K클래스 → K-1개 binary 임계값
  예측: sigmoid(logit) > 0.5 → 넘는 개수 합산 = grade

오른쪽:
  # CORAL Head 구조
  기존: Linear(1280 → 7)   # 7 logit
  CORAL: Linear(1280 → 6)  # K-1 = 6 binary logit

  # 예측
  sigs = sigmoid(logits)          # [p₁, p₂, ..., p₆]
  grade = (sigs > 0.5).sum()      # 0.5 넘는 임계값 수

  # 손실
  # bin_labels[k] = 1 if label > k else 0
  loss = BCE(logits, bin_labels)

  참고: Cao et al. 2020
  "Rank Consistent Ordinal Regression for Neural Networks"

[📸 캡처]
  src/train/losses.py → CoralMultiTaskLoss 클래스
```

---

### Slide 5 — v5 학습 설정 & 전체 버전 비교
```
레이아웃: 상단 전체 버전 표 / 하단 v5 상세+캡처

[전체 버전 비교 — Ablation]
| 버전 | Backbone | Loss | val_acc | 결과 |
|-----|---------|------|---------|------|
| 베이스라인 | B0 | CE | 70.09% (단일 속성) | ✅ 파이프라인 검증 |
| v2 | B0 | CE | 51.70% (7속성) | ✅ 안정 버전 (폴백) |
| v3 | B3 | CE | 낮음 | ❌ 과적합 (43MB) |
| v4 | B3 | CORAL | 낮음 | ❌ B3 여전히 과적합 |
| v5 | B0 | CORAL | 51.70%+ | ✅ 현재 사용 |

→ CE vs CORAL: 순서형 오분류 패널티 차이 / B3 vs B0: 소규모 데이터에서 B3 과적합 확인

[v5 핵심 변경]
  Dropout 0.3 → 0.4   /   WeightDecay 1e-4 → 2e-4
  Scheduler: StepLR → CosineAnnealing
  RandomErasing p=0.2 추가

[📸 캡처 2개]
  캡처 1: v5 학습 곡선 (train_loss / val_acc per epoch)
  캡처 2: 속성별 val_acc 바차트 (7개 속성 비교)

[📸 캡처 가이드]
  train_multitask_v5.py 실행 후
  plt.plot(history['val_acc']) / history['per_task_acc'] 바차트
```

---

### Slide 5 — 여드름 전용 모델 — 도입 배경
```
레이아웃: 문제 → 해결 흐름

[문제]
  멀티태스크 내 acne 예측 불안정
  ● 병변 좌표 → 등급 변환 시 노이즈
  ● 공유 feature의 한계 (여드름 특유 패턴 학습 제한)
  ● false positive·negative 빈번

[해결]
  여드름 전용 데이터로 별도 학습
  ● 데이터: Kaggle ACNE04 + AI Hub
  ● 아키텍처: EfficientNetV2-M (더 깊고 강력한 모델)
  ● 결과: acc = 85.29% ✅

[클래스 정의]
  0 = 없음  /  1 = 경증 (병변 1~5개)
  
  2 = 중간  /  3 = 심함 (병변 16개+)

[📸 캡처]
  여드름 4등급 예시 이미지 4장 나란히 배치
```

---

### Slide 5 — 여드름 모델 구조 & 추론 결과
```
레이아웃: 좌 구조+코드 / 우 추론 로직+성능

왼쪽:
  class AcneSeverityModel(nn.Module):
      def __init__(self):
          base = EfficientNetV2-M (53.8M params)
          base.classifier = Sequential(
              Linear(1280→512), ReLU, Dropout(0.3),
              Linear(512→128),  ReLU, Dropout(0.3),
              Linear(128→4),    # 4-class
          )

  학습: 80 epochs / K-fold / AdamW
  최종 정확도: acc = 85.29% ✅

  [멀티태스크 내 acne vs 전용 모델]
  멀티태스크: 불안정 (공유 feature 한계)
  전용 모델:  85.29% → 분리의 효과 입증

오른쪽 — TTA + 신뢰도 스케일링:
  # 3종 변형 앙상블 (전체 얼굴 이미지)
  for tfm in [원본, 밝게, 어둡게]:
      logit_sum += softmax(model(tfm(img)))

  grade      = argmax(logit_sum / 3)
  confidence = max(logit_sum / 3)

  # 확신도 낮으면 점수 감쇄 (false positive 완화)
  acne_score = grade/3 * 100 * min(1.0, confidence * 1.5)

  # 폼 보정
  "여드름" 고민 미선택 → acne = min(acne, 30)
  "여드름" 선택 + CNN<35 → acne = max(acne, 40)

[📸 캡처 2개]
  캡처 1: src/models/cnn.py → AcneSeverityModel 클래스
  캡처 2: 여드름 confusion matrix 또는 학습 곡선
```

---

### Slide 5 — 전체 추론 파이프라인 코드
```
레이아웃: 코드블록 (핵심만)

# api/server.py — _run_inference() 요약
def _run_inference(img_bytes):
    img = Image.open(BytesIO(img_bytes)).convert("RGB")

    # 1. 얼굴 부위 크롭 (5개 부위)
    crops, face_detected = crop_faceparts(img, return_detection=True)

    # 2. 멀티태스크 TTA (3종 변형 × 5부위)
    for part, targets in FACEPART_TARGETS.items():
        for tfm in tta_transforms:
            outputs = model(tfm(crops[part]).unsqueeze(0))
            # CORAL: sigmoid 합산
            raw[t] = float((sigmoid(avg[0]) > 0.5).sum())

    # 3. 여드름 TTA (전체 이미지)
    for tfm in tta_transforms:
        logit_sum += softmax(acne_model(tfm(img).unsqueeze(0)))
    normalized["acne"] = grade/3 * 100 * min(1.0, confidence*1.5)

    # 4. 정규화 (0~100)
    return normalize_cnn_output(raw), face_detected

[📸 캡처]
  VS Code — api/server.py → _run_inference 함수 전체
```

---

## SECTION 4 — 추천 시스템 로직 (4장)

---

### Slide 5 — 성분 매핑 룰 테이블
```
레이아웃: 표 (전체)

[권장 성분 — 속성 점수 기준]
| 속성 | ≥65 (집중 케어) | 35~64 (기본 케어) |
|-----|----------------|-----------------|
| 건조도 | 히알루론산, 세라마이드, 글리세린, 스쿠알란, 판테놀 | 글리세린, 판테놀 |
| 색소침착 | 비타민C, 알부틴, 트라넥삼산, 나이아신아마이드 | 나이아신아마이드 |
| 주름 | 레티놀, 펩타이드, 비타민C, 아데노신 | 펩타이드, 아데노신 |
| 모공 | 살리실산, AHA, 나이아신아마이드 | 나이아신아마이드 |
| 여드름 | 살리실산, 티트리, 벤조일퍼옥사이드, 나이아신아마이드 | 나이아신아마이드 |
| 민감성(폼) | 센텔라아시아티카, 판테놀, 마데카소사이드, 알란토인 | — |

[회피 성분]
  알코올 → 에탄올·SD알코올   /   향료 → 프래그런스·퍼퓸
  파라벤 → 메틸/에틸/프로필파라벤   /   임신 중 → 레티놀·살리실산 추가

[연령대 보정]
  10대 pore+15 / 20대 pore+10 / 40대 wrinkle+10 / 50대+ wrinkle+20, pigment+10
```

---

### Slide 5 — 7속성 계산 & 종합점수 공식
```
레이아웃: 상단 표 / 하단 공식

[7속성 계산 출처]
| 속성 | 출처 | 주요 로직 |
|-----|------|---------|
| 유분 | 폼 (피부타입) | SKIN_TYPE_OIL 고정값 + oil_boost 델타 |
| 수분 | 폼 + CNN | 피부타입 베이스 + (50 - lip_dryness)*0.24 - 델타 |
| 민감도 | 폼 (민감도) | FORM_SENS_SCORE 고정값 + sens_boost 델타 |
| 색소침착 | CNN | pigmentation + 생활습관 델타 |
| 주름 | CNN + 폼 | wrinkle + 델타, "주름" 미선택 → max 52 cap |
| 모공 | CNN | pore + 생활습관 델타 |
| 여드름 | CNN + 폼 | acne TTA + 폼 보정 |

[레벨 판단: 전 속성 공통]
  value ≥ 65 → 높음 / ≥ 35 → 중간 / < 35 → 낮음

[종합점수 공식 — 4세대 최종]
  visible_bad = pore × 0.40 + pigment × 0.35 + wrinkle × 0.25
  score = 100 − visible_bad + (hydro − 50) × 0.10 − acne × 0.25
  score = clamp(10, round(score), 95)

  가중치 근거: 모공(40%) > 색소침착(35%) > 주름(25%)
  = 사람이 피부를 볼 때 가장 먼저 인식하는 순서
  유분 제거: 지성이어도 모공·색소·여드름 없으면 좋은 피부
```

---

### Slide 5 — 생활습관 델타 시스템
```
레이아웃: 표 + 코드

[주요 생활습관 → 속성 보정]
| 항목 | 값 | 속성 보정 |
|-----|-----|---------|
| 음주 | 자주 (주 1회+) | dryness +12, pigmentation +8 |
| 흡연 | 흡연 | wrinkle +15, pigmentation +10, sagging +8 |
| 클렌징 | 자주 빠짐 | pore +15, sens_boost +10 |
| 스트레스 | 심함 | sens_boost +15, pigmentation +8 |
| 수면 | < 5h | dryness +15, sagging +10 |
| 물 섭취 | 부족 (<4잔) | dryness +18 |
|        | 충분 (6잔+) | dryness −5 |
| 식습관 | 야식 자주 | oil_boost +10, pore +8 |

각 속성 델타 최대 ±20점 cap

코드:
  def compute_lifestyle_deltas(form):
      deltas = {}
      for key in LIFESTYLE_KEYS:       # 11개 항목
          for val in form.get(key, []):
              for attr, delta in MODIFIERS[key].get(val, {}).items():
                  deltas[attr] = deltas.get(attr, 0) + delta
      return {k: clamp(-20, v, 20) for k, v in deltas.items()}
```

---

### Slide 5 — 제품 추천 파이프라인
```
레이아웃: 플로우 + 코드

[플로우]
피부 분석 결과 (속성, 고민, 권장 성분)
        ↓
Claude Haiku → 네이버 검색어 3개 생성
  {"query":"히알루론산 토너", "key_ingredient":"히알루론산",
   "product_type":"토너", "reason":"건조한 피부에..."}
        ↓
asyncio.gather → 네이버 쇼핑 API 병렬 호출 (3개 동시)
        ↓
결과: 이미지 · 가격 · 구매 링크 포함 Top 3 제품

[Claude 프롬프트 핵심]
  "[피부 타입] + [속성 점수] + [권장 성분 4개]
   → 서로 다른 스텝의 검색어 3개 (토너/세럼/크림 등)"

[📸 캡처]
  server.py → _oliveyoung_recommend() 프롬프트 부분
```

---

## SECTION 5 — 웹 서비스 구조 (5장)

---

### Slide 5 — 전체 시스템 아키텍처
```
레이아웃: 레이어드 다이어그램

┌────────────────────────────────────────────────────┐
│  FRONTEND — React (design/)                         │
│  빌드 없음 / FastAPI가 FileResponse로 직접 서빙       │
│  analyze → results → dashboard / mypage / clinic   │
└────────────────────┬───────────────────────────────┘
                     │ HTTP (multipart/form-data + JSON)
                     ↓
┌────────────────────────────────────────────────────┐
│  BACKEND — FastAPI 0.4 (api/server.py)              │
│  POST /api/analyze  ★ 메인 파이프라인               │
│  GET  /api/history  | /api/ingredient/{name}       │
│  POST /api/clinic   | /api/diet                    │
│  CRUD /api/me/...   (알림/일기/위시리스트)           │
└──────────┬──────────────┬──────────────┬────────────┘
           ↓              ↓              ↓
    ┌──────────┐  ┌───────────────┐  ┌──────────────┐
    │ ML 모델  │  │  외부 API     │  │  SQLite DB   │
    │          │  │ Claude Haiku  │  │ data/history │
    │ MultiTask│  │  - 검색어 생성│  │ .db          │
    │ CNN (B0) │  │  - 피부 설명  │  │ 6개 테이블   │
    │          │  │  - 성분 정보  │  │              │
    │ AcneCNN  │  │ 네이버 쇼핑   │  │              │
    │ (EfNetV2)│  │  - 실제 제품  │  │              │
    └──────────┘  └───────────────┘  └──────────────┘

환경변수: ANTHROPIC_API_KEY / NAVER_CLIENT_ID / NAVER_CLIENT_SECRET
```

---

### Slide 5 — 프론트엔드 화면 구성
```
레이아웃: 화면 목록 + 각 역할 설명

[React 화면 구성 — design/skin/screens/]

analyze.jsx    ★ 분석 메인
  Step 0: 사진 업로드 (파일 선택 / 웹캠 촬영)
  Step 1: 폼 입력 (필수 5개 + 선택 생활습관 11개)
  Step 2: 로딩 + POST /api/analyze 호출

results.jsx    ★ 분석 결과
  7개 속성 바 차트 (낮음/중간/높음 레벨 표시)
  종합점수 / 피부 타입 라벨
  Claude AI 피부 요약
  권장·회피·주의 성분 카드
  추천 제품 Top 3 (이미지·가격·링크)

dashboard.jsx  히스토리 점수 변화 그래프
mypage.jsx     프로필 / 위시리스트 / 알림
clinic.jsx     피부과 시술 추천 (Claude AI)
diet.jsx       식단 추천 (피부 맞춤)

[특이사항]
  ● 숫자 대신 레벨 표시 이유:
    val_acc 51.7% → "56점 vs 48점" 차이 신뢰 불가
    → 낮음/중간/높음 3단계 = ~70~80% 신뢰
  ● 이전 분석 폼 자동완성: /api/history/last_form
  ● 비로그인도 분석 가능 (로그인 시 히스토리 저장)
```

---

### Slide 5 — 분석 화면 UX 흐름
```
레이아웃: 4단계 스텝 흐름 (화살표 연결)

[Step 0] 사진 업로드
  ├ 파일 선택 (JPG/PNG)
  └ 웹캠 촬영
    - navigator.mediaDevices.getUserMedia()
    - canvas.drawImage(video) → Blob → File
    - 얼굴 가이드 오버레이

[Step 1] 정보 입력
  필수: 피부타입 / 나이대 / 성별 / 민감도 / 피부 고민 / 알러지
  선택 (생활습관): 음주 / 흡연 / 클렌징 / 호르몬·스트레스 /
                   소화 / 수면 / 물 섭취 / 열노출 / 오염 / 땀 / 식습관
  + 이전 분석 기록 자동완성 (로그인 시)

[Step 2] 로딩
  5단계 애니메이션 / POST /api/analyze → 서버 처리 ~10~20초

[Step 3] 결과 화면
  속성 바 차트 + 점수 + Claude 설명 + 성분 + 제품 추천

[📸 캡처]
  실제 웹 화면 캡처 (각 step 화면 4장)
  → analyze.jsx Step 0~3 실제 렌더링 화면
```

---

### Slide 5 — API & DB 구조
```
레이아웃: 좌 주요 API / 우 DB 테이블

왼쪽 — 핵심 API:
  POST /api/analyze       ★ 이미지+폼 → 전체 분석
  GET  /api/history       분석 기록 목록
  GET  /api/history/last_form  폼 자동완성
  GET  /api/ingredient/{name}  성분 상세 (Claude)
  POST /api/clinic/recommend   시술 추천 (Claude)
  POST /api/diet/recommend     식단 추천 (Claude)
  CRUD /api/me/notifications   알림
  CRUD /api/me/diary           식단 일기
  CRUD /api/me/wishlist        위시리스트

오른쪽 — SQLite 테이블:
  users        id / username / password_hash (pbkdf2) / nickname
  sessions     token (Bearer) / user_id
  analyses     id / user_id / composite / skin_label / full_data (JSON)
  notifications id / user_id / type / title / is_read
  diaries      id / user_id / date / food / skin_effect
  wishlist     id / user_id / item_type / title

  인증: Bearer 토큰 / 비로그인도 분석 가능 (user_id=NULL)
```

---

### Slide 5 — POST /api/analyze 처리 흐름
```
레이아웃: 번호 순서 플로우

POST /api/analyze (image + form_data JSON)
        ↓
① CNN 추론 (_run_inference)
   crop_faceparts() → TTA 3종 → MultiTask 7속성 + Acne 모델
        ↓
② 생활습관 델타 (compute_lifestyle_deltas)
   폼 11개 항목 → 속성별 ±최대 20점
        ↓
③ 7속성 생성 (build_frontend_attrs)
   CNN + 폼 + 델타 → {key, name, value, level, desc}
        ↓
④ 종합점수 + 피부타입 (composite_score, skin_type_label)
        ↓
⑤ 성분 추천 (get_recommended_ingredients, get_avoid_ingredients)
   속성 점수 → 룰 테이블 → 최대 6개
        ↓
⑥ 제품 추천 (Claude Haiku → 네이버 쇼핑 API 병렬)
        ↓
⑦ Claude AI 설명 (_generate_explanation)
   구조화 JSON: skin_summary / care_tips / lifestyle_note
        ↓
JSON 응답 반환 → 결과 저장 (SQLite)
```

---

## SECTION 6 — 결론 (2장)

---

### Slide 5 — 한계점 & Future Work
```
레이아웃: 좌우 2분할

[현재 한계]
  ① 멀티태스크 val_acc 51.7%
     7개 동시 예측 + 11,000장 소규모 데이터 한계
  ② Domain Mismatch
     학습: 스튜디오 고화질 / 추론: 셀카 + 다양한 조명·각도
  ③ 수분 간접 측정
     lip_dryness만으로 전체 수분 추정 한계

[Future Work]
  🔴 우선:
  ● 속성별 전문 모델 분리 (여드름처럼 주름·모공·색소 각각)
  ● r_cheek + glabellus_wrinkle 추가 → v6
  ● WeightedRandomSampler로 클래스 불균형 해결

  🟡 중간:
  ● Late Fusion: 이미지 feature + 폼 feature concat 학습
  ● 성분 매핑 룰 → LLM 기반 동적 생성으로 확장
```

---

### Slide 5 — 결론
```
레이아웃: 핵심 3줄 + 마무리 박스

핵심 기여:
  ① 한국인 데이터 기반 CNN + CORAL 멀티태스크
     → v1~v5 실패·개선 경험 → B0+CORAL 최적 조합 도출
  ② 여드름 전용 모델 분리 (acc 85.29%)
     → 멀티태스크의 한계를 전문 모델로 보완
  ③ Claude + 네이버 쇼핑 API end-to-end 추천
     → 이미지 분석부터 실제 구매까지 한 파이프라인

발표 포인트:
  "베이스라인 70% → 멀티태스크 51.7% → 여드름 85.29%
   이 숫자들은 각 단계의 실패 분석과 개선 과정입니다."

┌─────────────────────────────────────────────────────┐
│ ⚠️ 이 시스템은 화장품 추천 보조 도구입니다.           │
│    의료 진단이 아닙니다.                              │
└─────────────────────────────────────────────────────┘

감사합니다 · Q&A
```

---

## ■ 코드 스크린샷 캡처 체크리스트 (12개)

```
□ Slide  7 : 라벨 분포 히스토그램 + df.describe() 출력
□ Slide  8 : 얼굴 5개 부위 박스 그려진 실제 이미지 결과
□ Slide  9 : 베이스라인 학습 곡선 (val_acc per epoch)
□ Slide 10 : MultiTaskSkinModel 클래스 코드 (cnn.py)
□ Slide 10 : v3/v4 과적합 학습 곡선 그래프
□ Slide 10 : CoralMultiTaskLoss 클래스 코드 (losses.py)
□ Slide 10 : v5 학습 곡선 + 속성별 val_acc 바차트
□ Slide 10 : 여드름 4등급 예시 이미지 4장
□ Slide 10 : AcneSeverityModel 코드 + confusion matrix
□ Slide 10 : _run_inference() 함수 코드 (server.py)
□ Slide 20 : _oliveyoung_recommend() 프롬프트 코드
□ Slide 23 : 실제 웹 화면 Step 0~3 캡처 4장
```

---

## ■ 발표 시간 배분 (약 20~25분 + 시연 별도)

| 섹션 | 슬라이드 | 시간 |
|------|---------|------|
| 표지·목차 | 1-2 | 1분 |
| 프로젝트 개요 | 3-4 | 2분 |
| 데이터 | 5-7 | 3분 |
| 모델 학습 | 8-16 | 8분 |
| 추천 시스템 | 17-20 | 3분 |
| 웹 서비스 | 21-25 | 4분 |
| 결론 | 26-27 | 2분 |
| 시연 (별도) | — | 5~10분 |
