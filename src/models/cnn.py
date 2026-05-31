"""
EfficientNet-B0 기반 피부 속성 분류 모델.

베이스라인: 단일 속성 N-class 분류
Multi-task: 7개 속성 독립 head (각 head는 해당 속성의 num_classes)
"""

import torch
import torch.nn as nn
import timm

from src.data.aihub_loader import ANNOTATION_MAX, MULTITASK_TARGETS


def build_baseline_model(num_classes: int = 7) -> nn.Module:
    """단일 속성 분류 베이스라인 (EfficientNet-B0 pretrained)."""
    model = timm.create_model(
        "efficientnet_b0",
        pretrained=True,
        num_classes=num_classes,
    )
    return model


class MultiTaskSkinModel(nn.Module):
    """
    EfficientNet-B0 backbone + 속성별 독립 분류 head.

    각 head: Linear(1280 → num_classes_i)
    모든 타겟이 순서형 분류 (0~N)이므로 CrossEntropy 사용.
    결측 타겟은 ignore_index=-1 로 loss에서 제외.

    Parameters
    ----------
    targets : 학습 타겟 이름 리스트 (MULTITASK_TARGETS)
    dropout : head 직전 dropout 비율
    """

    def __init__(
        self,
        targets: list = None,
        dropout: float = 0.3,
        backbone_name: str = "efficientnet_b0",
    ):
        super().__init__()
        self.targets = targets or MULTITASK_TARGETS

        # backbone (classification head 제거)
        self.backbone = timm.create_model(
            backbone_name,
            pretrained=True,
            num_classes=0,     # feature extractor mode
            global_pool="avg",
        )
        feat_dim = self.backbone.num_features  # 1280

        self.dropout = nn.Dropout(p=dropout)

        # 속성별 독립 head
        self.heads = nn.ModuleDict({
            t: nn.Linear(feat_dim, ANNOTATION_MAX[t] + 1)
            for t in self.targets
        })

    def forward(self, x: torch.Tensor) -> dict:
        """
        Returns
        -------
        dict[target_name → logits (B, num_classes_i)]
        """
        feats = self.dropout(self.backbone(x))
        return {t: head(feats) for t, head in self.heads.items()}

    def num_classes_per_target(self) -> dict:
        return {t: ANNOTATION_MAX[t] + 1 for t in self.targets}


class MultiTaskSkinModelCORAL(nn.Module):
    """
    EfficientNet backbone + CORAL 순서형 회귀 head.

    일반 분류 head(K logits) 대신 CORAL head(K-1 binary logits)를 사용.
    순서형 구조(0 < 1 < 2 < ...)를 손실 함수에 반영해 인접 클래스 오분류 패널티를 낮춤.

    Parameters
    ----------
    backbone_name : timm 모델 이름 (기본: efficientnet_b3)
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

        self.backbone = timm.create_model(
            backbone_name,
            pretrained=True,
            num_classes=0,
            global_pool="avg",
        )
        feat_dim = self.backbone.num_features

        self.dropout = nn.Dropout(p=dropout)

        # CORAL: 각 head는 K-1개 logit 출력 (K = n_classes)
        self.heads = nn.ModuleDict({
            t: nn.Linear(feat_dim, ANNOTATION_MAX[t])   # K-1
            for t in self.targets
        })

    def forward(self, x: torch.Tensor) -> dict:
        """Returns dict[target → logits (B, K-1)]."""
        feats = self.dropout(self.backbone(x))
        return {t: head(feats) for t, head in self.heads.items()}

    def predict_classes(self, x: torch.Tensor) -> dict:
        """추론용: sigmoid threshold 합산으로 클래스 예측 (argmax 대체)."""
        with torch.no_grad():
            logits = self.forward(x)
        return {
            t: (torch.sigmoid(lg) > 0.5).sum(dim=1)
            for t, lg in logits.items()
        }
