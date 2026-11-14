import re

with open('main.bundle.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Look for _c definition or baseURL
pos = text.find('baseURL')
while pos != -1:
    print("=== baseURL ===")
    print(text[max(0, pos - 100):min(len(text), pos + 200)])
    pos = text.find('baseURL', pos + 1)
    if pos > 2000000: break

# Look for getSampleAssayTable
pos = text.find('getSampleAssayTable(')
if pos != -1:
    print("\n=== getSampleAssayTable Definition ===")
    print(text[max(0, pos - 150):min(len(text), pos + 400)])

# Look for studiesList or investigation URL mapping
pos = text.find('studiesList')
if pos != -1:
    print("\n=== studiesList ===")
    print(text[max(0, pos - 150):min(len(text), pos + 250)])
