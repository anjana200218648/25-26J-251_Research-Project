import smtplib
import ssl
from email.message import EmailMessage
from config.email_config import EMAIL_CONFIG
import logging
import os

def send_email(recipient: str, report_link: str):
    msg = EmailMessage()
    msg["Subject"] = "MindGuard Final Report Alert"
    msg["From"] = EMAIL_CONFIG["sender_email"]
    msg["To"] = recipient
    msg.set_content(f"A new risk assessment report is available. Download: {report_link}")
    html = f"""
    <html><body>
    <p>Dear Recipient,</p>
    <p>A new risk assessment report is available.<br>
    <a href='{report_link}'>Download the report</a></p>
    <p>Best regards,<br>MindGuard System</p>
    </body></html>
    """
    msg.add_alternative(html, subtype="html")
    if pdf_attachment_path and os.path.exists(pdf_attachment_path):
        with open(pdf_attachment_path, "rb") as f:
            msg.add_attachment(f.read(), maintype="application", subtype="pdf", filename=os.path.basename(pdf_attachment_path))
    context = ssl.create_default_context()
    with smtplib.SMTP(EMAIL_CONFIG["smtp_server"], EMAIL_CONFIG["smtp_port"]) as server:
        server.starttls(context=context)
        server.login(EMAIL_CONFIG["sender_email"], EMAIL_CONFIG["sender_password"])
        server.send_message(msg)
        logging.info(f"Email sent to {recipient_email}")
        return True
    except Exception as e:
        logging.error(f"Failed to send email to {recipient_email}: {e}")
        return False

def send_email_with_attachment(recipient_email, pdf_path, report_data=None):
    msg = EmailMessage()
    msg["Subject"] = "MindGuard PDF Report Attached"
    msg["From"] = formataddr(("MindGuard System", EMAIL_CONFIG["sender_email"]))
    msg["To"] = recipient_email
    html = f"<html><body><p>Dear Recipient,</p>"
    if report_data:
        html += f"<p>Case ID: {report_data.get('case_id', 'N/A')}</p>"
        html += "<ul>"
        for k, v in report_data.get('flags', {}).items():
            html += f"<li>{k}: {v}</li>"
        html += "</ul>"
    html += "<p>See attached PDF report.</p><p>Best regards,<br>MindGuard System</p></body></html>"
    msg.set_content("Please see attached PDF report.")
    msg.add_alternative(html, subtype="html")
    if os.path.exists(pdf_path):
        with open(pdf_path, "rb") as f:
            msg.add_attachment(f.read(), maintype="application", subtype="pdf", filename=os.path.basename(pdf_path))
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(EMAIL_CONFIG["smtp_server"], EMAIL_CONFIG["smtp_port"], timeout=EMAIL_SETTINGS["timeout"]) as server:
            if EMAIL_SETTINGS.get("use_tls", True):
                server.starttls(context=context)
            server.login(EMAIL_CONFIG["sender_email"], EMAIL_CONFIG["sender_password"])
            server.send_message(msg)
        logging.info(f"Email with attachment sent to {recipient_email}")
        return True
    except Exception as e:
        logging.error(f"Failed to send email with attachment to {recipient_email}: {e}")
        return False
