import asyncio
import json
from playwright.async_api import async_playwright

async def sniff_psi_25():
    print("Launching Playwright headless...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        requests_log = []

        async def handle_response(response):
            url = response.url
            if any(ext in url for ext in ['.png', '.jpg', '.css', '.woff', '.ico']):
                return
            try:
                content_type = response.headers.get("content-type", "")
                if "json" in content_type or "text" in content_type or "javascript" in content_type:
                    body = await response.text()
                    requests_log.append({
                        "url": url,
                        "method": response.request.method,
                        "status": response.status,
                        "content_type": content_type,
                        "body_preview": body[:500] if body else ""
                    })
                    print(f"[{response.status}] {response.request.method} {url}")
                    if "Test #" in body or "Calibrated initial O2" in body or "investigation" in url.lower():
                        print(f"===> MATCH FOUND IN: {url}")
            except Exception as e:
                pass

        page.on("response", handle_response)

        target_url = "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25"
        print(f"Navigating to {target_url}...")
        try:
            await page.goto(target_url, wait_until="networkidle", timeout=45000)
            print("Initial page loaded. Waiting 5s for any delayed calls...")
            await asyncio.sleep(5)

            # Look for 'Experimental Table' button or tab
            print("Searching for 'Experimental Table' tab/button...")
            exp_table_elem = page.locator("text='Experimental Table'")
            if await exp_table_elem.count() > 0:
                print("Clicking 'Experimental Table'...")
                await exp_table_elem.first.click()
                await asyncio.sleep(4)
            else:
                print("Trying regex for Experimental...")
                tabs = page.locator("a, button, li")
                count = await tabs.count()
                for i in range(count):
                    txt = await tabs.nth(i).inner_text()
                    if "experimental" in txt.lower():
                        print(f"Found element with text: '{txt}', clicking...")
                        await tabs.nth(i).click()
                        await asyncio.sleep(3)
                        break

            # Try to find items per page selector
            print("Checking page content...")
            await asyncio.sleep(3)

        except Exception as e:
            print(f"Navigation/Interaction error: {e}")

        # Save logged requests
        with open("data_requests_log.json", "w", encoding="utf-8") as f:
            json.dump(requests_log, f, indent=2)

        print(f"Logged {len(requests_log)} requests. Saved to data_requests_log.json")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(sniff_psi_25())
