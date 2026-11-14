import asyncio
import json
from playwright.async_api import async_playwright

async def sniff_domcontentloaded():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        calls = []

        async def on_response(response):
            url = response.url
            ct = response.headers.get("content-type", "")
            if "json" in ct or "text" in ct or "javascript" in ct:
                try:
                    text = await response.text()
                    calls.append({"url": url, "status": response.status, "content_type": ct, "len": len(text), "sample": text[:300]})
                    print(f"[{response.status}] {url}")
                except Exception:
                    pass

        page.on("response", on_response)

        target = "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25"
        print(f"Navigating with wait_until='domcontentloaded' to {target}...")
        await page.goto(target, wait_until="domcontentloaded", timeout=60000)
        print("DOM loaded! Waiting 15 seconds for Angular hydration and API calls...")
        await asyncio.sleep(15)

        with open("angular_calls.json", "w", encoding="utf-8") as f:
            json.dump(calls, f, indent=2)

        print(f"Saved {len(calls)} calls to angular_calls.json")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(sniff_domcontentloaded())
