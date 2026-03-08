"""
Test script to verify email sending via Gmail SMTP.
Replace 'recipient_email' and 'report_link' with your test values.
"""
from backend.utils.email_sender import send_email

if __name__ == "__main__":
    recipient_email = "weerahasindu@gmail.com"  # Change to your test email
    report_link = "https://example.com/report/123"  # Dummy link
    try:
        send_email(recipient_email, report_link)
        print("Email sent successfully!")
    except Exception as e:
        print(f"Failed to send email: {e}")
