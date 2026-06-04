"""
Multi-task 피부 속성 분류 손실 함수.

[손실 함수 역할]
  모델 예측값과 정답 사이의 오차를 숫자로 표현한 것.
  이 숫자를 최소화하는 방향으로 역전파(backpropagation)를 통해 가중치를 업데이트한다.

[왜 두 가지 손실 함수가 있는가?]
  MultiTaskLoss    : CrossEntropy 기반 (v2). 순서 무시 → 큰 오분류 발생.
  CoralMultiTaskLoss: CORAL 기반 (v5, 현재 사용). 순서 반영 → MAE 개선.

[결측 라벨(-1) 처리]
  AI Hub JSON 1개는 얼굴 1개 부위만 커버하므로
  이마 JSON에는 볼 모공 라벨이 없다 → -1로 표시.
  손실 계산 시 -1 위치는 ignore_index=-1로 제외한다.
  모르는 걸 억지로 학습하지 않도록 하는 핵심 설계.
"""

import torch
import torch.nn as nn
from typing import Optional


class BaselineCrossEntropyLoss(nn.Module):
    """
    단일 속성 베이스라인용 CrossEntropy Loss.

    베이스라인(단일 속성 학습)에서만 사용.
    멀티태스크에서는 MultiTaskLoss 또는 CoralMultiTaskLoss를 사용.
    """

    def __init__(
        self,
        weight: Optional[torch.Tensor] = None,
        label_smoothing: float = 0.0,
    ):
        super().__init__()
        # weight: 클래스 불균형 보정용 가중치 벡터
        # label_smoothing: 과신(overconfidence) 방지. 0이면 비활성화.
        self.ce = nn.CrossEntropyLoss(weight=weight, label_smoothing=label_smoothing)

    def forward(self, logits: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        return self.ce(logits, labels)


class MultiTaskLoss(nn.Module):
    """
    7개 속성 Multi-task CrossEntropy Loss (v2에서 사용, 현재는 CORAL로 교체).

    [CE의 한계 — 왜 v5에서 CORAL로 바꿨나?]
    주름 실제 4등급을 0으로 예측하든 3으로 예측하든 CE는 "틀림 1번"으로 동일.
    그러나 4→0 오분류는 주름 성분을 전혀 추천하지 않는 치명적 결과를 낳는다.
    CE는 순서 관계(0 < 1 < 2 < ...)를 무시하기 때문이다.

    [동작 방식]
    7개 head 각각 CE loss를 계산하고 평균을 낸다.
    결측(-1) 라벨은 ignore_index=-1로 해당 위치의 loss를 0으로 처리.

    Parameters
    ----------
    targets      : 타겟 이름 리스트 (MULTITASK_TARGETS)
    task_weights : 타겟별 loss 가중치 dict (None이면 모두 1.0으로 균등)
    class_weights: 클래스 불균형 보정용 가중치 {target: FloatTensor(n_classes)}
    """

    def __init__(
        self,
        targets: list,
        task_weights: Optional[dict] = None,
        class_weights: Optional[dict] = None,
    ):
        super().__init__()
        self.targets = targets
        # 속성별 가중치: 특정 속성(예: 여드름)을 더 중요하게 학습하고 싶을 때 사용
        self.task_weights = task_weights or {t: 1.0 for t in targets}

        cw = class_weights or {}
        # 속성마다 별도 CE 함수를 만드는 이유:
        # 각 속성의 클래스 수가 다르고 (주름7, 모공5 등),
        # 클래스 가중치도 속성마다 별도로 적용해야 하기 때문
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
        preds  : {target_name: logits (batch, num_classes)} — 모델 출력
        labels : (batch, 7) long tensor, -1=결측

        Returns
        -------
        total_loss : 7속성 loss 평균 (역전파에 사용)
        per_task   : 속성별 loss 값 {target: float} (모니터링용)
        """
        total = torch.tensor(0.0, device=labels.device, requires_grad=True)
        per_task = {}

        for i, t in enumerate(self.targets):
            t_labels = labels[:, i]   # 이 속성의 라벨만 추출
            t_logits = preds[t]       # 이 속성의 예측값만 추출
            w = self.task_weights[t]  # 이 속성의 loss 가중치

            loss = self.ce_fns[t](t_logits, t_labels)
            if not torch.isnan(loss):  # NaN 방지 (모든 샘플이 결측일 경우)
                total = total + w * loss
                per_task[t] = loss.item()
            else:
                per_task[t] = 0.0

        # 7개 loss의 평균으로 최종 loss 계산
        return total / len(self.targets), per_task


class CoralMultiTaskLoss(nn.Module):
    """
    CORAL (Consistent Rank Logits) 기반 Multi-task 순서형 분류 손실 (현재 사용, v5).

    [핵심 아이디어]
    K개 클래스(등급)를 K-1개의 binary 임계값 문제로 분해한다.
    "이게 몇 등급인가?" → "1등급 이상인가? 2등급 이상인가? ... K-1등급 이상인가?"

    [binary label 변환]
    실제 등급이 4라면 (K=7):
    [1등급이상?, 2등급이상?, 3등급이상?, 4등급이상?, 5등급이상?, 6등급이상?]
    = [1,          1,          1,          1,          0,          0         ]
    → 이 binary 벡터로 BCE(Binary Cross-Entropy)를 계산

    [순서 보장 효과]
    크게 틀릴수록(4→0: 4번 틀림) 패널티가 크고,
    조금 틀리면(4→3: 1번 틀림) 패널티가 작다.
    → MAE가 CE 대비 0.98 → 0.62로 36% 개선

    [참고 논문]
    Cao et al., "Rank consistent ordinal regression for neural networks", 2020.

    Parameters
    ----------
    targets      : 타겟 이름 리스트
    task_weights : 타겟별 loss 가중치 (None=균등)
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
        preds  : {target_name: logits (batch, K-1)} — CORAL head 출력
        labels : (batch, 7) long tensor, -1=결측

        Returns
        -------
        total_loss : scalar tensor (역전파용)
        per_task   : {target_name: loss_value} (모니터링용)
        """
        total = torch.tensor(0.0, device=labels.device, requires_grad=True)
        per_task = {}

        for i, t in enumerate(self.targets):
            t_labels = labels[:, i]       # (batch,) — 이 속성의 라벨
            t_logits = preds[t]           # (batch, K-1) — CORAL head 출력
            n_thresh = t_logits.size(1)   # K-1 (임계값 개수)

            # 결측 라벨(-1) 제외: 라벨이 있는 샘플만 loss 계산
            valid = t_labels != -1
            if valid.sum() == 0:
                # 이 배치에서 이 속성 라벨이 전혀 없으면 loss 0으로 처리
                per_task[t] = 0.0
                continue

            lv = t_labels[valid]          # (유효샘플수,)
            lv_logits = t_logits[valid]   # (유효샘플수, K-1)

            # ─── binary label 행렬 생성 ────────────────────────────────
            # thresholds = [0, 1, 2, ..., K-2]
            # bin_labels[b][k] = 1 if label[b] > k else 0
            # 예) 등급 4, K-1=6: [1,1,1,1,0,0]
            thresholds = torch.arange(n_thresh, device=labels.device)
            bin_labels = (lv.unsqueeze(1) > thresholds.unsqueeze(0)).float()

            # Binary Cross-Entropy with logits
            # (sigmoid를 내부에서 처리해 수치 안정성 보장)
            loss = torch.nn.functional.binary_cross_entropy_with_logits(
                lv_logits, bin_labels
            )

            w = self.task_weights[t]
            if not torch.isnan(loss):
                total = total + w * loss
                per_task[t] = loss.item()
            else:
                per_task[t] = 0.0

        # 7개 속성 loss의 평균 반환
        return total / len(self.targets), per_task
