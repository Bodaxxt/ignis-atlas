import os
import time
import json
import urllib.parse
import urllib.request
import pandas as pd
import numpy as np

# Target investigations list
INVESTIGATIONS = [
    "PSI-25", "PSI-26", "PSI-98", "PSI-99", "PSI-100",
    "PSI-68", "PSI-69", "PSI-39", "PSI-159", "PSI-10",
    "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-106",
    "PSI-107", "PSI-102", "PSI-101", "PSI-47"
]

BASE_API = "https://psi.nasa.gov/geode-py/ws/repo/investigations/{psi_id}"
DOWNLOAD_API = "https://psi.nasa.gov/geode-py/ws/studies/{psi_id}/download?file={filename}&redirect=false"

os.makedirs("data/raw", exist_ok=True)
os.makedirs("data/tables", exist_ok=True)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def get_with_headers(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()

summary_rows = []
verification_samples = {}
report_notes = {}

print("=================================================================")
print("STARTING DETERMINISTIC PSI EXPERIMENTAL TABLE EXTRACTION ENGINE")
print(f"Target count: {len(INVESTIGATIONS)} investigations")
print("Rate limit: 1.0 request/sec polite cadence")
print("=================================================================\n")

for idx, psi_id in enumerate(INVESTIGATIONS):
    print(f"\n[{idx+1}/{len(INVESTIGATIONS)}] Processing {psi_id}...")
    meta_url = BASE_API.format(psi_id=psi_id)
    raw_meta_path = f"data/raw/{psi_id}_metadata.json"
    
    # 1. Fetch metadata
    try:
        time.sleep(1.0)
        raw_meta = get_with_headers(meta_url)
        with open(raw_meta_path, "wb") as f:
            f.write(raw_meta)
        meta_json = json.loads(raw_meta.decode("utf-8", errors="ignore"))
    except Exception as e:
        print(f"  [ERROR] Failed to fetch metadata for {psi_id}: {e}")
        report_notes[psi_id] = f"Metadata fetch error: {e}"
        continue

    # Extract Description & Basic Info
    description = meta_json.get("description", "")
    with open(f"data/raw/{psi_id}_description.txt", "w", encoding="utf-8") as f:
        f.write(description)

    # 2. Locate Experimental Table in metadata
    exp_tables = meta_json.get("experimentalTable", [])
    if not exp_tables:
        print(f"  [WARN] No experimentalTable files listed in metadata for {psi_id}.")
        report_notes[psi_id] = "No experimental table registered in PSI metadata."
        summary_rows.append({
            "investigation": psi_id,
            "status": "NO_EXPERIMENTAL_TABLE",
            "table_file": "column not present",
            "row_count": 0,
            "columns": "column not present",
            "o2_min": "column not present",
            "o2_max": "column not present",
            "o2_non_empty": "column not present",
            "o2_distinct": "column not present",
            "pressure_min": "column not present",
            "pressure_max": "column not present",
            "pressure_non_empty": "column not present",
            "pressure_distinct": "column not present",
            "flow_min": "column not present",
            "flow_max": "column not present",
            "flow_non_empty": "column not present",
            "flow_distinct": "column not present",
            "material_distinct": "column not present"
        })
        continue

    # Pick the first/best table file
    target_file_entry = exp_tables[0]
    filename = target_file_entry.get("file_name")
    print(f"  Found table file reference: '{filename}' ({target_file_entry.get('file_size')} bytes)")

    # 3. Get Presigned S3 Download URL via API
    try:
        time.sleep(1.0)
        quoted_fn = urllib.parse.quote(filename)
        dl_api_url = DOWNLOAD_API.format(psi_id=psi_id, filename=quoted_fn)
        s3_url_bytes = get_with_headers(dl_api_url)
        s3_url = s3_url_bytes.decode("utf-8").strip()
    except Exception as e:
        print(f"  [ERROR] Could not resolve download URL for {filename}: {e}")
        report_notes[psi_id] = f"Presigned URL generation failed: {e}"
        continue

    # 4. Download Raw Table File
    raw_table_path = f"data/raw/{filename}"
    parsed_csv_path = f"data/tables/{psi_id}.csv"

    try:
        time.sleep(1.0)
        table_content = get_with_headers(s3_url)
        with open(raw_table_path, "wb") as f:
            f.write(table_content)
        print(f"  Raw table saved to: {raw_table_path} ({len(table_content)} bytes)")
    except Exception as e:
        print(f"  [ERROR] Failed to download table content from S3: {e}")
        report_notes[psi_id] = f"S3 download failed: {e}"
        continue

    # 5. Deterministic Parsing (CSV or XLSX)
    df = None
    try:
        if filename.lower().endswith(".xlsx") or filename.lower().endswith(".xls"):
            df = pd.read_excel(raw_table_path)
            df.to_csv(parsed_csv_path, index=False)
        else:
            # Read as CSV preserving exact types and string formatting
            df = pd.read_csv(raw_table_path)
            df.to_csv(parsed_csv_path, index=False)
        print(f"  Parsed successfully: {len(df)} rows, {len(df.columns)} columns.")
    except Exception as e:
        print(f"  [ERROR] Parsing failed for {filename}: {e}")
        report_notes[psi_id] = f"Parsing error: {e}"
        continue

    # 6. Column Mapping & Statistical Extraction
    cols = list(df.columns)
    
    # Oxygen column heuristic check
    o2_col = next((c for c in cols if any(k in c.lower() for k in ["o2", "oxygen", "o₂"]) and not "co2" in c.lower()), None)
    press_col = next((c for c in cols if any(k in c.lower() for k in ["pressure", "press", "psi", "kpa", "atm", "chamber p"])), None)
    flow_col = next((c for c in cols if any(k in c.lower() for k in ["airflow", "flow", "velocity", "fan"])), None)
    mat_col = next((c for c in cols if any(k in c.lower() for k in ["material", "fuel", "sample", "substrate"])), None)

    def col_stats(col_name):
        if not col_name or col_name not in df:
            return "column not present", "column not present", "column not present", "column not present"
        series = df[col_name].dropna()
        non_empty = len(series)
        distinct = series.nunique()
        # Attempt numeric conversion for min/max
        num_s = pd.to_numeric(series.astype(str).str.extract(r"([-+]?\d*\.?\d+)", expand=False), errors="coerce").dropna()
        if len(num_s) > 0:
            c_min = round(float(num_s.min()), 4)
            c_max = round(float(num_s.max()), 4)
        else:
            c_min = "non-numeric"
            c_max = "non-numeric"
        return c_min, c_max, non_empty, distinct

    o2_min, o2_max, o2_ne, o2_dist = col_stats(o2_col)
    p_min, p_max, p_ne, p_dist = col_stats(press_col)
    f_min, f_max, f_ne, f_dist = col_stats(flow_col)
    _, _, _, mat_dist = col_stats(mat_col)

    summary_rows.append({
        "investigation": psi_id,
        "status": "PARSED_OK",
        "table_file": filename,
        "row_count": len(df),
        "columns": "; ".join(cols),
        "o2_col": o2_col if o2_col else "column not present",
        "o2_min": o2_min,
        "o2_max": o2_max,
        "o2_non_empty": o2_ne,
        "o2_distinct": o2_dist,
        "pressure_col": press_col if press_col else "column not present",
        "pressure_min": p_min,
        "pressure_max": p_max,
        "pressure_non_empty": p_ne,
        "pressure_distinct": p_dist,
        "flow_col": flow_col if flow_col else "column not present",
        "flow_min": f_min,
        "flow_max": f_max,
        "flow_non_empty": f_ne,
        "flow_distinct": f_dist,
        "material_col": mat_col if mat_col else "column not present",
        "material_distinct": mat_dist
    })

    # 7. Verification sample: pick 5 random lines from parsed table with raw line matching
    if len(df) > 0:
        sample_indices = np.random.choice(len(df), size=min(5, len(df)), replace=False)
        sample_rows = []
        with open(raw_table_path, "r", encoding="utf-8", errors="ignore") as rf:
            raw_lines = rf.readlines()
        for s_idx in sample_indices:
            # Row index + 2 is approximately line number in raw CSV (1-based + header)
            raw_line_num = s_idx + 2 if s_idx + 2 <= len(raw_lines) else len(raw_lines)
            raw_text = raw_lines[raw_line_num - 1].strip() if raw_lines else "N/A"
            sample_rows.append({
                "row_index": int(s_idx),
                "raw_line_num": raw_line_num,
                "raw_line_text": raw_text[:120] + "..." if len(raw_text) > 120 else raw_text
            })
        verification_samples[psi_id] = sample_rows

# Save data/summary.csv
summary_df = pd.DataFrame(summary_rows)
summary_df.to_csv("data/summary.csv", index=False)
print("\n[COMPLETE] Written data/summary.csv with", len(summary_df), "records.")

# Save verification samples to json
with open("data/verification_samples.json", "w", encoding="utf-8") as f:
    json.dump(verification_samples, f, indent=2)

print("Saved verification samples to data/verification_samples.json")
