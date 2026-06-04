"""
EfficientNet 기반 피부 속성 분류 모델.

[모델 진화 경로]
  베이스라인 : 단일 속성(이마 주름) 7-class CE  →  val_acc 70.09%
  v2         : 7속성 멀티태스크 CE              →  val_acc 51.70%
  v3/v4      : B3 backbone 시도                 →  과적합으로 폐기
  v5(현재)   : B0 + CORAL 손실                 →  MAE 0.98 → 0.62

[왜 EfficientNet-B0인가?]
  B3(43MB)는 11,000장 데이터에 비해 파라미터가 너무 많아 과적합.
  B0(16MB)는 데이터 규모에 적합하고 ImageNet pretrained 가중치로
  전이학습 효과를 최대화할 수 있다.
"""

import torch
import torch.nn as nn
import timm
import torchvision.models as tvm

from src.data.aihub_loader import ANNOTATION_MAX, MULTITASK_TARGETS


def build_baseline_model(num_classes: int = 7) -> nn.Module:
    """
    단일 속성 분류 베이스라인 모델 (EfficientNet-B0 pretrained).

    [역할]
    7속성 멀티태스크로 바로 가기 전에 데이터 로더·학습 루프·평가 코드가
    정상 동작하는지 검증하기 위한 가장 단순한 모델.
    이마 주름(0~6, 7클래스) 하나만 학습 → val_acc 70.09% 달성.
    """
    model = timm.create_model(
        "efficientnet_b0",
        pretrained=True,    # ImageNet 사전학습 가중치 사용 (전이학습)
        num_classes=num_classes,
    )
    return model


class MultiTaskSkinModel(nn.Module):
    """
    EfficientNet-B0 backbone + 속성별 독립 분류 head (CrossEntropy 버전).

    [멀티태스크 설계 이유]
    - 속성 7개 × 별도 모델 = 7개 모델 → 메모리·속도 비효율
    - 공유 backbone 1개 + 독립 head 7개 = 1개 모델로 한 번에 해결
    - 공유 feature에서 속성 간 상관관계(모공↑ → 유분↑ 등)를 함께 학습 가능

    [한계 — 왜 v5에서 CORAL로 교체했나?]
    CE는 등급의 순서 관계를 무시한다.
    주름 4등급을 0으로 틀리든 3으로 틀리든 패널티가 같다.
    피부 분석에서 큰 오분류는 완전히 잘못된 성분 추천으로 이어진다.

    Parameters
    ----------
    targets      : 학습 타겟 이름 리스트 (MULTITASK_TARGETS)
    dropout      : head 직전 dropout 비율 (정규화)
    backbone_name: timm 모델 이름
    """

    def __init__(
        self,
        targets: list = None,
        dropout: float = 0.3,
        backbone_name: str = "efficientnet_b0",
    ):
        super().__init__()
        self.targets = targets or MULTITASK_TARGETS

        # ─── Backbone ────────────────────────────────────────────────────
        # num_classes=0: 분류 head를 제거하고 feature extractor 모드로 사용
        # global_pool="avg": 공간 차원을 평균 풀링으로 압축 → 1280차원 벡터
        # pretrained=True: ImageNet 학습 가중치 재사용 (전이학습)
        self.backbone = timm.create_model(
            backbone_name,
            pretrained=True,
            num_classes=0,
            global_pool="avg",
        )
        feat_dim = self.backbone.num_features  # EfficientNet-B0 = 1280

        # Dropout: 과적합 방지. 학습 시 일부 뉴런을 랜덤하게 끔
        self.dropout = nn.Dropout(p=dropout)

        # ─── 속성별 독립 Head ─────────────────────────────────────────────
        # ModuleDict로 관리하면 PyTorch가 각 head의 파라미터를 자동으로 추적
        # ANNOTATION_MAX[t]+1 = 해당 속성의 클래스 수
        # 예) forehead_wrinkle: max=6 → 7클래스 → Linear(1280, 7)
        self.heads = nn.ModuleDict({
            t: nn.Linear(feat_dim, ANNOTATION_MAX[t] + 1)
            for t in self.targets
        })

    def forward(self, x: torch.Tensor) -> dict:
        """
        입력 이미지 → 7속성 logit dict.

        Returns
        -------
        dict[target_name → logits (batch, num_classes_i)]
        각 속성마다 클래스 수가 다르므로 dict로 반환.
        """
        # 1. Backbone으로 1280차원 feature 추출
        feats = self.dropout(self.backbone(x))
        # 2. 각 head가 독립적으로 자기 속성만 예측
        return {t: head(feats) for t, head in self.heads.items()}

    def num_classes_per_target(self) -> dict:
        return {t: ANNOTATION_MAX[t] + 1 for t in self.targets}


