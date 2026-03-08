"""
Example script to process a generated PDF report and trigger email notifications.
"""
import sys
from backend.services.report_access_controller import process_report

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python process_report_example.py <report.pdf> <secure_report_link>")
        sys.exit(1)
    pdf_path = sys.argv[1]
    report_link = sys.argv[2]
    process_report(pdf_path, report_link)
    print("Processing complete. Emails sent if required.")
