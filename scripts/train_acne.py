"""
여드름 심각도 분류 모델 학습 스크립트.

EfficientNet-B0 전이학습 + 4-class 분류
  0: 없음 (acne=null)
  1: 경증 (1~5개 병변)
  2: 중간 (6~15개 또는 cyst/pustule 있음)
  3: 심함 (16개 이상 또는 다발성 cyst)

클래스 불균형: WeightedRandomSampler + 클래스 가중치 CE Loss

사용법:
    python scripts/train_acne.py
"""

import sys
import json
import glob
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torchvision import transforms
import timm
from PIL import Image
import numpy as np
from collections import Counter

# ─── 경로 설정 ───────────────────────────────────────────────
DATA_ROOT    = Path("028.한국인 피부상태 측정 데이터/3.개방데이터/1.데이터")
TL_LABEL_DIR = DATA_ROOT / "Training/02.라벨링데이터/extracted"
VL_LABEL_DIR = DATA_ROOT / "Validation/02.라벨링데이터/extracted"
TL_IMG_DIR   = DATA_ROOT / "Training/01.원천데이터/extracted"
VL_IMG_DIR   = DATA_ROOT / "Validation/01.원천데이터/extracted"
SAVE_DIR     = Path("checkpoints")

# ─── 하이퍼파라미터 ──────────────────────────────────────────
IMG_SIZE   = 224
BATCH_SIZE = 32
EPOCHS     = 20
LR         = 1e-4
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"
NUM_CLASSES = 4


# ─── 심각도 변환 ─────────────────────────────────────────────
def acne_to_class(acne_ann) -> int:
    """JSON acne 어노테이션 → 심각도 클래스 (0~3)."""
    if acne_ann is None:
        return 0
    n = len(acne_ann)
    if n == 0:
        return 0
    types = {a.get("name", "") for a in acne_ann}
    has_severe = bool(types & {"cyst", "pustule"})
    if n >= 16 or (has_severe and n >= 8):
        return 3
    if n >= 6 or has_severe:
        return 2
    return 1


# ─── 데이터셋 ────────────────────────────────────────────────
class AcneDataset(Dataset):
    def __init__(self, label_dir: Path, img_dir: Path, transform=None, angle: str = "F"):
        self.transform = transform
        self.samples = []  # (img_path, class)

        # 정면(F) acne JSON만 파싱
        pattern = str(label_dir / "**" / f"*_{angle}_00.json")
        json_files = glob.glob(pattern, recursive=True)

        # 이미지 인덱스 한 번만 구축 (filename → path)
        print(f"  이미지 인덱스 구축 중...")
        img_index = {p.name: str(p) for p in img_dir.rglob("*.jpg")}
        print(f"  이미지 인덱스: {len(img_index)}개")

        missing = 0
        for jf in json_files:
            try:
                d = json.loads(Path(jf).read_text(encoding="utf-8"))
                filename = d["info"]["filename"]
                acne_ann = d["annotations"].get("acne")
                label    = acne_to_class(acne_ann)

                if filename not in img_index:
                    missing += 1
                    continue
                self.samples.append((img_index[filename], label))
            except Exception:
                continue

        print(f"  {angle}뷰: {len(self.samples)}개 ({missing}개 이미지 없음)")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        img = Image.open(img_path).convert("RGB")
        if self.transform:
            img = self.transform(img)
        return img, label


