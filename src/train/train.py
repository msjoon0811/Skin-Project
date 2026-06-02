"""
학습 루프: 베이스라인(단일 속성) 및 Multi-task.

사용법:
    from src.train.train import train_baseline, train_multitask
"""

import os
from pathlib import Path

import torch
from torch.utils.data import DataLoader
from tqdm import tqdm

from src.train.eval import evaluate_baseline, evaluate_multitask, print_eval_results


def train_one_epoch_baseline(
    model, loader: DataLoader, optimizer, criterion, device: str
) -> float:
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0

    for imgs, labels in tqdm(loader, desc="Train", leave=False):
        imgs, labels = imgs.to(device), labels.to(device)
        optimizer.zero_grad()
        logits = model(imgs)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item()
        correct += (logits.argmax(1) == labels).sum().item()
        total += len(labels)

    return total_loss / len(loader), correct / total


def train_baseline(
    model,
    train_loader: DataLoader,
    val_loader: DataLoader,
    optimizer,
    criterion,
    scheduler=None,
    epochs: int = 20,
    device: str = "cpu",
    save_dir: str = "checkpoints",
    target_name: str = "baseline",
):
    """단일 속성 베이스라인 학습."""
    save_path = Path(save_dir) / f"{target_name}_best.pth"
    save_path.parent.mkdir(parents=True, exist_ok=True)

    best_acc = 0.0
    history = []

    for epoch in range(1, epochs + 1):
        train_loss, train_acc = train_one_epoch_baseline(
            model, train_loader, optimizer, criterion, device
        )
        val_metrics = evaluate_baseline(model, val_loader, device)
        val_acc = val_metrics["accuracy"]
        val_f1  = val_metrics["macro_f1"]

        if scheduler:
            scheduler.step()

        log = {
            "epoch": epoch,
            "train_loss": train_loss,
            "train_acc":  train_acc,
            "val_acc":    val_acc,
            "val_f1":     val_f1,
        }
        history.append(log)
        print(
            f"Epoch {epoch:02d}/{epochs} | "
            f"loss={train_loss:.4f} | "
            f"train_acc={train_acc:.4f} | "
            f"val_acc={val_acc:.4f} | "
            f"val_f1={val_f1:.4f}"
        )

        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), save_path)
            print(f"  ★ 최고 val_acc={best_acc:.4f} → {save_path}")

    print(f"\n학습 완료. 최고 val_acc={best_acc:.4f}")
    return history, best_acc


def train_one_epoch_multitask(
    model, loader: DataLoader, optimizer, criterion, device: str
) -> tuple[float, dict]:
    model.train()
    total_loss = 0.0
    per_task_loss = {}

    for imgs, labels in tqdm(loader, desc="Train", leave=False):
        imgs   = imgs.to(device)
        labels = labels.to(device)
        optimizer.zero_grad()

        preds = model(imgs)
        loss, task_losses = criterion(preds, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item()
        for t, v in task_losses.items():
            per_task_loss[t] = per_task_loss.get(t, 0.0) + v

    n = len(loader)
    return total_loss / n, {t: v / n for t, v in per_task_loss.items()}


def train_multitask(
    model,
    train_loader: DataLoader,
    val_loader: DataLoader,
    optimizer,
    criterion,
    targets: list,
    scheduler=None,
    epochs: int = 20,
    device: str = "cpu",
    save_dir: str = "checkpoints",
    save_name: str = "multitask_v2_best",
    coral_mode: bool = False,
):
    """Multi-task 학습."""
    save_path = Path(save_dir) / f"{save_name}.pth"
    save_path.parent.mkdir(parents=True, exist_ok=True)

    best_mean_acc = 0.0
    history = []

    for epoch in range(1, epochs + 1):
        train_loss, _ = train_one_epoch_multitask(
            model, train_loader, optimizer, criterion, device
        )
        val_metrics = evaluate_multitask(model, val_loader, device, targets, coral_mode=coral_mode)
        mean_acc = val_metrics["_mean_accuracy"]
        mean_f1  = val_metrics["_mean_macro_f1"]

        if scheduler:
            scheduler.step()

        log = {
            "epoch": epoch,
            "train_loss": train_loss,
            "val_mean_acc": mean_acc,
            "val_mean_f1":  mean_f1,
            "per_task_acc": {t: val_metrics[t]["accuracy"] for t in targets if t in val_metrics},
        }
        history.append(log)
        print(
            f"Epoch {epoch:02d}/{epochs} | "
            f"loss={train_loss:.4f} | "
            f"val_mean_acc={mean_acc:.4f} | "
            f"val_mean_f1={mean_f1:.4f}"
        )
        print_eval_results(val_metrics, mode="multitask")

        if mean_acc > best_mean_acc:
            best_mean_acc = mean_acc
            torch.save(model.state_dict(), save_path)
            print(f"  ★ 최고 val_mean_acc={best_mean_acc:.4f} → {save_path}")

    print(f"\n학습 완료. 최고 val_mean_acc={best_mean_acc:.4f}")
    return history, best_mean_acc
