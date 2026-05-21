import timm
import torch.nn as nn


def build_baseline_model(num_classes: int = 3) -> nn.Module:
    """단일 속성 분류 베이스라인 (Phase 4)."""
    model = timm.create_model("efficientnet_b0", pretrained=True, num_classes=num_classes)
    return model
