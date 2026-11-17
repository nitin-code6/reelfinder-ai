import os
import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "https://reelfinder-frontend.onrender.com"
OUTPUT_DIR = Path("docs/screenshots")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PAGES = [
    ("overview.png", f"{BASE_URL}/"),
    ("library.png", f"{BASE_URL}/shows"),
    ("discovery.png", f"{BASE_URL}/promos"),
    ("review.png", f"{BASE_URL}/review"),
    ("export.png", f"{BASE_URL}/export"),
]

def capture():
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--window-size=1440,900")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=chrome_options)
    driver.set_window_size(1440, 900)

    try:
        for filename, url in PAGES:
            print(f"Navigating to {url}...")
            driver.get(url)
            # Give SPA time to fetch backend data
            time.sleep(4)
            out_path = OUTPUT_DIR / filename
            driver.save_screenshot(str(out_path))
            print(f"Saved: {out_path} ({out_path.stat().st_size} bytes)")
    finally:
        driver.quit()

if __name__ == "__main__":
    capture()
