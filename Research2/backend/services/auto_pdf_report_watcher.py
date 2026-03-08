"""
Automatically watches for new PDF reports, scans them, and sends emails to authorized parties.
Place this script in your backend service to run continuously.
"""
import os
import time
from backend.services.report_access_controller import process_report

WATCH_DIR = os.path.join(os.path.dirname(__file__), '../../reports')  # Change as needed
PROCESSED_DIR = os.path.join(WATCH_DIR, 'processed')
REPORT_LINK_TEMPLATE = "https://yourdomain.com/reports/{filename}"

os.makedirs(PROCESSED_DIR, exist_ok=True)

def is_pdf(filename):
    return filename.lower().endswith('.pdf')

def main():
    print(f"Watching for new PDF reports in: {WATCH_DIR}")
    processed = set(os.listdir(PROCESSED_DIR))
    while True:
        for fname in os.listdir(WATCH_DIR):
            if not is_pdf(fname):
                continue
            if fname in processed:
                continue
            pdf_path = os.path.join(WATCH_DIR, fname)
            report_link = REPORT_LINK_TEMPLATE.format(filename=fname)
            try:
                process_report(pdf_path, report_link)
                print(f"Processed and emailed for: {fname}")
                # Move to processed
                os.rename(pdf_path, os.path.join(PROCESSED_DIR, fname))
                processed.add(fname)
            except Exception as e:
                print(f"Error processing {fname}: {e}")
        time.sleep(10)  # Check every 10 seconds

if __name__ == "__main__":
    main()
