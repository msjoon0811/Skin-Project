"""
v5 학습 스크립트: EfficientNet-B0 + CORAL ordinal loss.

v2(B0+CE) 대비 손실 함수만 CORAL로 교체 — 단일 변수 ablation.
- B3 대신 B0 유지: v3/v4의 과적합 원인(모델 과대) 제거
- CORAL loss: 순서형 등급 구조(0<1<2<...) 학습에 반영
- Dropout 0.4 + RandomErasing: 정규화 강화

사용법:
    python scripts/train_multitask_v5.py
"""

import sys
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
from src.models.cnn import MultiTaskSkinModelCORAL
from src.train.losses import CoralMultiTaskLoss
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
WEIGHT_DECAY = 2e-4          # v4(1e-4)보다 강한 정규화
DROPOUT      = 0.4           # v4(0.3)보다 강한 드롭아웃
BACKBONE     = "efficientnet_b0"   # v3/v4의 b3 → b0 (과적합 방지)
DEVICE       = "cuda" if torch.cuda.is_available() else "cpu"

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
            transforms.ColorJitter(brightness=0.35, contrast=0.35,
                                   saturation=0.2, hue=0.05),
            transforms.RandomRotation(15),
            transforms.RandomPerspective(distortion_scale=0.15, p=0.3),
            transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 1.5)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406],
                                  [0.229, 0.224, 0.225]),
            transforms.RandomErasing(p=0.2, scale=(0.02, 0.1)),  # v4 대비 추가
        ])
    else:
        return transforms.Compose([
            transforms.Resize((IMG_SIZE, IMG_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406],
                                  [0.229, 0.224, 0.225]),
        ])


def build_multitask_dataframe(label_dir: Path, img_dir: Path) -> pd.DataFrame:
    df = build_label_dataframe(label_dir, show_progress=False)
    base_cols = ["img_path", "bbox", "subject_id"]
    all_frames = []
    for fp in FACEPART_TARGETS:
        pairs = get_image_label_pairs(df, img_dir, target_facepart=fp, angle=ANGLES)
        pairs = pairs[pairs["img_exists"]].copy()
        for t in MULTITASK_TARGETS:
            if t not in pairs.columns:
                pairs[t] = None
        all_frames.append(pairs[base_cols + MULTITASK_TARGETS])
    combined = pd.concat(all_frames, ignore_index=True)
    print(f"  전체 유효 이미지: {len(combined):,}개")
    return combined


def build_dataset(label_dir: Path, img_dir: Path, train: bool) -> SkinMultiTaskDataset:
    print(f"  라벨 파싱: {label_dir}")
    combined = build_multitask_dataframe(label_dir, img_dir)
    return SkinMultiTaskDataset(
        combined,
        targets=MULTITASK_TARGETS,
        transform=get_transforms(train),
        use_crop=True,
    )


def main():
    print(f"[v5] Device: {DEVICE}, Backbone: {BACKBONE}, Loss: CORAL")
    print(f"     Dropout: {DROPOUT}, WeightDecay: {WEIGHT_DECAY}")
    print(f"Targets ({len(MULTITASK_TARGETS)}개): {MULTITASK_TARGETS}\n")

    if not TL_IMG_DIR.exists():
        print("★ Sanity-check 모드 (Training 데이터 없음)")
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

    model     = MultiTaskSkinModelCORAL(
        backbone_name=BACKBONE,
        targets=MULTITASK_TARGETS,
        dropout=DROPOUT,
    ).to(DEVICE)
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS, eta_min=1e-6)
    criterion = CoralMultiTaskLoss(targets=MULTITASK_TARGETS)

    history, best_acc = train_multitask(
        model, train_loader, val_loader,
        optimizer, criterion,
        targets=MULTITASK_TARGETS,
        scheduler=scheduler,
        epochs=EPOCHS,
        device=DEVICE,
        save_dir=SAVE_DIR,
        save_name="multitask_v5_best",
        coral_mode=True,
    )

    import json
    history_path = Path(SAVE_DIR) / "history_v5.json"
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump({"version": "v5", "best_acc": best_acc, "history": history}, f, indent=2)
    print(f"     history 저장: {history_path}")

    print(f"\n[v5] 완료: best_mean_acc={best_acc:.4f}")
    print(f"     비교: v2(B0+CE)=0.5170, v5(B0+CORAL)={best_acc:.4f}")


if __name__ == "__main__":
    main()
