"""
AI Hub 피부 데이터 PyTorch Dataset.

모든 어노테이션은 0~3 정수 등급 (전문의 평가).
bbox = [x1, y1, x2, y2] 형식으로 얼굴 부위 crop에 사용.
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
        valid = df[df[target_col].notna()].copy()
        valid[target_col] = valid[target_col].astype(int)
        # 라벨 매핑 적용 (예: 7-class → 3-class)
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
        img = Image.open(row["img_path"]).convert("RGB")

        if self.use_crop and row.get("bbox") is not None:
            bbox = row["bbox"]
            if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
                img = img.crop(bbox)  # [x1, y1, x2, y2]

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
        가중치 = 전체샘플수 / (클래스수 × 해당클래스샘플수)  ← sklearn 방식
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
        """WeightedRandomSampler용 샘플별 가중치."""
        cw = self.class_weights()
        labels = self.get_labels()
        return torch.tensor([cw[l].item() for l in labels])


class SkinMultiTaskDataset(Dataset):
    """
    7개 속성 동시 학습용 Multi-task Dataset.

    모든 타겟이 0~3 분류이므로 CrossEntropy 7개 합산 loss 사용.
    결측 타겟은 -1로 마스킹 → loss 계산 시 ignore_index=-1 사용.

    Parameters
    ----------
    df         : subject_label_table (make_subject_label_table() 결과)
                 또는 image_label_pairs와 타겟 컬럼 포함 DataFrame
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
        img = Image.open(row[self.img_col]).convert("RGB")

        if self.use_crop and "bbox" in row and row["bbox"] is not None:
            bbox = row["bbox"]
            if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
                img = img.crop(bbox)

        if self.transform:
            img = self.transform(img)

        # 결측 타겟 → -1 (loss에서 ignore_index=-1로 무시)
        labels = torch.full((len(self.targets),), -1, dtype=torch.long)
        for i, t in enumerate(self.targets):
            val = row.get(t)
            if val is not None and not (isinstance(val, float) and val != val):
                int_val = int(val)
                max_val = ANNOTATION_MAX.get(t, int_val)
                if 0 <= int_val <= max_val:
                    labels[i] = int_val

        return img, labels

    def valid_mask(self, idx: int) -> torch.BoolTensor:
        """idx번째 샘플에서 유효한(non-null) 타겟 마스크 반환."""
        row = self.df.iloc[idx]
        mask = []
        for t in self.targets:
            val = row.get(t)
            is_valid = val is not None and not (isinstance(val, float) and val != val)
            mask.append(is_valid)
        return torch.tensor(mask, dtype=torch.bool)
