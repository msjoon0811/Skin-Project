import torch
import numpy as np
from sklearn.metrics import f1_score, accuracy_score
from src.models.multitask import MultiTaskSkinModel


def evaluate_multitask(model, loader, device: str) -> dict:
    model.eval()
    reg_preds = {a: [] for a in MultiTaskSkinModel.REGRESSION_ATTRS}
    reg_targets = {a: [] for a in MultiTaskSkinModel.REGRESSION_ATTRS}
    cls_preds = {a: [] for a in [a for a, _ in MultiTaskSkinModel.CLASSIFICATION_ATTRS]}
    cls_targets_dict = {a: [] for a in [a for a, _ in MultiTaskSkinModel.CLASSIFICATION_ATTRS]}

    with torch.no_grad():
        for imgs, reg_t, cls_t in loader:
            imgs = imgs.to(device)
            out = model(imgs)
            for i, attr in enumerate(MultiTaskSkinModel.REGRESSION_ATTRS):
                reg_preds[attr].extend(out[attr].cpu().numpy())
                reg_targets[attr].extend(reg_t[:, i].numpy())
            for i, (attr, _) in enumerate(MultiTaskSkinModel.CLASSIFICATION_ATTRS):
                pred_cls = out[attr].argmax(dim=1).cpu().numpy()
                cls_preds[attr].extend(pred_cls)
                cls_targets_dict[attr].extend(cls_t[:, i].numpy())

    metrics = {}
    for attr in MultiTaskSkinModel.REGRESSION_ATTRS:
        p, t = np.array(reg_preds[attr]), np.array(reg_targets[attr])
        metrics[f"{attr}_mae"] = float(np.mean(np.abs(p - t)))
        metrics[f"{attr}_rmse"] = float(np.sqrt(np.mean((p - t) ** 2)))

    for attr, _ in MultiTaskSkinModel.CLASSIFICATION_ATTRS:
        p, t = np.array(cls_preds[attr]), np.array(cls_targets_dict[attr])
        metrics[f"{attr}_acc"] = float(accuracy_score(t, p))
        metrics[f"{attr}_f1"] = float(f1_score(t, p, average="macro", zero_division=0))

    return metrics
