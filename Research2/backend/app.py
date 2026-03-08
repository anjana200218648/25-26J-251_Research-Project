"""
Flask Backend API for AI Risk Assessment System
Handles file uploads, report analysis, and PDF generation
"""

import os
import sys
from pathlib import Path

# Ensure the backend directory is in sys.path for absolute imports
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import logging
from datetime import datetime
from sqlalchemy import text

# Add src to Python path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from config import DATABASE_URL
from models import db, Report
from report_parser import ReportParser
from risk_analyzer import RiskAnalyzer
from report_generator import ReportGenerator
try:
    # Optional: only present if you added blockchain notarization module
    from blockchain_notarization import notarize_pdf_report, verify_pdf_against_blockchain, compute_file_sha256, get_hash_from_chain
except Exception:
    notarize_pdf_report = None
    verify_pdf_against_blockchain = None
    compute_file_sha256 = None
    get_hash_from_chain = None

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Configuration
UPLOAD_FOLDER = PROJECT_ROOT / 'uploads'
OUTPUT_FOLDER = PROJECT_ROOT / 'outputs'
ALLOWED_EXTENSIONS = {'pdf'}

UPLOAD_FOLDER.mkdir(exist_ok=True)
OUTPUT_FOLDER.mkdir(exist_ok=True)

app.config['UPLOAD_FOLDER'] = str(UPLOAD_FOLDER)
app.config['OUTPUT_FOLDER'] = str(OUTPUT_FOLDER)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db.init_app(app)

# Create tables
with app.app_context():
    db.create_all()
    # Ensure new notarization columns exist even without Alembic
    try:
        db.session.execute(text("ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_hash VARCHAR(64)"))
        db.session.execute(text("ALTER TABLE reports ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(66)"))
        db.session.execute(text("ALTER TABLE reports ADD COLUMN IF NOT EXISTS blockchain_block_number INTEGER"))
        db.session.execute(text("ALTER TABLE reports ADD COLUMN IF NOT EXISTS blockchain_status VARCHAR(32)"))
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Schema ensure failed (reports notarization columns): {str(e)}", exc_info=True)

