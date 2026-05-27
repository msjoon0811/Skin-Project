"""
v2 완료 후 v3 → v4 순서로 자동 연속 학습.

v2 로그에서 '학습 완료' 문자열을 감지하면 v3을 시작하고,
v3 완료 후 v4를 시작한다.

사용법:
    python scripts/run_chain_v3_v4.py
"""

import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

V2_LOG   = Path("logs/train_v2.log")
V3_LOG   = Path("logs/train_v3.log")
V3_ERR   = Path("logs/train_v3_err.log")
V4_LOG   = Path("logs/train_v4.log")
V4_ERR   = Path("logs/train_v4_err.log")
DONE_STR = "best_mean_acc="   # ASCII만 사용 — 한글 인코딩 문제 회피
POLL_SEC = 120   # 2분마다 체크


def wait_for_completion(log_path: Path, label: str):
    print(f"[chain] {label} 완료 대기 중... ({log_path})", flush=True)
    while True:
        if log_path.exists():
            text = log_path.read_text(encoding="utf-8", errors="ignore")
            if DONE_STR in text:
                print(f"[chain] {label} 완료 확인.", flush=True)
                return
        time.sleep(POLL_SEC)


def run_training(script: str, log_out: Path, log_err: Path, label: str):
    import subprocess
    root = Path(__file__).parent.parent
    # 가상환경 Python 우선 사용 — Start-Process가 시스템 Python을 쓸 수 있어서 명시
    venv_py = root / "venv" / "Scripts" / "python.exe"
    python  = str(venv_py) if venv_py.exists() else sys.executable
    print(f"\n[chain] {label} 학습 시작: {script} (python={python})", flush=True)
    log_out.parent.mkdir(exist_ok=True)
    with open(log_out, "w", encoding="utf-8") as out, \
         open(log_err, "w", encoding="utf-8") as err:
        proc = subprocess.run(
            [python, script],
            stdout=out, stderr=err,
            cwd=root,
        )
    print(f"[chain] {label} 종료 (returncode={proc.returncode})", flush=True)
    return proc.returncode


if __name__ == "__main__":
    # 1. v2 완료 대기
    wait_for_completion(V2_LOG, "v2")

    # 2. v3 학습
    rc3 = run_training(
        "scripts/train_multitask_v3.py",
        V3_LOG, V3_ERR, "v3 (B3+CE)"
    )

    if rc3 != 0:
        print("[chain] v3 실패. v4 건너뜀.", flush=True)
        sys.exit(1)

    # 3. v4 학습
    rc4 = run_training(
        "scripts/train_multitask_v4.py",
        V4_LOG, V4_ERR, "v4 (B3+CORAL)"
    )

    print(f"\n[chain] 전체 완료. v3={rc3}, v4={rc4}", flush=True)
