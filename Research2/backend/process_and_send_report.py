import os
import logging
import smtplib
from email.message import EmailMessage
from PyPDF2 import PdfMerger, PdfReader
from typing import List, Dict

# Configuration dictionary for email credentials and authorized emails
CONFIG = {
    'EMAIL_HOST': 'smtp.gmail.com',
    'EMAIL_PORT': 587,
    'EMAIL_USER': 'your_email@gmail.com',  # Replace with your email
    'EMAIL_PASS': 'your_app_password',     # Use App Password, not your main password
    'AUTHORIZED_EMAILS': {
        'psychologist': 'yasi20000422@gmail.com',
        'cert': 'hasinduweerakkodi453@gmail.com',
        'police': 'deranatv30@gmail.com',
    }
}

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[logging.StreamHandler()]
)

def combine_pdfs(pdf_paths: List[str], output_path: str) -> None:
    """Combine multiple PDFs into a single PDF."""
    merger = PdfMerger()
    try:
        for path in pdf_paths:
            if not os.path.exists(path):
                raise FileNotFoundError(f"File not found: {path}")
            merger.append(path)
        merger.write(output_path)
        merger.close()
        logging.info(f"Combined PDF generated at {output_path}")
    except Exception as e:
        logging.error(f"Error combining PDFs: {e}")
        raise

def ai_risk_analysis(pdf_path: str) -> Dict[str, str]:
    """
    Dummy AI risk analysis. Replace with real AI model integration.
    Returns a dictionary of flags with 'YES' or 'NO'.
    """
    # For demonstration, randomly set some flags to YES/NO
    # In production, replace with actual AI analysis logic
    import random
    flags = [
        'Addiction Detected',
        'Medical Help Required',
        'Counselling Recommended',
        'Content Removal Required',
        'Legal Action Required',
        'Authority Notification',
        'Extended Observation Mode',
    ]
    result = {flag: random.choice(['YES', 'NO']) for flag in flags}
    logging.info(f"AI risk analysis flags: {result}")
    return result

def append_analysis_to_pdf(input_pdf: str, analysis: Dict[str, str], output_pdf: str) -> None:
    """
    Append AI risk analysis as a new page to the PDF.
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from PyPDF2 import PdfMerger
    import tempfile

    # Create a temporary PDF with the analysis
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp:
        c = canvas.Canvas(temp.name, pagesize=letter)
        c.setFont("Helvetica", 14)
        c.drawString(72, 720, "AI Risk Analysis Flags:")
        y = 700
        for flag, value in analysis.items():
            c.drawString(90, y, f"{flag}: {value}")
            y -= 20
        c.save()
        analysis_pdf = temp.name

    # Merge the original PDF and the analysis PDF
    merger = PdfMerger()
    merger.append(input_pdf)
    merger.append(analysis_pdf)
    merger.write(output_pdf)
    merger.close()
    os.remove(analysis_pdf)
    logging.info(f"Final PDF with analysis generated at {output_pdf}")

def determine_recipients(flags: Dict[str, str], config: Dict) -> List[str]:
    """Determine recipients based on flags."""
    recipients = set()
    if flags.get('Addiction Detected') == 'YES' or flags.get('Counselling Recommended') == 'YES':
        recipients.add(config['AUTHORIZED_EMAILS']['psychologist'])
    if flags.get('Content Removal Required') == 'YES':
        recipients.add(config['AUTHORIZED_EMAILS']['cert'])
    if flags.get('Legal Action Required') == 'YES':
        recipients.add(config['AUTHORIZED_EMAILS']['police'])
    logging.info(f"Recipients determined: {recipients}")
    return list(recipients)

def send_email_with_attachment(subject: str, body: str, to_emails: List[str], attachment_path: str, config: Dict) -> None:
    """Send an email with the PDF attachment via Gmail SMTP (TLS)."""
    try:
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = config['EMAIL_USER']
        msg['To'] = ', '.join(to_emails)
        msg.set_content(body)

        with open(attachment_path, 'rb') as f:
            file_data = f.read()
            file_name = os.path.basename(attachment_path)
        msg.add_attachment(file_data, maintype='application', subtype='pdf', filename=file_name)

        with smtplib.SMTP(config['EMAIL_HOST'], config['EMAIL_PORT']) as smtp:
            smtp.starttls()
            smtp.login(config['EMAIL_USER'], config['EMAIL_PASS'])
            smtp.send_message(msg)
        logging.info(f"Email sent to: {to_emails}")
    except Exception as e:
        logging.error(f"Error sending email: {e}")
        raise

def process_reports(media_pdf: str, complaint_pdf: str, config: Dict = CONFIG) -> None:
    """
    Main function to process uploaded PDFs, generate final report, scan flags, and send email.
    """
    try:
        # 1. Combine PDFs
        combined_pdf = 'combined_report.pdf'
        combine_pdfs([media_pdf, complaint_pdf], combined_pdf)

        # 2. AI risk analysis
        flags = ai_risk_analysis(combined_pdf)

        # 3. Append analysis to PDF
        final_pdf = 'final_report.pdf'
        append_analysis_to_pdf(combined_pdf, flags, final_pdf)

        # 4. Determine recipients
        recipients = determine_recipients(flags, config)
        if not recipients:
            logging.info("No recipients match the detected flags. No email sent.")
            return

        # 5. Send email
        subject = "Automated Risk Analysis Report"
        body = "Please find attached the final risk analysis report."
        send_email_with_attachment(subject, body, recipients, final_pdf, config)

        logging.info("Process completed successfully.")
    except FileNotFoundError as fnf:
        logging.error(fnf)
    except Exception as e:
        logging.error(f"Unexpected error: {e}")

# Example usage (uncomment and set real file paths to use):
# process_reports('media_report.pdf', 'complaint_report.pdf')
