import re

with open('main.bundle.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

print("Bundle character count:", len(text))

# Search for endpoint URLs or API paths
urls = set(re.findall(r'https?://[^\s"\'<>]+', text))
psi_urls = [u for u in urls if 'psi' in u or 'nasa' in u or 'api' in u]
print("\n--- Absolute URLs related to PSI/API ---")
for u in sorted(psi_urls)[:30]:
    print(u)

rel_paths = set(re.findall(r'["\'](/[^"\']*(?:api|investigation|experiment|table|physci)[^"\']*)["\']', text))
print("\n--- Relative paths matching keywords ---")
for r in sorted(rel_paths)[:30]:
    print(r)

# Search for specific terms
for term in ['experimental-table', 'investigation', 'tableData', 'getInvestigation', 'export']:
    occurrences = [m.start() for m in re.finditer(re.escape(term), text, re.IGNORECASE)]
    print(f"\nTerm '{term}': {len(occurrences)} occurrences")
    for pos in occurrences[:3]:
        snippet = text[max(0, pos - 100):min(len(text), pos + 150)]
        print("  Snippet:", snippet.replace('\n', ' '))
