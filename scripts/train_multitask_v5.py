"""
v5 학습 스크립트: EfficientNet-B0 + CORAL ordinal loss.

[v5가 최종 버전인 이유 — 이전 버전과 비교]
  v2 (B0 + CE)     : val_acc 51.70%, MAE 0.98  → 기준선
  v3 (B3 + CE)     : 과적합 → 폐기 (B3=43MB, 데이터=11K로 모델이 너무 큼)
  v4 (B3 + CORAL)  : 과적합 → 폐기 (backbone 문제는 loss 교체로 해결 안 됨)
  v5 (B0 + CORAL)  : val_acc 51.70%+, MAE 0.62 → 현재 사용

[단일 변수 Ablation 관점]
  v2 → v5: CE → CORAL 교체 (backbone은 동일하게 B0 유지)
  → CORAL의 효과만 격리해서 확인 가능
  → MAE 0.98 → 0.62 (36% 개선) = CORAL의 순수 기여

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

# ─── 경로 설정 ────────────────────────────────────────────────────────────
# AI Hub 데이터 구조: Training(학습) / Validation(검증)을 분리해서 제공
# 01.원천데이터 = 이미지 / 02.라벨링데이터 = JSON 어노테이션
DATA_ROOT    = Path("028.한국인 피부상태 측정 데이터/3.개방데이터/1.데이터")
TL_LABEL_DIR = DATA_ROOT / "Training/02.라벨링데이터/extracted"
VL_LABEL_DIR = DATA_ROOT / "Validation/02.라벨링데이터/extracted"
TL_IMG_DIR   = DATA_ROOT / "Training/01.원천데이터/extracted"
VL_IMG_DIR   = DATA_ROOT / "Validation/01.원천데이터/extracted"
SAVE_DIR     = "checkpoints"   # 최고 성능 모델 저장 위치

# ─── 하이퍼파라미터 ───────────────────────────────────────────────────────
ANGLES       = [0, 1, 2]    # 사용할 촬영 각도 (0=정면 포함)
IMG_SIZE     = 224           # EfficientNet 표준 입력 크기
BATCH_SIZE   = 32            # GPU 메모리에 맞게 설정
EPOCHS       = 20            # 학습 반복 횟수
LR           = 1e-4          # AdamW 학습률 (너무 크면 발산, 너무 작으면 느림)
WEIGHT_DECAY = 2e-4          # L2 정규화 강도. v4(1e-4)보다 2배 강하게 → 과적합 방지
DROPOUT      = 0.4           # Dropout 비율. v4(0.3)보다 높게 → 과적합 방지
BACKBONE     = "efficientnet_b0"  # B0(16MB) 선택 이유: B3(43MB)은 11K 데이터에 과적합
DEVICE       = "cuda" if torch.cuda.is_available() else "cpu"

# 얼굴 부위 코드 → 타겟 속성 매핑
# AI Hub facepart 코드: 1=이마, 3=눈가, 5=볼, 7=입술, 8=턱
FACEPART_TARGETS = {
    1: ["forehead_wrinkle", "forehead_pigmentation"],
    3: ["l_perocular_wrinkle"],
    5: ["l_cheek_pore", "l_cheek_pigmentation"],
    7: ["lip_dryness"],
    8: ["chin_sagging"],
}


def get_transforms(train: bool):
    """
    학습/검증용 이미지 전처리 파이프라인.

    [학습(train=True) - 증강 적용]
    같은 사진을 매 epoch마다 조금씩 다르게 변형해서 데이터를 늘리는 효과.
    조명·각도가 다양한 셀카에도 일반화되도록 모델을 강건하게 만든다.

    [검증(train=False) - 증강 없음]
    검증은 모델이 실제로 얼마나 잘 하는지를 측정하는 용도.
    변형을 주면 측정이 부정확해지므로 원본 그대로 사용.

    [Normalize 값의 의미]
    [0.485, 0.456, 0.406]: ImageNet 전체 데이터의 RGB 채널별 평균
    [0.229, 0.224, 0.225]: ImageNet 전체 데이터의 RGB 채널별 표준편차
    EfficientNet이 ImageNet으로 사전학습됐으므로 같은 통계를 맞춰야 한다.
    """
    if train:
        return transforms.Compose([
            transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),  # 조금 크게 리사이즈
            transforms.RandomCrop(IMG_SIZE),                    # 랜덤 위치에서 224 크롭 → 위치 변화 학습
            transforms.RandomHorizontalFlip(),                  # 좌우 반전 (이마·입술 대칭 속성에만 적용)
            transforms.ColorJitter(                             # 밝기·대비·채도·색조 랜덤 변화
                brightness=0.35, contrast=0.35,
                saturation=0.2, hue=0.05),
            transforms.RandomRotation(15),                      # ±15도 회전 → 기울어진 셀카 대응
            transforms.RandomPerspective(distortion_scale=0.15, p=0.3),  # 원근감 변화 → 각도 변화 대응
            transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 1.5)),   # 약한 블러 → 해상도 차이 대응
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406],
                                  [0.229, 0.224, 0.225]),
            transforms.RandomErasing(p=0.2, scale=(0.02, 0.1)),  # v5 추가: 작은 영역 지우기 → 부분 가림 대응
        ])
    else:
        # 검증·추론: 증강 없이 일관된 전처리만
        return transforms.Compose([
            transforms.Resize((IMG_SIZE, IMG_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406],
                                  [0.229, 0.224, 0.225]),
        ])


def build_multitask_dataframe(label_dir: Path, img_dir: Path) -> pd.DataFrame:
    """
    라벨 디렉토리에서 이미지-라벨 쌍을 만들어 DataFrame으로 반환.

    [처리 흐름]
    1. 모든 JSON 파싱 → DataFrame (라벨 정보)
    2. 얼굴 부위(facepart)별로 이미지-라벨 매칭
    3. 5개 부위 데이터를 하나로 합치기 (concat)
    4. 없는 속성은 None → Dataset에서 -1로 처리

    [왜 부위별로 나눠서 처리하나?]
    JSON 1개는 1개 부위만 커버하므로, 같은 이미지라도 부위마다 별도 행이 된다.
    이마 JSON → 이마 속성만 있고 볼 속성은 None
    볼 JSON → 볼 속성만 있고 이마 속성은 None
    """
    df = build_label_dataframe(label_dir, show_progress=False)
    base_cols = ["img_path", "bbox", "subject_id"]
    all_frames = []

    for fp in FACEPART_TARGETS:
        # 해당 facepart 코드의 이미지-라벨 쌍 추출
        pairs = get_image_label_pairs(df, img_dir, target_facepart=fp, angle=ANGLES)
        # 이미지 파일이 실제로 존재하는 행만 사용
        pairs = pairs[pairs["img_exists"]].copy()
        # 이 부위에 없는 속성 컬럼은 None으로 채우기
        for t in MULTITASK_TARGETS:
            if t not in pairs.columns:
                pairs[t] = None
        all_frames.append(pairs[base_cols + MULTITASK_TARGETS])

    # 5개 부위 데이터를 세로로 합치기
    combined = pd.concat(all_frames, ignore_index=True)
    print(f"  전체 유효 이미지: {len(combined):,}개")
    return combined


def build_dataset(label_dir: Path, img_dir: Path, train: bool) -> SkinMultiTaskDataset:
    """DataFrame → PyTorch Dataset 변환."""
    print(f"  라벨 파싱: {label_dir}")
    combined = build_multitask_dataframe(label_dir, img_dir)
    return SkinMultiTaskDataset(
        combined,
        targets=MULTITASK_TARGETS,
        transform=get_transforms(train),
        use_crop=True,   # AI Hub bbox 좌표로 부위 크롭 적용
    )


def main():
    print(f"[v5] Device: {DEVICE}, Backbone: {BACKBONE}, Loss: CORAL")
    print(f"     Dropout: {DROPOUT}, WeightDecay: {WEIGHT_DECAY}")
    print(f"Targets ({len(MULTITASK_TARGETS)}개): {MULTITASK_TARGETS}\n")

    # ─── 데이터셋 구성 ─────────────────────────────────────────────────────
    if not TL_IMG_DIR.exists():
        # Sanity-check 모드: Training 이미지 없을 때 Validation만으로 파이프라인 검증
        # Validation 데이터를 8:2로 나눠 임시 Train/Val로 사용
        print("★ Sanity-check 모드 (Training 데이터 없음)")
        full_ds = build_dataset(VL_LABEL_DIR, VL_IMG_DIR, train=True)
        n_train = int(len(full_ds) * 0.8)
        n_val   = len(full_ds) - n_train
        train_ds, val_ds = random_split(
            full_ds, [n_train, n_val],
            generator=torch.Generator().manual_seed(42)  # 재현성 보장
        )
        # val_ds는 augmentation 없이 (검증용 transform으로 교체)
        val_ds.dataset.transform = get_transforms(train=False)
    else:
        # 정식 모드: AI Hub 공식 Train/Validation 분리 사용
        # person-level split이 이미 되어 있어 데이터 누수 없음
        print("정식 학습 모드: Training + Validation 분리")
        train_ds = build_dataset(TL_LABEL_DIR, TL_IMG_DIR, train=True)
        val_ds   = build_dataset(VL_LABEL_DIR, VL_IMG_DIR, train=False)

    print(f"\nTrain: {len(train_ds):,}, Val: {len(val_ds):,}\n")

    # ─── DataLoader 설정 ───────────────────────────────────────────────────
    # shuffle=True: 학습 시 매 epoch마다 순서 섞기 (편향 방지)
    # shuffle=False: 검증은 항상 같은 순서로 (재현성)
    # pin_memory=True: GPU 사용 시 데이터 전송 속도 향상
    train_loader = DataLoader(
        train_ds, batch_size=BATCH_SIZE, shuffle=True,
        num_workers=0, pin_memory=(DEVICE == "cuda")
    )
    val_loader = DataLoader(
        val_ds, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=0, pin_memory=(DEVICE == "cuda")
    )

    # ─── 모델 / 옵티마이저 / 스케줄러 / 손실함수 ───────────────────────────
    model = MultiTaskSkinModelCORAL(
        backbone_name=BACKBONE,
        targets=MULTITASK_TARGETS,
        dropout=DROPOUT,
    ).to(DEVICE)

    # AdamW: Adam + Weight Decay 분리 (L2 정규화를 파라미터 업데이트에서 분리해 더 안정적)
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)

    # CosineAnnealingLR: 학습률을 코사인 곡선으로 서서히 감소
    # StepLR(이전)보다 부드럽게 감소해 sharp local minimum에 빠지지 않음
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS, eta_min=1e-6)

    # CORAL 손실함수 (7속성 순서형 회귀)
    criterion = CoralMultiTaskLoss(targets=MULTITASK_TARGETS)

    # ─── 학습 실행 ─────────────────────────────────────────────────────────
    history, best_acc = train_multitask(
        model, train_loader, val_loader,
        optimizer, criterion,
        targets=MULTITASK_TARGETS,
        scheduler=scheduler,
        epochs=EPOCHS,
        device=DEVICE,
        save_dir=SAVE_DIR,
        save_name="multitask_v5_best",  # 최고 val_acc 달성 시 이 이름으로 저장
        coral_mode=True,  # 예측 시 argmax 대신 sigmoid 합산 방식 사용
    )

    # ─── 학습 기록 저장 ────────────────────────────────────────────────────
    # epoch별 loss, val_acc, 속성별 acc를 JSON으로 저장
    # → 이후 학습 곡선 그래프 생성, 성능 비교에 활용
    import json
    history_path = Path(SAVE_DIR) / "history_v5.json"
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump({"version": "v5", "best_acc": best_acc, "history": history}, f, indent=2)
    print(f"     history 저장: {history_path}")

    print(f"\n[v5] 완료: best_mean_acc={best_acc:.4f}")
    print(f"     비교: v2(B0+CE)=0.5170, v5(B0+CORAL)={best_acc:.4f}")


if __name__ == "__main__":
    main()
