import os
import glob
import json
import pandas as pd
import numpy as np

INVESTIGATIONS = [
    "PSI-25", "PSI-26", "PSI-98", "PSI-99", "PSI-100",
    "PSI-68", "PSI-69", "PSI-39", "PSI-159", "PSI-10",
    "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-106",
    "PSI-107", "PSI-102", "PSI-101", "PSI-47"
]

summary_rows = []
verification_samples = {}

for psi_id in INVESTIGATIONS:
    csv_path = f"data/tables/{psi_id}.csv"
    raw_candidates = glob.glob(f"data/raw/{psi_id}_Experimental table*.*")
    raw_path = raw_candidates[0] if raw_candidates else "N/A"
    raw_filename = os.path.basename(raw_path) if raw_path != "N/A" else "column not present"

    if not os.path.exists(csv_path):
        summary_rows.append({
            "investigation": psi_id,
            "status": "MISSING",
            "table_file": raw_filename,
            "row_count": 0,
            "columns": "column not present",
            "o2_col": "column not present",
            "o2_min": "column not present",
            "o2_max": "column not present",
            "o2_non_empty": "column not present",
            "o2_distinct": "column not present",
            "pressure_col": "column not present",
            "pressure_min": "column not present",
            "pressure_max": "column not present",
            "pressure_non_empty": "column not present",
            "pressure_distinct": "column not present",
            "flow_col": "column not present",
            "flow_min": "column not present",
            "flow_max": "column not present",
            "flow_non_empty": "column not present",
            "flow_distinct": "column not present",
            "material_col": "column not present",
            "material_distinct": "column not present"
        })
        continue

    try:
        df = pd.read_csv(csv_path)
    except Exception:
        df = pd.read_csv(csv_path, encoding="latin1")

    cols = list(df.columns)

    # Clean heuristic for O2, Pressure, Flow, Fuel/Material
    o2_col = next((c for c in cols if any(k in c.lower() for k in ["o2", "oxygen", "o₂"]) and not "co2" in c.lower()), None)
    press_col = next((c for c in cols if any(k in c.lower() for k in ["pressure", "press", "psi", "kpa", "atm", "chamber p"])), None)
    flow_col = next((c for c in cols if any(k in c.lower() for k in ["airflow", "flow", "velocity", "fan"])), None)
    mat_col = next((c for c in cols if any(k in c.lower() for k in ["material", "fuel", "sample", "substrate"])), None)

    def compute_col_metrics(col):
        if not col or col not in df:
            return "column not present", "column not present", "column not present", "column not present"
        s = df[col].dropna()
        ne = int(len(s))
        dist = int(s.nunique())
        num = pd.to_numeric(s.astype(str).str.extract(r"([-+]?\d*\.?\d+)", expand=False), errors="coerce").dropna()
        if len(num) > 0:
            c_min = float(num.min())
            c_max = float(num.max())
        else:
            c_min = "non-numeric"
            c_max = "non-numeric"
        return c_min, c_max, ne, dist

    o2_min, o2_max, o2_ne, o2_dist = compute_col_metrics(o2_col)
    p_min, p_max, p_ne, p_dist = compute_col_metrics(press_col)
    f_min, f_max, f_ne, f_dist = compute_col_metrics(flow_col)
    _, _, _, mat_dist = compute_col_metrics(mat_col)

    summary_rows.append({
        "investigation": psi_id,
        "status": "PARSED_OK",
        "table_file": raw_filename,
        "row_count": int(len(df)),
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

    # Pick 5 random verification rows
    np.random.seed(42)
    sample_indices = np.random.choice(len(df), size=min(5, len(df)), replace=False)
    raw_lines = []
    if os.path.exists(raw_path):
        with open(raw_path, "r", encoding="utf-8", errors="ignore") as rf:
            raw_lines = rf.readlines()

    sample_list = []
    for s_idx in sample_indices:
        raw_line_num = int(s_idx + 2) if (s_idx + 2 <= len(raw_lines)) else int(len(raw_lines))
        raw_line_text = raw_lines[raw_line_num - 1].strip() if raw_lines else "N/A"
        sample_list.append({
            "row_index": int(s_idx),
            "raw_line_num": int(raw_line_num),
            "raw_line_text": raw_line_text[:120] + "..." if len(raw_line_text) > 120 else raw_line_text
        })
    verification_samples[psi_id] = sample_list

# Save data/summary.csv
summary_df = pd.DataFrame(summary_rows)
summary_df.to_csv("data/summary.csv", index=False)

# Save data/verification_samples.json
with open("data/verification_samples.json", "w", encoding="utf-8") as f:
    json.dump(verification_samples, f, indent=2)

print(f"COMPLETE: All {len(summary_df)} investigations processed and saved to data/summary.csv")