def get_transforms(train: bool):
    if train:
        return transforms.Compose([
            transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
            transforms.RandomCrop(IMG_SIZE),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.05),
            transforms.RandomRotation(15),
            transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 1.5)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            transforms.RandomErasing(p=0.15, scale=(0.02, 0.08)),
        ])
    else:
        return transforms.Compose([
            transforms.Resize((IMG_SIZE, IMG_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])


# ─── 모델 ────────────────────────────────────────────────────
def build_acne_model():
    model = timm.create_model(
        "efficientnet_b0",
        pretrained=True,
        num_classes=NUM_CLASSES,
        drop_rate=0.4,
    )
    return model


# ─── 학습 루프 ───────────────────────────────────────────────
def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss, correct, total = 0.0, 0, 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(device), labels.to(device)
        optimizer.zero_grad()
        logits = model(imgs)
        loss   = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * len(imgs)
        correct    += (logits.argmax(1) == labels).sum().item()
        total      += len(imgs)
    return total_loss / total, correct / total


@torch.no_grad()
def eval_epoch(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    class_correct = Counter()
    class_total   = Counter()
    for imgs, labels in loader:
        imgs, labels = imgs.to(device), labels.to(device)
        logits = model(imgs)
        loss   = criterion(logits, labels)
        preds  = logits.argmax(1)
        total_loss += loss.item() * len(imgs)
        correct    += (preds == labels).sum().item()
        total      += len(imgs)
        for p, l in zip(preds.cpu(), labels.cpu()):
            class_total[l.item()]   += 1
            class_correct[l.item()] += int(p == l)
    per_class = {c: class_correct[c] / class_total[c] if class_total[c] else 0
                 for c in range(NUM_CLASSES)}
    return total_loss / total, correct / total, per_class


# ─── 메인 ────────────────────────────────────────────────────
def main():
    print(f"[Acne] Device: {DEVICE}")
    SAVE_DIR.mkdir(exist_ok=True)

    print("\n[데이터 로딩]")
    train_ds = AcneDataset(TL_LABEL_DIR, TL_IMG_DIR, get_transforms(True))
    val_ds   = AcneDataset(VL_LABEL_DIR, VL_IMG_DIR, get_transforms(False))

    # 클래스 분포 출력
    labels_all = [s[1] for s in train_ds.samples]
    dist = Counter(labels_all)
    names = ["없음", "경증", "중간", "심함"]
    print("\n  Train 클래스 분포:")
    for c, name in enumerate(names):
        print(f"    {c}({name}): {dist[c]}개 ({dist[c]/len(labels_all)*100:.1f}%)")

    # WeightedRandomSampler — 소수 클래스 오버샘플링
    class_counts = [dist[c] for c in range(NUM_CLASSES)]
    class_weights = [1.0 / max(cnt, 1) for cnt in class_counts]
    sample_weights = [class_weights[l] for l in labels_all]
    sampler = WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler, num_workers=0)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,   num_workers=0)

    # 클래스 가중치 CE Loss
    ce_weights = torch.tensor(class_weights, dtype=torch.float32).to(DEVICE)
    criterion  = nn.CrossEntropyLoss(weight=ce_weights)

    model     = build_acne_model().to(DEVICE)
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=2e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS, eta_min=1e-6)

    print(f"\n[학습 시작] Train={len(train_ds)}, Val={len(val_ds)}, Epochs={EPOCHS}")
    best_acc  = 0.0
    best_path = SAVE_DIR / "acne_best.pth"

    for epoch in range(1, EPOCHS + 1):
        tr_loss, tr_acc       = train_epoch(model, train_loader, optimizer, criterion, DEVICE)
        vl_loss, vl_acc, pca  = eval_epoch(model, val_loader, criterion, DEVICE)
        scheduler.step()

        improved = ""
        if vl_acc > best_acc:
            best_acc = vl_acc
            torch.save(model.state_dict(), best_path)
            improved = " ★ BEST"

        print(f"Epoch {epoch:02d}/{EPOCHS}  "
              f"tr_loss={tr_loss:.4f} tr_acc={tr_acc:.4f}  "
              f"vl_loss={vl_loss:.4f} vl_acc={vl_acc:.4f}{improved}")
        print(f"  per-class: " + " | ".join(
            f"{names[c]} {pca[c]:.3f}" for c in range(NUM_CLASSES)))

    print(f"\n[완료] best_val_acc={best_acc:.4f} → {best_path}")


if __name__ == "__main__":
    main()