class MultiTaskSkinModelCORAL(nn.Module):
    """
    EfficientNet backbone + CORAL 순서형 회귀 head (현재 사용 버전, v5).

    [CORAL을 도입한 이유]
    피부 등급은 순서가 있다: 0(정상) < 1 < 2 < ... < 6(심각).
    일반 CE는 이 순서를 무시하지만 CORAL은 순서 구조를 손실에 반영한다.

    [CORAL Head 구조]
    일반 CE head: Linear(1280 → K)      — K개 logit, argmax로 예측
    CORAL head:   Linear(1280 → K-1)    — K-1개 binary logit

    예측 방법:
    sigmoid(logits) → [p₁, p₂, ..., p_{K-1}]
    grade = Σ(pᵢ > 0.5)  ← 0.5 초과 임계값 개수 합산

    예시 (주름 0~6, K=7):
    sigmoid 출력 [0.9, 0.8, 0.3, 0.1, 0.0, 0.0]
    → [1, 1, 0, 0, 0, 0] → 합산 = 2 → 예측 등급 2

    [결과]
    Accuracy는 CE와 동일하지만 MAE(평균 오차)가 0.98 → 0.62로 개선.
    큰 오분류(예: 4→0)를 방지해 추천 품질이 향상된다.

    Parameters
    ----------
    backbone_name : timm 모델 이름 (기본: efficientnet_b0 권장)
    targets       : 학습 타겟 이름 리스트
    dropout       : head 직전 dropout 비율
    """

    def __init__(
        self,
        backbone_name: str = "efficientnet_b3",
        targets: list = None,
        dropout: float = 0.3,
    ):
        super().__init__()
        self.targets = targets or MULTITASK_TARGETS

        # Backbone: feature extractor 모드 (num_classes=0)
        self.backbone = timm.create_model(
            backbone_name,
            pretrained=True,
            num_classes=0,
            global_pool="avg",
        )
        feat_dim = self.backbone.num_features

        self.dropout = nn.Dropout(p=dropout)

        # ─── CORAL Head ───────────────────────────────────────────────────
        # 일반 CE와의 차이: ANNOTATION_MAX[t]만 사용 (= K-1개 logit)
        # 일반 CE는 ANNOTATION_MAX[t]+1 (= K개 logit)
        # 이 1개 차이가 순서형 회귀를 가능하게 한다
        self.heads = nn.ModuleDict({
            t: nn.Linear(feat_dim, ANNOTATION_MAX[t])   # K-1개 binary logit
            for t in self.targets
        })

    def forward(self, x: torch.Tensor) -> dict:
        """
        입력 이미지 → 7속성 CORAL logit dict.

        Returns dict[target → logits (batch, K-1)]
        손실 함수(CoralMultiTaskLoss)에서 binary cross-entropy로 학습.
        """
        feats = self.dropout(self.backbone(x))
        return {t: head(feats) for t, head in self.heads.items()}

    def predict_classes(self, x: torch.Tensor) -> dict:
        """
        추론용 편의 메서드: sigmoid threshold 합산으로 등급 예측.

        [argmax 대신 합산을 쓰는 이유]
        CORAL head는 K-1개의 binary 임계값 출력이다.
        argmax는 의미가 없고, sigmoid > 0.5인 임계값 개수를 세는 게 올바른 예측 방법.
        """
        with torch.no_grad():
            logits = self.forward(x)
        return {
            t: (torch.sigmoid(lg) > 0.5).sum(dim=1)
            for t, lg in logits.items()
        }


class AcneSeverityModel(nn.Module):
    """
    EfficientNetV2-M 기반 여드름 심각도 4-class 분류 모델.

    [왜 멀티태스크에 통합하지 않고 별도 모델인가?]
    1. AI Hub 여드름 라벨이 병변 좌표 리스트 형식 (Object Detection 어노테이션).
       부위별 크롭을 입력으로 받는 멀티태스크 구조와 호환되지 않는다.
    2. 여드름은 이마·볼·턱 등 얼굴 전체에 분포하므로
       특정 부위 크롭이 아닌 전체 이미지를 입력으로 받아야 정확하다.

    [왜 EfficientNetV2-M인가?]
    여드름 전용 데이터(Kaggle+AI Hub)로 충분히 학습할 수 있는 규모이고,
    더 깊은 모델이 세밀한 병변 패턴을 더 잘 포착한다.
    학습: 80 epochs, K-fold 교차검증, Kaggle ACNE04 + AI Hub 통합.

    클래스 정의:
      0 = 없음    (null 또는 병변 0개)
      1 = 경증    (병변 1~5개)
      2 = 중간    (병변 6~15개, 또는 cyst/pustule 포함)
      3 = 심함    (병변 16개 이상, 또는 다발성 낭포)

    최종 정확도: acc = 85.29%
    """

    def __init__(self):
        super().__init__()

        # EfficientNetV2-M 로드 (weights=None: 사전학습 없이, 팀원이 처음부터 학습)
        base = tvm.efficientnet_v2_m(weights=None)

        # 기존 분류 head를 4-class 분류기로 교체
        # Linear(1280→512)→ReLU→Dropout: 1280차원 feature를 점진적으로 압축
        # 마지막 Linear(128→4): 4등급 분류
        base.classifier = nn.Sequential(
            nn.Linear(1280, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 4),    # 4-class: 없음/경증/중간/심함
        )
        self.backbone = base

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        입력: 전체 얼굴 이미지 (224×224)
        출력: 4클래스 logit (batch, 4)

        [추론 시 신뢰도 스케일링]
        실제 서비스에서는 forward 결과에 추가 처리를 한다:
          probs = softmax(logits)
          grade = argmax(probs)
          confidence = max(probs)
          acne_score = grade/3 * 100 * min(1.0, confidence * 1.5)
        → confidence가 낮으면(불확실) 점수를 감쇄해 false positive 방지
        """
        return self.backbone(x)
