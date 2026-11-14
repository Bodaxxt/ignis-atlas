with open('main.bundle.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

pos = text.find('getDataURL(')
if pos == -1:
    pos = text.find('getDataURL')

while pos != -1:
    print("=== getDataURL Context ===")
    print(text[max(0, pos - 150):min(len(text), pos + 350)])
    pos = text.find('getDataURL', pos + 1)
    if pos > 2000000: break