# Initialize AI components
logger.info("Initializing AI models...")
parser = ReportParser(model_name="google/flan-t5-base", use_gpu=False)
analyzer = RiskAnalyzer()
generator = ReportGenerator(model_name="google/flan-t5-base", use_gpu=False)
logger.info("AI models initialized successfully!")


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'AI Risk Assessment System is running',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/generate-latest-reports', methods=['POST'])
def generate_latest_reports():
    """
    Generate PDF reports from latest database entries
    Reads from media_risk_reports and complaints tables with correct column names
    """
    try:
        from sqlalchemy import text
        import json
        from datetime import datetime
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        
        logger.info("="*60)
        logger.info("GENERATE LATEST REPORTS ENDPOINT CALLED")
        logger.info("="*60)
        
        # Reset session first
        db.session.rollback()
        
        # Get latest media report
        logger.info("Fetching latest media report...")
        media_query = text('SELECT * FROM "media_risk_reports" ORDER BY id DESC LIMIT 1')
        media_result = db.session.execute(media_query)
        media_row = media_result.fetchone()
        
        # Get latest complaint
        logger.info("Fetching latest complaint...")
        complaint_query = text('SELECT * FROM "complaints" ORDER BY timestamp DESC LIMIT 1')
        complaint_result = db.session.execute(complaint_query)
        complaint_row = complaint_result.fetchone()
        
        # Check if data exists
        missing = []
        if not media_row:
            missing.append("media_risk_reports")
            logger.error("❌ No data found in media_risk_reports table")
            
        if not complaint_row:
            missing.append("complaints")
            logger.error("❌ No data found in complaints table")
        
        if missing:
            error_msg = f'No data found in tables: {", ".join(missing)}'
            logger.error(error_msg)
            return jsonify({
                'success': False,
                'error': error_msg
            }), 404
        
        # Convert to dictionaries
        media_data = dict(media_row._mapping)
        complaint_data = dict(complaint_row._mapping)
        
        logger.info(f"Media report ID: {media_data.get('id')}")
        logger.info(f"Complaint ID: {complaint_data.get('id')}")
        
        # Generate timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Generate Media PDF
        media_pdf_filename = f'media_report_{timestamp}.pdf'
        media_pdf_path = Path(app.config['OUTPUT_FOLDER']) / media_pdf_filename
        
        # Generate Complaint PDF
        complaint_pdf_filename = f'complaint_report_{timestamp}.pdf'
        complaint_pdf_path = Path(app.config['OUTPUT_FOLDER']) / complaint_pdf_filename
        
        # ========== GENERATE MEDIA RISK REPORT PDF ==========
        logger.info("Generating Media Risk Report PDF...")
        doc = SimpleDocTemplate(
            str(media_pdf_path),
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18,
        )
        
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        story.append(Paragraph("Media Risk Assessment Report", styles['Title']))
        story.append(Spacer(1, 12))
        
        # Basic Information
        story.append(Paragraph("Basic Information", styles['Heading2']))
        story.append(Spacer(1, 6))
        
        basic_data = [
            ['Field', 'Value'],
            ['ID', str(media_data.get('id', 'N/A'))],
            ['Filename', str(media_data.get('filename', 'N/A'))],
            ['Risk Score', str(media_data.get('risk_score', 'N/A'))],
            ['Risk Level', str(media_data.get('risk_level', 'N/A'))],
            ['Prediction', str(media_data.get('prediction', 'N/A'))],
        ]
        
        basic_table = Table(basic_data, colWidths=[2*inch, 3.5*inch])
        basic_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(basic_table)
        story.append(Spacer(1, 12))
        
        # Extracted Text
        if media_data.get('extracted_text'):
            story.append(Paragraph("Extracted Text", styles['Heading2']))
            story.append(Spacer(1, 6))
            text_sample = str(media_data['extracted_text'])[:500] + "..." if len(str(media_data['extracted_text'])) > 500 else str(media_data['extracted_text'])
            story.append(Paragraph(text_sample, styles['Normal']))
            story.append(Spacer(1, 12))
        
        doc.build(story)
        logger.info(f"Media PDF generated: {media_pdf_filename}")
        
        # ========== GENERATE COMPLAINT REPORT PDF ==========
        logger.info("Generating Complaint Report PDF...")
        doc = SimpleDocTemplate(
            str(complaint_pdf_path),
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18,
        )
        
        story = []
        
        # Title
        story.append(Paragraph("Complaint Report", styles['Title']))
        story.append(Spacer(1, 12))
        
        # Basic Information
        story.append(Paragraph("Basic Information", styles['Heading2']))
        story.append(Spacer(1, 6))
        
        complaint_basic = [
            ['Field', 'Value'],
            ['ID', str(complaint_data.get('id', 'N/A'))],
            ['Risk Level', str(complaint_data.get('risk_level', 'N/A'))],
            ['Region', str(complaint_data.get('region', 'N/A'))],
            ['Reporter Role', str(complaint_data.get('reporter_role', 'N/A'))],
        ]
        
        complaint_table = Table(complaint_basic, colWidths=[2*inch, 3.5*inch])
        complaint_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(complaint_table)
        story.append(Spacer(1, 12))
        
        # Complaint Text
        if complaint_data.get('text'):
            story.append(Paragraph("Complaint Text", styles['Heading2']))
            story.append(Spacer(1, 6))
            text_sample = str(complaint_data['text'])[:500] + "..." if len(str(complaint_data['text'])) > 500 else str(complaint_data['text'])
            story.append(Paragraph(text_sample, styles['Normal']))
        
        doc.build(story)
        logger.info(f"Complaint PDF generated: {complaint_pdf_filename}")
        
        # Return success response
        return jsonify({
            'success': True,
            'message': 'Reports generated successfully',
            'timestamp': timestamp,
            'media_report_id': media_data.get('id'),
            'complaint_id': complaint_data.get('id'),
            'media_report_url': f'/api/download/{media_pdf_filename}',
            'complaint_report_url': f'/api/download/{complaint_pdf_filename}',
            'media_filename': media_pdf_filename,
            'complaint_filename': complaint_pdf_filename
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating latest reports: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'Failed to generate reports: {str(e)}'
        }), 500
