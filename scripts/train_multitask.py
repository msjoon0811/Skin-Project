"""
Multi-task CNN 학습 스크립트.
7개 피부 속성 동시 분류 (EfficientNet-B0 + 속성별 독립 head).

사용법 (프로젝트 루트에서):
    python scripts/train_multitask.py
    python scripts/train_multitask.py --sanity
"""

import sys
import argparse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import torch
import torch.optim as optim
import pandas as pd
from torch.utils.data import DataLoader, random_split
from torchvision import transforms

from src.data.aihub_loader import (
    build_label_dataframe,
    get_image_label_pairs,
    MULTITASK_TARGETS,
    ANNOTATION_MAX,
)
from src.data.dataset import SkinMultiTaskDataset
from src.models.cnn import MultiTaskSkinModel
from src.train.losses import MultiTaskLoss
from src.train.train import train_multitask

# ─── 경로 설정 ───────────────────────────────────────────────
DATA_ROOT    = Path("028.한국인 피부상태 측정 데이터/3.개방데이터/1.데이터")
TL_LABEL_DIR = DATA_ROOT / "Training/02.라벨링데이터/extracted"
VL_LABEL_DIR = DATA_ROOT / "Validation/02.라벨링데이터/extracted"
TL_IMG_DIR   = DATA_ROOT / "Training/01.원천데이터/extracted"
VL_IMG_DIR   = DATA_ROOT / "Validation/01.원천데이터/extracted"
SAVE_DIR     = "checkpoints"

# ─── 하이퍼파라미터 ──────────────────────────────────────────
ANGLES       = [0, 1, 2]
IMG_SIZE     = 224
BATCH_SIZE   = 32
EPOCHS       = 20
LR           = 1e-4
WEIGHT_DECAY = 1e-4
DEVICE       = "cuda" if torch.cuda.is_available() else "cpu"

# 타겟별 facepart 매핑
FACEPART_TARGETS = {
    1: ["forehead_wrinkle", "forehead_pigmentation"],
    3: ["l_perocular_wrinkle"],
    5: ["l_cheek_pore", "l_cheek_pigmentation"],
    7: ["lip_dryness"],
    8: ["chin_sagging"],
}


def get_transforms(train: bool):
    if train:
        return transforms.Compose([
            transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
            transforms.RandomCrop(IMG_SIZE),
            transforms.RandomHorizontalFlip(),
            # 밝기/대비 강화: 다양한 조명 조건 (스마트폰 셀카 등)
            transforms.ColorJitter(brightness=0.35, contrast=0.35,
                                   saturation=0.2, hue=0.05),
            transforms.RandomRotation(15),
            # 약한 원근 왜곡: 다양한 촬영 각도 대응
            transforms.RandomPerspective(distortion_scale=0.15, p=0.3),
            # 약한 블러: 카메라 초점 차이 대응
            transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 1.5)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406],
                                  [0.229, 0.224, 0.225]),
        ])
    else:
        return transforms.Compose([
            transforms.Resize((IMG_SIZE, IMG_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406],
                                  [0.229, 0.224, 0.225]),
        ])


def build_multitask_dataframe(label_dir: Path, img_dir: Path) -> pd.DataFrame:
    """facepart별 이미지-라벨 쌍을 하나의 DataFrame으로 합산."""
    df = build_label_dataframe(label_dir, show_progress=False)

    base_cols = ["img_path", "bbox", "subject_id"]
    all_frames = []

    for fp in FACEPART_TARGETS:
        pairs = get_image_label_pairs(df, img_dir, target_facepart=fp, angle=ANGLES)
        pairs = pairs[pairs["img_exists"]].copy()

        # 이 facepart에 없는 타겟 컬럼은 NaN으로 채움 → Dataset에서 -1 처리
        for t in MULTITASK_TARGETS:
            if t not in pairs.columns:
                pairs[t] = None

        all_frames.append(pairs[base_cols + MULTITASK_TARGETS])

    combined = pd.concat(all_frames, ignore_index=True)
    print(f"  전체 유효 이미지: {len(combined):,}개")
    return combined


