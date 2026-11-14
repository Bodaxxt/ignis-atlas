import re

with open('main.bundle.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Look for getPresignedURL
pos = text.find('getPresignedURL(')
if pos != -1:
    print("=== getPresignedURL ===")
    print(text[max(0, pos - 100):min(len(text), pos + 400)])

# Look for /source/file or download endpoints
matches = re.findall(r'["\'](/[^"\']*(?:file|download|source)[^"\']*)["\']', text)
print("\n=== Matching download/file endpoints ===")
for m in set(matches)[:20]:
    print(m)
