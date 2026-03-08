from backend.utils.pdf_scanner import extract_decision_fields
from backend.utils.email_sender import send_email
from backend.config.email_config import EMAIL_CONFIG

# Map decision to role
DECISION_TO_ROLE = {
    "Addiction Detected": "psychologist",
    "Legal Action Required": "police",
    "Authority Notification": "cert"
}

def process_report(pdf_path: str, report_link: str):
    """
    Scans the PDF, checks decisions, and sends emails to authorized parties.
    """
    decisions = extract_decision_fields(pdf_path)
    for field, role in DECISION_TO_ROLE.items():
        if decisions.get(field, "No") == "Yes":
            recipient = EMAIL_CONFIG["authorized_emails"][role]
            send_email(recipient, report_link)
