import timm
import torch
import torch.nn as nn


class MultiTaskSkinModel(nn.Module):
    """
    EfficientNet-B0 backbone + 7개 속성 독립 head.
    - 회귀 (5): oiliness, dryness, pigmentation, pore, wrinkle
    - 분류 (2): acne_grade (4-class), sensitivity_class (2-class)
    """

    REGRESSION_ATTRS = ["oiliness", "dryness", "pigmentation", "pore", "wrinkle"]
    CLASSIFICATION_ATTRS = [("acne_grade", 4), ("sensitivity_class", 2)]

    def __init__(self, pretrained: bool = True):
        super().__init__()
        self.backbone = timm.create_model("efficientnet_b0", pretrained=pretrained, num_classes=0)
        feat_dim = self.backbone.num_features

        # 회귀 head (속성별 스칼라 출력)
        self.reg_heads = nn.ModuleDict({
            attr: nn.Linear(feat_dim, 1) for attr in self.REGRESSION_ATTRS
        })

        # 분류 head
        self.cls_heads = nn.ModuleDict({
            attr: nn.Linear(feat_dim, n_cls) for attr, n_cls in self.CLASSIFICATION_ATTRS
        })

    def forward(self, x: torch.Tensor) -> dict:
        feat = self.backbone(x)
        out = {}
        for attr in self.REGRESSION_ATTRS:
            out[attr] = self.reg_heads[attr](feat).squeeze(-1)
        for attr, _ in self.CLASSIFICATION_ATTRS:
            out[attr] = self.cls_heads[attr](feat)
        return out
