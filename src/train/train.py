import torch
from torch.utils.data import DataLoader
from tqdm import tqdm


def train_one_epoch(model, loader: DataLoader, optimizer, criterion, device: str) -> float:
    model.train()
    total_loss = 0.0
    for batch in tqdm(loader, desc="Train"):
        imgs, *targets = [t.to(device) for t in batch]
        optimizer.zero_grad()
        preds = model(imgs)
        loss = criterion(preds, *targets)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
    return total_loss / len(loader)


def run_training(model, train_loader, val_loader, optimizer, criterion, scheduler=None,
                 epochs: int = 20, device: str = "cuda", save_path: str = "checkpoints/best.pth"):
    best_val = float("inf")
    for epoch in range(1, epochs + 1):
        train_loss = train_one_epoch(model, train_loader, optimizer, criterion, device)
        val_loss = evaluate(model, val_loader, criterion, device)
        if scheduler:
            scheduler.step(val_loss)
        print(f"Epoch {epoch:02d} | train_loss={train_loss:.4f} | val_loss={val_loss:.4f}")
        if val_loss < best_val:
            best_val = val_loss
            torch.save(model.state_dict(), save_path)
            print(f"  → 모델 저장: {save_path}")


def evaluate(model, loader: DataLoader, criterion, device: str) -> float:
    model.eval()
    total_loss = 0.0
    with torch.no_grad():
        for batch in loader:
            imgs, *targets = [t.to(device) for t in batch]
            preds = model(imgs)
            loss = criterion(preds, *targets)
            total_loss += loss.item()
    return total_loss / len(loader)
