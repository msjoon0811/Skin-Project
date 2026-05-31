"""평가 지표: Accuracy, Macro-F1 (per attribute + overall)."""

import torch
import numpy as np
from torch.utils.data import DataLoader
from sklearn.metrics import f1_score, accuracy_score, confusion_matrix


def evaluate_baseline(model, loader: DataLoader, device: str) -> dict:
    """단일 속성 베이스라인 평가."""
    model.eval()
    all_preds, all_labels = [], []

    with torch.no_grad():
        for imgs, labels in loader:
            imgs = imgs.to(device)
            logits = model(imgs)
            preds = logits.argmax(dim=1).cpu().numpy()
            all_preds.extend(preds)
            all_labels.extend(labels.numpy())

    all_preds  = np.array(all_preds)
    all_labels = np.array(all_labels)

    acc = accuracy_score(all_labels, all_preds)
    f1  = f1_score(all_labels, all_preds, average="macro", zero_division=0)
    cm  = confusion_matrix(all_labels, all_preds)

    return {"accuracy": acc, "macro_f1": f1, "confusion_matrix": cm}


def evaluate_multitask(
    model, loader: DataLoader, device: str, targets: list, coral_mode: bool = False
) -> dict:
    """Multi-task 평가: 타겟별 + 전체 Accuracy, Macro-F1.

    Parameters
    ----------
    coral_mode : True면 CORAL head 출력(K-1 logits)을 threshold 합산으로 예측.
                 False(기본)면 일반 CE head 출력을 argmax로 예측.
    """
    model.eval()

    all_preds  = {t: [] for t in targets}
    all_labels = {t: [] for t in targets}

    with torch.no_grad():
        for imgs, label_tensor in loader:
            imgs = imgs.to(device)
            preds_dict = model(imgs)

            for i, t in enumerate(targets):
                t_labels = label_tensor[:, i].numpy()

                if coral_mode:
                    t_preds = (torch.sigmoid(preds_dict[t]) > 0.5).sum(dim=1).cpu().numpy()
                else:
                    t_preds = preds_dict[t].argmax(dim=1).cpu().numpy()

                # -1(결측) 제외
                valid = t_labels != -1
                all_preds[t].extend(t_preds[valid])
                all_labels[t].extend(t_labels[valid])

    results = {}
    accs, f1s = [], []

    for t in targets:
        if len(all_labels[t]) == 0:
            continue
        y_true = np.array(all_labels[t])
        y_pred = np.array(all_preds[t])
        acc = accuracy_score(y_true, y_pred)
        f1  = f1_score(y_true, y_pred, average="macro", zero_division=0)
        results[t] = {"accuracy": acc, "macro_f1": f1, "n_samples": len(y_true)}
        accs.append(acc)
        f1s.append(f1)

    results["_mean_accuracy"] = float(np.mean(accs)) if accs else 0.0
    results["_mean_macro_f1"] = float(np.mean(f1s)) if f1s else 0.0
    return results


def print_eval_results(results: dict, mode: str = "multitask"):
    if mode == "baseline":
        print(f"  Accuracy : {results['accuracy']:.4f}")
        print(f"  Macro-F1 : {results['macro_f1']:.4f}")
        return

    print(f"  {'속성':<35} {'Accuracy':>10} {'Macro-F1':>10} {'N':>8}")
    print(f"  {'-'*65}")
    for t, v in results.items():
        if t.startswith("_"):
            continue
        print(f"  {t:<35} {v['accuracy']:>10.4f} {v['macro_f1']:>10.4f} {v['n_samples']:>8}")
    print(f"  {'-'*65}")
    print(f"  {'평균':<35} {results['_mean_accuracy']:>10.4f} {results['_mean_macro_f1']:>10.4f}")