def compute_class_weights(dataset: SkinMultiTaskDataset, device: str) -> dict:
    """훈련 데이터 클래스 분포의 역수로 속성별 CE loss weight 계산.

    희귀 클래스(높은 심각도)의 가중치를 높여 예측 붕괴(collapse) 방지.
    weight[c] = n_total / (n_classes × count[c]), 범위 [0.2, 8.0] 클리핑.
    """
    weights = {}
    df = dataset.df
    for t in dataset.targets:
        col = df[t]
        valid = col.dropna()
        valid = valid[valid.apply(lambda x: x is not None and str(x) != "None")]
        try:
            valid = valid.astype(float).astype(int)
        except (ValueError, TypeError):
            continue
        valid = valid[valid >= 0]
        if len(valid) == 0:
            continue

        n_classes = ANNOTATION_MAX[t] + 1
        n_total   = len(valid)
        counts    = valid.value_counts().to_dict()

        w = torch.ones(n_classes)
        for c in range(n_classes):
            cnt  = counts.get(c, 1)
            w[c] = n_total / (n_classes * max(cnt, 1))
        w = torch.clamp(w, min=0.2, max=8.0)
        weights[t] = w.to(device)

        dist = {c: counts.get(c, 0) for c in range(n_classes)}
        wfmt = [f"{w[c]:.2f}" for c in range(n_classes)]
        print(f"  {t}: 분포={dist}  weight={wfmt}")

    return weights


def build_dataset(label_dir: Path, img_dir: Path, train: bool) -> SkinMultiTaskDataset:
    print(f"  라벨 파싱: {label_dir}")
    combined = build_multitask_dataframe(label_dir, img_dir)
    return SkinMultiTaskDataset(
        combined,
        targets=MULTITASK_TARGETS,
        transform=get_transforms(train),
        use_crop=True,
    )


def main(sanity_check: bool = False):
    print(f"Device: {DEVICE}")
    print(f"Targets ({len(MULTITASK_TARGETS)}개): {MULTITASK_TARGETS}\n")

    if sanity_check or not TL_IMG_DIR.exists():
        print("★ Sanity-check 모드: Validation 데이터로 80/20 분할")
        full_ds = build_dataset(VL_LABEL_DIR, VL_IMG_DIR, train=True)
        n_train = int(len(full_ds) * 0.8)
        n_val   = len(full_ds) - n_train
        train_ds, val_ds = random_split(
            full_ds, [n_train, n_val],
            generator=torch.Generator().manual_seed(42)
        )
        val_ds.dataset.transform = get_transforms(train=False)
    else:
        print("정식 학습 모드: Training + Validation 분리")
        train_ds = build_dataset(TL_LABEL_DIR, TL_IMG_DIR, train=True)
        val_ds   = build_dataset(VL_LABEL_DIR, VL_IMG_DIR, train=False)

    print(f"\nTrain: {len(train_ds):,}, Val: {len(val_ds):,}\n")

    train_loader = DataLoader(
        train_ds, batch_size=BATCH_SIZE, shuffle=True,
        num_workers=0, pin_memory=(DEVICE == "cuda")
    )
    val_loader = DataLoader(
        val_ds, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=0, pin_memory=(DEVICE == "cuda")
    )

    print("\n클래스 가중치 계산 중...")
    class_weights = compute_class_weights(train_ds if not sanity_check else train_ds.dataset, DEVICE)

    model     = MultiTaskSkinModel(targets=MULTITASK_TARGETS).to(DEVICE)
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS, eta_min=1e-6)
    criterion = MultiTaskLoss(targets=MULTITASK_TARGETS, class_weights=class_weights)

    history, best_acc = train_multitask(
        model, train_loader, val_loader,
        optimizer, criterion,
        targets=MULTITASK_TARGETS,
        scheduler=scheduler,
        epochs=EPOCHS,
        device=DEVICE,
        save_dir=SAVE_DIR,
    )

    print(f"\n완료: best_mean_acc={best_acc:.4f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--sanity", action="store_true")
    args = parser.parse_args()
    main(sanity_check=args.sanity)
