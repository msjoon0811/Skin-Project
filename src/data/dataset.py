"""
AI Hub 피부 데이터 PyTorch Dataset.

[Dataset 역할]
  PyTorch DataLoader가 학습 루프에서 이미지·라벨 쌍을 배치로 꺼낼 때 사용하는 클래스.
  __len__: 전체 샘플 수 반환
  __getitem__: 인덱스 하나 → (이미지 텐서, 라벨) 반환

[라벨 구조]
  모든 어노테이션은 전문의 5인이 평가한 0~N 정수 등급.
  속성마다 등급 범위가 다름 (주름 0~6, 모공 0~4 등).
  bbox = [x1, y1, x2, y2] 형식으로 AI Hub JSON에서 읽어온 얼굴 부위 좌표.
"""

from pathlib import Path
from typing import Optional

import pandas as pd
import torch
from PIL import Image
from torch.utils.data import Dataset

from src.data.aihub_loader import MULTITASK_TARGETS, ANNOTATION_MAX


# 베이스라인: 단일 타겟 (acne) → 4-class (0,1,2,3)
BASELINE_TARGET = "acne"
NUM_CLASSES_PER_TARGET = 4  # 0~3 등급


class SkinBaselineDataset(Dataset):
    """
    단일 속성 분류 베이스라인용 Dataset.

    [왜 베이스라인이 필요한가?]
    7개 속성을 한 번에 학습하기 전에 단일 속성으로 파이프라인이
    정상 동작하는지 먼저 검증한다. 문제가 생겼을 때 원인을 좁히기 위함.

    Parameters
    ----------
    df          : get_image_label_pairs() 또는 동일 형식의 DataFrame
                  필수 컬럼: img_path, bbox (optional), target_col
    target_col  : 학습 타겟 어노테이션 컬럼 이름 (default: 'acne')
    transform   : torchvision transforms (None이면 PIL 그대로 반환)
    use_crop    : True이면 bbox로 얼굴 부위 crop, False이면 전체 이미지
    """

    def __init__(
        self,
        df: pd.DataFrame,
        target_col: str = BASELINE_TARGET,
        transform=None,
        use_crop: bool = True,
        label_map: Optional[dict] = None,
    ):
        # 해당 타겟에 라벨이 있는 행만 남김 (NaN 제거)
        valid = df[df[target_col].notna()].copy()
        valid[target_col] = valid[target_col].astype(int)

        # label_map: 등급을 재매핑할 때 사용 (예: 7등급 → 3등급으로 합치기)
        if label_map is not None:
            valid[target_col] = valid[target_col].map(label_map)
            valid = valid[valid[target_col].notna()].copy()
            valid[target_col] = valid[target_col].astype(int)

        self.df = valid.reset_index(drop=True)
        self.target_col = target_col
        self.transform = transform
        self.use_crop = use_crop

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int):
        row = self.df.iloc[idx]

        # 이미지 로드: RGB로 통일 (PNG, JPEG 모두 3채널로 변환)
        img = Image.open(row["img_path"]).convert("RGB")

        # bbox 크롭: AI Hub JSON의 bbox = [x1, y1, x2, y2]
        # 얼굴 전체가 아닌 해당 부위만 잘라서 넘기면 모델이 집중할 수 있음
        if self.use_crop and row.get("bbox") is not None:
            bbox = row["bbox"]
            if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
                img = img.crop(bbox)  # [x1, y1, x2, y2]

        # transform: Resize, Normalize, Augmentation 등 적용
        if self.transform:
            img = self.transform(img)

        label = int(row[self.target_col])
        return img, label

    def get_labels(self) -> list:
        """전체 샘플의 라벨 리스트 반환 (WeightedRandomSampler 구성용)."""
        return self.df[self.target_col].tolist()

    def class_weights(self) -> torch.Tensor:
        """
        CrossEntropyLoss weight 인자용 클래스 가중치.

        [왜 필요한가?]
        grade 0~1이 전체의 65~70%를 차지하는 클래스 불균형 문제가 있다.
        가중치를 주면 희소 클래스(심각 등급)의 오분류 패널티를 키워서
        모델이 "다 0등급으로 예측"하는 나쁜 습관을 방지한다.

        공식: weight_i = N_total / (n_classes × N_i)
        → 샘플이 적은 클래스일수록 가중치가 높아짐
        """
        labels = self.df[self.target_col]
        num_classes = labels.max() + 1
        counts = labels.value_counts().sort_index()
        n_total = len(labels)
        weights = torch.zeros(num_classes)
        for cls in range(num_classes):
            cnt = counts.get(cls, 1)
            weights[cls] = n_total / (num_classes * cnt)
        return weights

    def sample_weights(self) -> torch.Tensor:
        """
        WeightedRandomSampler용 샘플별 가중치.

        [역할]
        DataLoader가 배치를 만들 때 희소 클래스 샘플을 더 자주 뽑도록 한다.
        클래스 불균형을 데이터 로딩 단계에서 해결하는 방법.
        """
        cw = self.class_weights()
        labels = self.get_labels()
        return torch.tensor([cw[l].item() for l in labels])


