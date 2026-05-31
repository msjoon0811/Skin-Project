"""
Multi-task 피부 속성 분류 손실 함수.

모든 타겟이 순서형 분류 (0~N)이므로 CrossEntropy만 사용.
결측 라벨 = -1 → ignore_index=-1 로 해당 샘플의 해당 타겟 loss 제외.
"""

import torch
import torch.nn as nn
from typing import Optional


class BaselineCrossEntropyLoss(nn.Module):
    """단일 속성 베이스라인용 CE loss."""

    def __init__(
        self,
        weight: Optional[torch.Tensor] = None,
        label_smoothing: float = 0.0,
    ):
        super().__init__()
        self.ce = nn.CrossEntropyLoss(weight=weight, label_smoothing=label_smoothing)

    def forward(self, logits: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        return self.ce(logits, labels)


class MultiTaskLoss(nn.Module):
    """
    7개 속성 Multi-task CrossEntropy loss.

    각 타겟별 CE를 계산하고 평균 (또는 가중 합산).
    결측(-1) 라벨은 ignore_index=-1로 자동 제외.

    Parameters
    ----------
    targets      : 타겟 이름 리스트 (MULTITASK_TARGETS)
    task_weights : 타겟별 loss 가중치 dict (None이면 균등)
    """

    def __init__(
        self,
        targets: list,
        task_weights: Optional[dict] = None,
        class_weights: Optional[dict] = None,
    ):
        super().__init__()
        self.targets = targets
        self.task_weights = task_weights or {t: 1.0 for t in targets}

        # class_weights: {target_name: FloatTensor(n_classes)} — 클래스 불균형 보정
        cw = class_weights or {}
        self.ce_fns = nn.ModuleDict({
            t: nn.CrossEntropyLoss(ignore_index=-1, weight=cw.get(t))
            for t in targets
        })

    def forward(
        self,
        preds: dict,
        labels: torch.Tensor,
    ) -> tuple[torch.Tensor, dict]:
        """
        Parameters
        ----------
        preds  : {target_name: logits (B, num_classes)}
        labels : (B, num_targets) long tensor, -1=결측

        Returns
        -------
        total_loss : scalar tensor
        per_task   : dict {target_name: loss_value (float)}
        """
        total = torch.tensor(0.0, device=labels.device, requires_grad=True)
        per_task = {}

        for i, t in enumerate(self.targets):
            t_labels = labels[:, i]
            t_logits = preds[t]
            w = self.task_weights[t]

            loss = self.ce_fns[t](t_logits, t_labels)
            if not torch.isnan(loss):
                total = total + w * loss
                per_task[t] = loss.item()
            else:
                per_task[t] = 0.0

        return total / len(self.targets), per_task


class CoralMultiTaskLoss(nn.Module):
    """
    CORAL (Consistent Rank Logits) 기반 Multi-task 순서형 분류 손실.

    순서형 클래스(0 < 1 < 2 < ...)의 구조를 학습에 반영.
    각 속성 head는 K-1개의 binary threshold logit을 출력.
    → 클래스 k 예측: sigmoid(logit_0..k-1) > 0.5 합산

    Parameters
    ----------
    targets      : 타겟 이름 리스트
    task_weights : 타겟별 loss 가중치 (None=균등)

    References
    ----------
    Cao et al., "Rank consistent ordinal regression for neural networks", 2020.
    """

    def __init__(
        self,
        targets: list,
        task_weights: Optional[dict] = None,
    ):
        super().__init__()
        self.targets      = targets
        self.task_weights = task_weights or {t: 1.0 for t in targets}

    def forward(
        self,
        preds: dict,
        labels: torch.Tensor,
    ) -> tuple[torch.Tensor, dict]:
        """
        Parameters
        ----------
        preds  : {target_name: logits (B, K-1)}  — CORAL head 출력
        labels : (B, num_targets) long tensor, -1=결측

        Returns
        -------
        total_loss : scalar tensor
        per_task   : dict {target_name: loss_value (float)}
        """
        total = torch.tensor(0.0, device=labels.device, requires_grad=True)
        per_task = {}

        for i, t in enumerate(self.targets):
            t_labels = labels[:, i]       # (B,)
            t_logits = preds[t]           # (B, K-1)
            n_thresh = t_logits.size(1)   # K-1

            valid = t_labels != -1
            if valid.sum() == 0:
                per_task[t] = 0.0
                continue

            lv = t_labels[valid]          # (B_v,)
            lv_logits = t_logits[valid]   # (B_v, K-1)

            # binary label matrix: y_k = 1 if label > k
            thresholds = torch.arange(n_thresh, device=labels.device)
            bin_labels = (lv.unsqueeze(1) > thresholds.unsqueeze(0)).float()

            loss = torch.nn.functional.binary_cross_entropy_with_logits(
                lv_logits, bin_labels
            )

            w = self.task_weights[t]
            if not torch.isnan(loss):
                total = total + w * loss
                per_task[t] = loss.item()
            else:
                per_task[t] = 0.0

        return total / len(self.targets), per_task
