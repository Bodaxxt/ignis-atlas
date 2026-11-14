import re

with open('main.bundle.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Look around 'totalRecords' and 'setTableCache' and HTTP client calls
idx = text.find('totalRecords')
while idx != -1:
    print("=== totalRecords Context ===")
    print(text[max(0, idx - 400):min(len(text), idx + 400)])
    print("=" * 40)
    idx = text.find('totalRecords', idx + 1)
    if idx > 3000000: break

# Look for http get/post calls
http_calls = [m.start() for m in re.finditer(r'\.http\.(?:get|post)\(', text)]
print(f"Found {len(http_calls)} http.get/post calls")
for h in http_calls[:10]:
    print("--- HTTP CALL ---")
    print(text[max(0, h - 100):min(len(text), h + 250)])
