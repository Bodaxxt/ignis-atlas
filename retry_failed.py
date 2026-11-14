import os
import time
import json
import urllib.parse
import urllib.request
import pandas as pd
import numpy as np

RETRY_LIST = ["PSI-69", "PSI-39", "PSI-102"]

BASE_API = "https://psi.nasa.gov/geode-py/ws/repo/investigations/{psi_id}"
DOWNLOAD_API = "https://psi.nasa.gov/geode-py/ws/studies/{psi_id}/download?file={filename}&redirect=false"

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def get_with_headers(url, retries=3):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                return resp.read()
        except Exception as e:
            if attempt == retries - 1:
                raise e
            time.sleep(2.0)

for psi_id in RETRY_LIST:
    print(f"Retrying {psi_id}...")
    try:
        raw_meta = get_with_headers(BASE_API.format(psi_id=psi_id))
        with open(f"data/raw/{psi_id}_metadata.json", "wb") as f:
            f.write(raw_meta)
        meta_json = json.loads(raw_meta.decode("utf-8", errors="ignore"))
        exp_tables = meta_json.get("experimentalTable", [])
        if not exp_tables:
            print(f"  No table for {psi_id}")
            continue
        filename = exp_tables[0]["file_name"]
        print(f"  File: {filename}")
        time.sleep(1.0)
        s3_url = get_with_headers(DOWNLOAD_API.format(psi_id=psi_id, filename=urllib.parse.quote(filename))).decode("utf-8").strip()
        time.sleep(1.0)
        content = get_with_headers(s3_url)
        raw_path = f"data/raw/{filename}"
        with open(raw_path, "wb") as f:
            f.write(content)
        # Parse with fallback encoding
        parsed_path = f"data/tables/{psi_id}.csv"
        try:
            df = pd.read_csv(raw_path, encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(raw_path, encoding="latin1")
        df.to_csv(parsed_path, index=False)
        print(f"  SUCCESS {psi_id}: {len(df)} rows, {len(df.columns)} cols.")
    except Exception as e:
        print(f"  FAILED {psi_id}: {e}")
