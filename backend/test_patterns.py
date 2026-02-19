import re

text = "My daughter spends long hours on social media every day and becomes extremely angry when her phone is taken away. Her school performance has dropped significantly, and she avoids family interactions."

complaint_lower = text.lower()

print("Testing pattern matching:\n")

# School patterns
school_patterns = [
    r'\bmiss(?:ed|ing)?\s+school\b',
    r'\babsent\b',
    r'\bgrades?\s+(?:dropped|falling|decreased|low|decline)\b',
    r'\bacademic\s+(?:problems?|issues?|decline)\b',
    r'\bfailing\b.*\bschool\b',
    r'\bhomework\b.*\b(?:not|never|didn\'?t)\b',
    r'\b(?:not|never)\b.*\b(?:study|studying)\b',
    r'\bschool\s+performance\b.*\b(?:dropped|declining|poor|worse)\b',
    r'\bperformance\b.*\bdropped\b'
]

print("School patterns:")
for pattern in school_patterns:
    match = re.search(pattern, complaint_lower)
    if match:
        print(f"  ✓ MATCHED: {pattern}")
        print(f"     Found: '{match.group()}'")
        break
else:
    print("  ✗ No match")

# Addiction patterns
addiction_patterns = [
    r'\bangry\b.*\bphone\b.*\b(?:taken|take|away)\b',
    r'\bphone\b.*\b(?:taken|take|away)\b.*\bangry\b',
    r'\bextremely\s+angry\b',
    r'\baddicted\b',
    r'\baddiction\b',
    r'\bcan\'?t\s+stop\b',
    r'\bwithdrawa?l\b',
    r'\bobsessed\b',
    r'\blong\s+hours\b.*\bsocial\s+media\b',
    r'\bspends?\s+(?:all|entire|whole)\s+(?:day|time)\b'
]

print("\nAddiction patterns:")
for pattern in addiction_patterns:
    match = re.search(pattern, complaint_lower)
    if match:
        print(f"  ✓ MATCHED: {pattern}")
        print(f"     Found: '{match.group()}'")
        break
else:
    print("  ✗ No match")

# Isolation patterns
isolation_patterns = [
    r'\bavoid(?:s|ing)?\s+(?:family|us|me|interaction)\b',
    r'\bisolate(?:d|s)?\b',
    r'\bno\s+(?:social|friends)\b',
    r'\bwithdrawn\b',
    r'\bdoesn\'?t\s+(?:talk|speak|interact)\b',
    r'\bstays?\s+(?:in|alone)\b',
    r'\broom\b.*\balone\b',
    r'\bavoid(?:s|ing)?\s+(?:people|everyone|others)\b'
]

print("\nIsolation patterns:")
for pattern in isolation_patterns:
    match = re.search(pattern, complaint_lower)
    if match:
        print(f"  ✓ MATCHED: {pattern}")
        print(f"     Found: '{match.group()}'")
        break
else:
    print("  ✗ No match")
