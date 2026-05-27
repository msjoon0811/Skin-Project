"""
베이스라인 CNN 학습 스크립트.

사용법 (프로젝트 루트에서):
    python scripts/train_baseline.py
    python scripts/train_baseline.py --sanity   # Validation만으로 파이프라인 검증
"""

import sys
import argparse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import torch
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from torchvision import transforms

from src.data.aihub_loader import (
    build_label_dataframe,
    get_image_label_pairs,
    BASELINE_TARGET,
    ANNOTATION_MAX,
    WRINKLE_3CLASS_MAP,
    WRINKLE_3CLASS_NAMES,
)
from src.data.dataset import SkinBaselineDataset
from src.models.cnn import build_baseline_model
from src.train.losses import BaselineCrossEntropyLoss
from src.train.train import train_baseline

# ─── 경로 설정 ───────────────────────────────────────────────
DATA_ROOT = Path("028.한국인 피부상태 측정 데이터/3.개방데이터/1.데이터")

TL_LABEL_DIR = DATA_ROOT / "Training/02.라벨링데이터/extracted"
VL_LABEL_DIR = DATA_ROOT / "Validation/02.라벨링데이터/extracted"
TL_IMG_DIR   = DATA_ROOT / "Training/01.원천데이터/extracted"
VL_IMG_DIR   = DATA_ROOT / "Validation/01.원천데이터/extracted"

SAVE_DIR = "checkpoints"

# ─── 하이퍼파라미터 ──────────────────────────────────────────
FACEPART     = 1
ANGLES       = [0, 1, 2]             # F / Fb / Ft 3각도 사용 (데이터 3배)
TARGET_COL   = BASELINE_TARGET       # "forehead_wrinkle"
LABEL_MAP    = WRINKLE_3CLASS_MAP    # 7-class → 3-class
NUM_CLASSES  = 3                     # 낮음 / 중간 / 높음
IMG_SIZE     = 224
BATCH_SIZE   = 16
EPOCHS       = 30
LR           = 1e-4
WEIGHT_DECAY = 1e-4
DEVICE       = "cuda" if torch.cuda.is_available() else "cpu"


def get_transforms(train: bool):
    if train:
        return transforms.Compose([
            transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
            transforms.RandomCrop(IMG_SIZE),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1),
            transforms.RandomRotation(10),
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


def build_dataset(label_dir: Path, img_dir: Path, train: bool):
    print(f"  라벨 파싱: {label_dir}")
    df = build_label_dataframe(label_dir, show_progress=False)
    pairs = get_image_label_pairs(df, img_dir, target_facepart=FACEPART, angle=ANGLES)
    pairs = pairs[pairs["img_exists"]].copy()
    print(f"  유효 샘플: {len(pairs)}")
    return SkinBaselineDataset(
        pairs,
        target_col=TARGET_COL,
        transform=get_transforms(train),
        use_crop=True,
        label_map=LABEL_MAP,
    )


def main(sanity_check: bool = False):
    print(f"Device: {DEVICE}")
    print(f"Target: {TARGET_COL} → {NUM_CLASSES}-class {WRINKLE_3CLASS_NAMES}")
    print(f"Angles: {ANGLES} (데이터 {len(ANGLES)}배)\n")

    if sanity_check or not TL_IMG_DIR.exists():
        print("★ Sanity-check 모드: Validation 이미지로 80/20 분할")
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

    print(f"\nTrain: {len(train_ds)}, Val: {len(val_ds)}")
    print(f"Random baseline (uniform): {1/NUM_CLASSES:.4f}\n")

    train_loader = DataLoader(
        train_ds, batch_size=BATCH_SIZE, shuffle=True,
        num_workers=0, pin_memory=(DEVICE == "cuda")
    )
    val_loader = DataLoader(
        val_ds, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=0, pin_memory=(DEVICE == "cuda")
    )

    model     = build_baseline_model(num_classes=NUM_CLASSES).to(DEVICE)
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS, eta_min=1e-6)
    criterion = BaselineCrossEntropyLoss(label_smoothing=0.1)

    history, best_acc = train_baseline(
        model, train_loader, val_loader,
        optimizer, criterion, scheduler,
        epochs=EPOCHS,
        device=DEVICE,
        save_dir=SAVE_DIR,
        target_name=TARGET_COL,
    )

    print(f"\n완료: best_val_acc={best_acc:.4f} (random={1/NUM_CLASSES:.4f})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--sanity", action="store_true")
    args = parser.parse_args()
    main(sanity_check=args.sanity)
