import torch
import torch.nn as nn
from src.models.multitask import MultiTaskSkinModel


class MultiTaskLoss(nn.Module):
    """MSE(회귀) + CrossEntropy(분류) weighted sum."""

    def __init__(self, reg_weight: float = 1.0, cls_weight: float = 1.0):
        super().__init__()
        self.reg_weight = reg_weight
        self.cls_weight = cls_weight
        self.mse = nn.MSELoss()
        self.ce = nn.CrossEntropyLoss()

    def forward(self, preds: dict, reg_targets: torch.Tensor, cls_targets: torch.Tensor) -> torch.Tensor:
        reg_loss = sum(
            self.mse(preds[attr], reg_targets[:, i])
            for i, attr in enumerate(MultiTaskSkinModel.REGRESSION_ATTRS)
        )
        cls_loss = sum(
            self.ce(preds[attr], cls_targets[:, i])
            for i, (attr, _) in enumerate(MultiTaskSkinModel.CLASSIFICATION_ATTRS)
        )
        return self.reg_weight * reg_loss + self.cls_weight * cls_loss
