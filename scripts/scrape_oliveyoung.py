"""
올리브영 전체 베스트 제품 수집 스크립트.

실행:
    python scripts/scrape_oliveyoung.py

결과:
    data/oliveyoung_best.json  — 베스트 제품 리스트 (상위 50개)
"""

import asyncio
import json
import re
from pathlib import Path

from playwright.async_api import async_playwright

SAVE_PATH = Path("data/oliveyoung_best.json")
BEST_URL = "https://www.oliveyoung.co.kr/store/main/getBestList.do"


def clean_text(text: str) -> str:
    # 순위 숫자(01, 02...) 앞부분 제거
    text = re.sub(r"^\d{2}", "", text.strip())
    return text.strip()


async def scrape():
    SAVE_PATH.parent.mkdir(parents=True, exist_ok=True)
    products = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
            locale="ko-KR",
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )

        page = await context.new_page()
        print("올리브영 베스트 페이지 로딩 중...")
        await page.goto(BEST_URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)

        # 더보기 클릭해서 더 많은 제품 로드
        for _ in range(3):
            try:
                more_btn = await page.query_selector(".btn-more, .more-btn, [class*='more']")
                if more_btn:
                    await more_btn.click()
                    await page.wait_for_timeout(1500)
            except Exception:
                break

        # 제품 데이터 추출
        items = await page.query_selector_all("li.flag")
        print(f"발견된 제품 수: {len(items)}")

        for i, item in enumerate(items[:50]):
            try:
                p = {"rank": i + 1}

                # 링크 & goodsNo
                link_el = await item.query_selector("a.prd_thumb, div.prd_info > a")
                if link_el:
                    href = await link_el.get_attribute("href") or ""
                    if href.startswith("/"):
                        href = "https://www.oliveyoung.co.kr" + href
                    p["link"] = href
                    m = re.search(r"goodsNo=(\w+)", href)
                    if m:
                        p["goods_no"] = m.group(1)

                # 브랜드
                brand_el = await item.query_selector(".prd_brand, .tx_brand")
                if brand_el:
                    p["brand"] = (await brand_el.inner_text()).strip()

                # 제품명
                name_el = await item.query_selector(".prd_name, .tx_name")
                if name_el:
                    p["name"] = (await name_el.inner_text()).strip()

                # 없으면 data-attr에서 추출
                if not p.get("name") and link_el:
                    data_attr = await link_el.get_attribute("data-attr") or ""
                    parts = data_attr.split("^")
                    if len(parts) >= 3:
                        raw = parts[2]
                        p["name"] = clean_text(raw)

                # 가격
                price_el = await item.query_selector(".prd_price .price-2, .tx_price")
                if price_el:
                    raw = (await price_el.inner_text()).strip()
                    p["price"] = re.sub(r"[^\d,]", "", raw) + "원" if re.search(r"\d", raw) else ""

                # 이미지
                img_el = await item.query_selector("img")
                if img_el:
                    src = (await img_el.get_attribute("data-src")) or (await img_el.get_attribute("src")) or ""
                    if src.startswith("//"):
                        src = "https:" + src
                    p["image"] = src

                if p.get("name") or p.get("goods_no"):
                    products.append(p)
                    if (i + 1) % 10 == 0:
                        print(f"  {i+1}개 수집 중...")

            except Exception as e:
                print(f"  {i+1}번 상품 오류: {e}")

        await browser.close()

    SAVE_PATH.write_text(
        json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\n완료! {len(products)}개 저장 → {SAVE_PATH}")

    print("\n[샘플 5개]")
    for prod in products[:5]:
        print(f"  {prod.get('rank')}. {prod.get('brand','')} - {prod.get('name','')[:40]} / {prod.get('price','')}")


if __name__ == "__main__":
    asyncio.run(scrape())
