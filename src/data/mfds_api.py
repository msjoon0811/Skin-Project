"""
식품의약품안전처 화장품 공공데이터 API 수집 모듈.

수집 대상 4종:
  1. 화장품 원료성분정보
  2. 화장품 사용제한 원료정보
  3. 기능성화장품 보고품목정보
  4. 화장품 규제정보

사용법:
    python src/data/mfds_api.py
"""

import os
import time
from pathlib import Path

import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("MFDS_API_KEY")

SAVE_DIR = Path("data/raw/mfds")
SAVE_DIR.mkdir(parents=True, exist_ok=True)

APIS = {
    "ingredient": {
        "url":  "https://apis.data.go.kr/1471000/CsmtcsIngdCpntInfoService01/getCsmtcsIngdCpntInfoService01",
        "desc": "화장품 원료성분정보",
        "save": SAVE_DIR / "ingredient.csv",
    },
    "restricted": {
        "url":  "https://apis.data.go.kr/1471000/CsmtcsUseRstrcInfoService/getCsmtcsUseRstrcInfoService",
        "desc": "화장품 사용제한 원료정보",
        "save": SAVE_DIR / "restricted.csv",
    },
    "functional": {
        "url":  "https://apis.data.go.kr/1471000/FtnltCosmRptPrdlstInfoService/getRptPrdlstInq",
        "desc": "기능성화장품 보고품목정보",
        "save": SAVE_DIR / "functional.csv",
    },
    "regulation": {
        "url":  "https://apis.data.go.kr/1471000/CsmtcsReglMaterialInfoService/getCsmtcsReglMaterialInfoService",
        "desc": "화장품 규제정보",
        "save": SAVE_DIR / "regulation.csv",
    },
}


def _fetch_page(url: str, page: int, page_size: int = 100) -> dict:
    params = {
        "serviceKey": API_KEY,
        "pageNo":     page,
        "numOfRows":  page_size,
        "type":       "json",
    }
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def _get_body(data: dict) -> dict:
    # 응답 구조: {"header":...,"body":...} 또는 {"response":{"header":...,"body":...}}
    if "body" in data:
        return data["body"]
    return data.get("response", {}).get("body", {})


def _parse_items(body: dict) -> list:
    items = body.get("items", [])
    if isinstance(items, dict):
        items = items.get("item", [])
    if isinstance(items, dict):
        items = [items]
    return items or []


def collect_all(url: str, desc: str, page_size: int = 100) -> pd.DataFrame:
    print(f"\n[{desc}] 수집 시작...")

    first  = _fetch_page(url, page=1, page_size=page_size)
    body   = _get_body(first)
    total  = int(body.get("totalCount", 0))
    items  = _parse_items(body)

    if not items:
        print(f"  항목 없음 (totalCount={total})")
        return pd.DataFrame()

    records     = list(items)
    total_pages = (total + page_size - 1) // page_size
    print(f"  총 {total:,}건 / {total_pages}페이지")

    for page in range(2, total_pages + 1):
        try:
            data  = _fetch_page(url, page=page, page_size=page_size)
            body  = _get_body(data)
            records.extend(_parse_items(body))
            time.sleep(0.05)
            if page % 20 == 0:
                print(f"  {page}/{total_pages} 페이지...")
        except Exception as e:
            print(f"  페이지 {page} 오류: {e}")

    df = pd.DataFrame(records)
    print(f"  완료: {len(df):,}행 {len(df.columns)}열")
    return df


def test_connection() -> bool:
    """API 키 및 엔드포인트 연결 확인."""
    print("=== API 연결 테스트 ===")
    success = 0
    for name, cfg in APIS.items():
        try:
            resp = requests.get(cfg["url"], params={
                "serviceKey": API_KEY,
                "pageNo": 1,
                "numOfRows": 1,
                "type": "json",
            }, timeout=30)
            print(f"\n  [{cfg['desc']}]")
            print(f"  HTTP {resp.status_code}")
            if resp.status_code == 200:
                try:
                    data   = resp.json()
                    # 구조: {"header":...} 또는 {"response":{"header":...}}
                    header = data.get("header") or data.get("response", {}).get("header", {})
                    code   = header.get("resultCode", "?")
                    msg    = header.get("resultMsg", "?")
                    print(f"  resultCode={code}, msg={msg}")
                    if code == "00":
                        success += 1
                        print(f"  [OK] 연결 성공")
                    else:
                        print(f"  [응답은 왔으나 오류코드]")
                except Exception:
                    print(f"  [응답 미리보기] {resp.text[:200]}")
            else:
                print(f"  [응답 미리보기] {resp.text[:200]}")
        except Exception as e:
            print(f"  [실패] {e}")
    print(f"\n{success}/{len(APIS)} 연결 성공")
    return success > 0


def collect_and_save_all():
    """4종 API 전체 수집 후 CSV 저장."""
    for name, cfg in APIS.items():
        try:
            df = collect_all(cfg["url"], cfg["desc"])
            if not df.empty:
                df.to_csv(cfg["save"], index=False, encoding="utf-8-sig")
                print(f"  저장: {cfg['save']}")
        except Exception as e:
            print(f"[{cfg['desc']}] 실패: {e}")


if __name__ == "__main__":
    if not API_KEY:
        print("오류: .env 파일에 MFDS_API_KEY 없음")
        exit(1)

    ok = test_connection()
    if ok:
        print("\n전체 수집 시작...")
        collect_and_save_all()
        print("\n완료. data/raw/mfds/ 폴더 확인")
    else:
        print("\n연결 실패 — API 키 또는 엔드포인트 확인 필요")
