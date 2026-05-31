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
    ):
        super().__init__()
        self.targets = targets or MULTITASK_TARGETS

        # EfficientNet-B0 backbone (classification head 제거)
        self.backbone = timm.create_model(
            "efficientnet_b0",
            pretrained=True,
            num_classes=0,     # feature extractor mode
            global_pool="avg", # → (B, 1280)
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
