def extract_decision_fields(pdf_path):
def extract_decision_fields(pdf_path):
def extract_decision_fields(pdf_path):
def extract_decision_fields(pdf_path):
import fitz  # PyMuPDF
import re
import logging
from pathlib import Path

def extract_decision_fields(pdf_path):
    """
    Extracts decision flags from a PDF file using PyMuPDF.
    Args:
        pdf_path (str): Path to the PDF file.
    Returns:
        dict: Dictionary with flag names as keys and 'Yes'/'No' as values.
    """
    flags = [
        "Addiction Detected",
        "Medical Help Required",
        "Counselling Recommended",
        "Content Removal Required",
        "Legal Action Required",
        "Authority Notification",
        "Extended Observation Mode"
    ]
    results = {flag: "No" for flag in flags}
    try:
        pdf_path = str(pdf_path)
        doc = fitz.open(pdf_path)
        text = "\n".join(page.get_text() for page in doc)
        for flag in flags:
            match = re.search(rf"{re.escape(flag)}\s*:\s*(Yes|No)", text, re.IGNORECASE)
            if match:
                results[flag] = match.group(1).capitalize()
        doc.close()
        logging.info(f"Extracted flags from {pdf_path}: {results}")
    except Exception as e:
        logging.error(f"Failed to scan PDF for flags: {e}")
    return results

if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) < 2:
        print("Usage: python pdf_scanner.py <pdf_path>")
    else:
        pdf_path = sys.argv[1]
        flags = extract_decision_fields(pdf_path)
        print("Extracted Flags:")
        for k, v in flags.items():
            print(f"{k}: {v}")
    import sys
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) < 2:
        print("Usage: python pdf_scanner.py <pdf_path>")
    else:
        pdf_path = sys.argv[1]
        flags = extract_decision_fields(pdf_path)
        print("Extracted Flags:")
        for k, v in flags.items():
            print(f"{k}: {v}")