@app.route('/api/analyze', methods=['POST'])
def analyze_reports():
    """
    Main endpoint to analyze uploaded reports
    Expects: 'media_report' and 'complaint_report' files
    Returns: Analysis results and generated report
    """
    try:
        # Validate files
        if 'media_report' not in request.files or 'complaint_report' not in request.files:
            return jsonify({
                'error': 'Both media_report and complaint_report files are required'
            }), 400

        media_file = request.files['media_report']
        complaint_file = request.files['complaint_report']

        if media_file.filename == '' or complaint_file.filename == '':
            return jsonify({
                'error': 'Both files must have valid filenames'
            }), 400

        if not (allowed_file(media_file.filename) and allowed_file(complaint_file.filename)):
            return jsonify({
                'error': 'Only PDF files are allowed'
            }), 400

        # Save uploaded files
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        media_filename = secure_filename(f'media_{timestamp}_{media_file.filename}')
        complaint_filename = secure_filename(f'complaint_{timestamp}_{complaint_file.filename}')
        
        media_path = Path(app.config['UPLOAD_FOLDER']) / media_filename
        complaint_path = Path(app.config['UPLOAD_FOLDER']) / complaint_filename
        
        media_file.save(str(media_path))
        complaint_file.save(str(complaint_path))
        
        logger.info(f"Files uploaded: {media_filename}, {complaint_filename}")

        # Step 1: Parse both reports
        logger.info("Parsing reports...")
        parsed_data = parser.parse_both_reports(
            str(media_path),
            str(complaint_path)
        )
        
        media_data = parsed_data['media_report']
        complaint_data = parsed_data['complaint_report']

        # Step 2: Analyze risk
        logger.info("Analyzing risk...")
        analysis_results = analyzer.analyze(media_data, complaint_data)

        # Step 3: Generate final report
        logger.info("Generating final report...")
        output_filename = f'final_report_{timestamp}.pdf'
        output_path = Path(app.config['OUTPUT_FOLDER']) / output_filename
        
        generator.generate_report(
            media_data=media_data,
            complaint_data=complaint_data,
            analysis_results=analysis_results,
            output_path=str(output_path)
        )

        # Generate text report
        text_report = generator.generate_text_report(
            media_data=media_data,
            complaint_data=complaint_data,
            analysis_results=analysis_results
        )

        logger.info(f"Report generated successfully: {output_filename}")

        # Defaults so frontend can always read results.report_id and results.notarization.*
        report_id = None
        notarization_info = {
            'pdf_hash': None,
            'blockchain_tx_hash': None,
            'blockchain_block_number': None,
            'blockchain_status': 'SKIPPED' if notarize_pdf_report is None else 'PENDING',
            'error': None
        }

        # Save to database (Step 6)
        try:
            report = Report(
                filename=output_filename,
                media_analysis_content=str(media_data),
                complaint_analysis_content=str(complaint_data),
                final_report_content=str(analysis_results),
                risk_score=analysis_results.get('unified_risk_score'),
                conflict_level=analysis_results.get('conflict_type')
            )
            db.session.add(report)
            db.session.commit()
            logger.info(f"Report saved to database: {report.id}")
            report_id = report.id

            # Step 7–9 (optional): hash + blockchain notarization
            if notarize_pdf_report is not None:
                try:
                    res = notarize_pdf_report(report=report, pdf_path=output_path)
                    if isinstance(res, dict):
                        notarization_info.update(res)
                except Exception as n_err:
                    logger.error(f"Notarization failed for report {report.id}: {str(n_err)}", exc_info=True)
                    notarization_info['blockchain_status'] = 'FAILED'
                    notarization_info['error'] = str(n_err)
        except Exception as db_error:
            logger.error(f"Failed to save report to database: {str(db_error)}")
            notarization_info['blockchain_status'] = 'FAILED'
            notarization_info['error'] = f"DB save failed: {str(db_error)}"

        # --- EMAIL NOTIFICATION BLOCK ---
        try:
            from utils.pdf_scanner import extract_decision_fields
            from utils.email_sender import send_email
            from config.email_config import EMAIL_CONFIG
            flag_dict = extract_decision_fields(str(output_path))
            recipients = set()
            # Map flags to roles and collect recipients
            if flag_dict.get("Addiction Detected", "No").lower() == "yes" or flag_dict.get("Counselling Recommended", "No").lower() == "yes":
                recipients.add(EMAIL_CONFIG["authorized_emails"]["psychologist"])
            if flag_dict.get("Content Removal Required", "No").lower() == "yes":
                recipients.add(EMAIL_CONFIG["authorized_emails"]["cert"])
            if flag_dict.get("Legal Action Required", "No").lower() == "yes":
                recipients.add(EMAIL_CONFIG["authorized_emails"]["police"])
            report_link = request.host_url.rstrip("/") + f"/api/download/{output_filename}"
            sent = set()
            for recipient in recipients:
                if recipient not in sent:
                    try:
                        send_email(recipient, report_link)
                        logger.info(f"Email sent to {recipient}")
                        sent.add(recipient)
                    except Exception as mail_err:
                        logger.error(f"Failed to send email to {recipient}: {mail_err}")
            logger.info(f"Total emails sent: {len(sent)}")
        except Exception as e:
            logger.error(f"Error in email notification logic: {e}")

        # Prepare response
        response_data = {
            'success': True,
            'message': 'Analysis completed successfully',
            'timestamp': timestamp,
            'report_id': report_id,
            'analysis': {
                'media_risk_score': analysis_results['media_risk']['raw_score'],
                'complaint_risk_score': analysis_results['complaint_risk']['raw_score'],
                'media_risk_level': analysis_results['media_risk']['risk_level'],
                'complaint_risk_level': analysis_results['complaint_risk']['risk_level'],
                'risk_gap': analysis_results['risk_gap'],
                'conflict_type': analysis_results['conflict_type'],
                'unified_risk_score': analysis_results['unified_risk_score'],
                'confidence_level': analysis_results['confidence_level'],
                'requires_manual_review': analysis_results['requires_manual_review'],
                'summary': analysis_results['analysis_summary']
            },
            'report_url': f'/api/download/{output_filename}',
            'text_report': text_report,
            'notarization': {
                'pdf_hash': notarization_info.get('pdf_hash'),
                'blockchain_tx_hash': notarization_info.get('blockchain_tx_hash'),
                'blockchain_block_number': notarization_info.get('blockchain_block_number'),
                'blockchain_status': notarization_info.get('blockchain_status'),
                'error': notarization_info.get('error'),
            }
        }

        # Clean up uploaded files (optional)
        # media_path.unlink()
        # complaint_path.unlink()

        return jsonify(response_data), 200

    except Exception as e:
        logger.error(f"Error during analysis: {str(e)}", exc_info=True)
        return jsonify({
            'error': f'Analysis failed: {str(e)}'
        }), 500