class SkinMultiTaskDataset(Dataset):
    """
    7개 속성 동시 학습용 Multi-task Dataset.

    [핵심 설계 포인트]
    JSON 1개 = 이미지 1장의 얼굴 1개 부위 정보.
    이마 JSON에는 이마 주름·색소침착만 있고 볼 모공은 없다.
    → 없는 속성은 -1로 표시하고 손실 계산에서 제외 (ignore_index=-1).
    → 모르는 걸 억지로 학습시키지 않는 것이 핵심.

    Parameters
    ----------
    df         : 이미지 경로와 타겟 컬럼들을 포함하는 DataFrame
    img_col    : 이미지 경로 컬럼 이름
    targets    : 사용할 타겟 컬럼 리스트 (default: MULTITASK_TARGETS)
    transform  : torchvision transforms
    use_crop   : bbox 기반 crop 사용 여부
    """

    def __init__(
        self,
        df: pd.DataFrame,
        img_col: str = "img_path",
        targets: Optional[list] = None,
        transform=None,
        use_crop: bool = True,
    ):
        self.df = df.reset_index(drop=True)
        self.img_col = img_col
        self.targets = targets or MULTITASK_TARGETS
        self.transform = transform
        self.use_crop = use_crop

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int):
        row = self.df.iloc[idx]

        # 이미지 로드 및 RGB 통일
        img = Image.open(row[self.img_col]).convert("RGB")

        # bbox 크롭 (AI Hub JSON의 부위별 bounding box)
        if self.use_crop and "bbox" in row and row["bbox"] is not None:
            bbox = row["bbox"]
            if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
                img = img.crop(bbox)

        if self.transform:
            img = self.transform(img)

        # ─── 라벨 텐서 구성 ─────────────────────────────────────────────
        # shape: (7,) — 7개 타겟 각각의 등급
        # 초기값 -1: "이 속성의 라벨이 없음"을 의미
        # 손실 함수에서 ignore_index=-1로 이 위치의 loss를 0으로 처리
        labels = torch.full((len(self.targets),), -1, dtype=torch.long)
        for i, t in enumerate(self.targets):
            val = row.get(t)
            # NaN, None, 범위 밖 값은 -1(결측)로 유지
            if val is not None and not (isinstance(val, float) and val != val):
                int_val = int(val)
                max_val = ANNOTATION_MAX.get(t, int_val)
                if 0 <= int_val <= max_val:
                    labels[i] = int_val

        return img, labels

    def valid_mask(self, idx: int) -> torch.BoolTensor:
        """
        idx번째 샘플에서 유효한(non-null) 타겟 마스크 반환.

        [활용]
        평가(eval) 시 어떤 속성의 라벨이 실제로 있는지 확인할 때 사용.
        -1 라벨 샘플을 accuracy 계산에서 제외하기 위해.
        """
        row = self.df.iloc[idx]
        mask = []
        for t in self.targets:
            val = row.get(t)
            is_valid = val is not None and not (isinstance(val, float) and val != val)
            mask.append(is_valid)
        return torch.tensor(mask, dtype=torch.bool)