@app.route('/api/check-db-name', methods=['GET'])
def check_db_name():
    """Check current database name"""
    try:
        db_name = db.session.execute(text("SELECT current_database()")).scalar()
        return jsonify({
            'current_database': db_name,
            'configured_database': app.config['SQLALCHEMY_DATABASE_URI']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@app.route('/api/reports', methods=['GET'])
def get_reports():
    """
    Get list of all reports from database
    """
    try:
        reports = Report.query.order_by(Report.created_at.desc()).all()
        reports_data = [{
            'id': r.id,
            'filename': r.filename,
            'risk_score': r.risk_score,
            'conflict_level': r.conflict_level,
            'created_at': r.created_at.isoformat()
        } for r in reports]
        return jsonify({'reports': reports_data}), 200
    except Exception as e:
        logger.error(f"Error fetching reports: {str(e)}")
        return jsonify({'error': f'Failed to fetch reports: {str(e)}'}), 500


@app.route('/api/debug-media', methods=['GET'])
def debug_media():
    """Debug media_risk_reports table"""
    try:
        results = {}
        
        # Try different queries
        queries = [
            'SELECT * FROM media_risk_reports LIMIT 1',
            'SELECT * FROM "media_risk_reports" LIMIT 1',
            'SELECT * FROM public.media_risk_reports LIMIT 1',
            'SELECT * FROM public."media_risk_reports" LIMIT 1'
        ]
        
        for q in queries:
            try:
                result = db.session.execute(text(q)).fetchone()
                results[q] = 'Success' if result else 'No data'
            except Exception as e:
                results[q] = f'Error: {str(e)}'
        
        # Get column info
        try:
            columns = db.session.execute(text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'media_risk_reports'
            """)).fetchall()
            results['columns'] = [{'name': c[0], 'type': c[1]} for c in columns]
        except Exception as e:
            results['columns_error'] = str(e)
        
        # Get count
        try:
            count = db.session.execute(text("SELECT COUNT(*) FROM media_risk_reports")).scalar()
            results['row_count'] = count
        except Exception as e:
            results['count_error'] = str(e)
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/reports/<int:report_id>/verify', methods=['GET'])
def verify_report(report_id: int):
    """
    Verify a stored PDF against database hash and blockchain hash.

    Always returns a JSON object with:
      - matches_db
      - matches_blockchain
      - local_hash
      - db_hash
      - blockchain_hash
      - blockchain_status
      - blockchain_tx_hash
      - blockchain_block_number
      - error (optional)
    """
    try:
        report = Report.query.get(report_id)
        if report is None:
            return jsonify({"error": "Report not found"}), 404

        pdf_path = Path(app.config["OUTPUT_FOLDER"]) / report.filename

        # Always return these fields, even if blockchain is missing.
        if verify_pdf_against_blockchain is not None:
            try:
                v = verify_pdf_against_blockchain(report_id=report_id, pdf_path=pdf_path)
                return jsonify({
                    "matches_db": bool(v.get("matches_db")),
                    "matches_blockchain": bool(v.get("matches_blockchain")),
                    "local_hash": v.get("local_hash") or "N/A",
                    "db_hash": v.get("db_hash") or "N/A",
                    "blockchain_hash": v.get("blockchain_hash") or "N/A",
                    "blockchain_status": v.get("blockchain_status") or "SKIPPED",
                    "blockchain_tx_hash": v.get("blockchain_tx_hash") or "N/A",
                    "blockchain_block_number": v.get("blockchain_block_number") if v.get("blockchain_block_number") is not None else "N/A",
                    "error": v.get("error"),
                }), 200
            except Exception as e:
                logger.error("Verification helper failed for report %s: %s", report_id, e, exc_info=True)

        # Fallback if helper missing: compute local+db only
        db_hash = getattr(report, "pdf_hash", None) or "N/A"
        local_hash = "N/A"
        matches_db = False
        error_msg = "Blockchain notarization not available"
        if compute_file_sha256 is not None and pdf_path.exists():
            local_hash = compute_file_sha256(pdf_path)
            if db_hash != "N/A":
                matches_db = (local_hash.lower() == str(db_hash).lower())
        elif not pdf_path.exists():
            error_msg = "PDF file not found for this report"

        return jsonify({
            "matches_db": matches_db,
            "matches_blockchain": False,
            "local_hash": local_hash,
            "db_hash": db_hash,
            "blockchain_hash": "N/A",
            "blockchain_status": getattr(report, "blockchain_status", None) or "SKIPPED",
            "blockchain_tx_hash": getattr(report, "blockchain_tx_hash", None) or "N/A",
            "blockchain_block_number": getattr(report, "blockchain_block_number", None) if getattr(report, "blockchain_block_number", None) is not None else "N/A",
            "error": error_msg,
        }), 200

    except Exception as e:
        logger.error("Unexpected error in verify_report for %s: %s", report_id, e, exc_info=True)
        return jsonify({"error": "Verification failed. Please try again."}), 500


@app.route('/api/reports/verify_external/<int:report_id>', methods=['POST'])
def verify_external_report(report_id: int):
    """
    External verify: uploaded PDF hash vs DB hash vs blockchain hash.
    Expects multipart/form-data with key: file
    """
    try:
        report = Report.query.get(report_id)
        if report is None:
            return jsonify({"error": "Report not found"}), 404

        if "file" not in request.files:
            return jsonify({"error": "No file uploaded (expected form-data key: file)"}), 400

        f = request.files["file"]
        if not f.filename or not f.filename.lower().endswith(".pdf"):
            return jsonify({"error": "Only PDF files are allowed"}), 400

        if compute_file_sha256 is None:
            return jsonify({"error": "Server hashing utility not available"}), 500

        # Save temporarily to hash (no permanent storage required)
        tmp_dir = Path(app.config["UPLOAD_FOLDER"]) / "external_verify"
        tmp_dir.mkdir(exist_ok=True)
        tmp_path = tmp_dir / secure_filename(f"verify_{report_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{f.filename}")
        f.save(str(tmp_path))

        try:
            local_hash = compute_file_sha256(tmp_path)
        finally:
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass

        db_hash = getattr(report, "pdf_hash", None) or "N/A"
        matches_db = (db_hash != "N/A") and (local_hash.lower() == str(db_hash).lower())

        # Blockchain part is optional
        blockchain_hash = "N/A"
        matches_blockchain = False
        error_msg = None

        if get_hash_from_chain is None:
            error_msg = "Blockchain notarization not available"
        else:
            try:
                ch = get_hash_from_chain(report_id)
                if ch:
                    blockchain_hash = ch
                    matches_blockchain = (local_hash.lower() == str(ch).lower())
                else:
                    error_msg = "Blockchain hash not available"
            except Exception as e:
                error_msg = str(e)

        return jsonify({
            "matches_db": matches_db,
            "matches_blockchain": matches_blockchain,
            "local_hash": local_hash or "N/A",
            "db_hash": db_hash,
            "blockchain_hash": blockchain_hash,
            "blockchain_status": getattr(report, "blockchain_status", None) or "SKIPPED",
            "blockchain_tx_hash": getattr(report, "blockchain_tx_hash", None) or "N/A",
            "blockchain_block_number": getattr(report, "blockchain_block_number", None) if getattr(report, "blockchain_block_number", None) is not None else "N/A",
            "error": error_msg,
        }), 200

    except Exception as e:
        logger.error("Unexpected error in verify_external_report for %s: %s", report_id, e, exc_info=True)
        return jsonify({"error": "Verification failed. Please try again."}), 500


@app.route('/api/download/<filename>', methods=['GET'])
def download_report(filename):
    """Download generated report"""
    try:
        file_path = Path(app.config['OUTPUT_FOLDER']) / filename
        
        if not file_path.exists():
            return jsonify({
                'error': 'Report not found'
            }), 404
        
        return send_file(
            str(file_path),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
    
    except Exception as e:
        logger.error(f"Error downloading report: {str(e)}")
        return jsonify({
            'error': f'Download failed: {str(e)}'
        }), 500


if __name__ == '__main__':
    print("\n" + "="*60)
    print("AI Risk Assessment System - Backend Server")
    print("="*60)
    print("Server starting on: http://localhost:5003")
    print("Health check: http://localhost:5003/health")
    print("Generate reports: http://localhost:5003/api/generate-latest-reports")
    print("Debug media: http://localhost:5003/api/debug-media")
    print("="*60 + "\n")
    
    app.run(
        host='0.0.0.0',
        port=5003,
        debug=True
    )