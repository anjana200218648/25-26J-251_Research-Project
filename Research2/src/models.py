"""
Database models for the AI Risk Assessment System
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Report(db.Model):
    __tablename__ = 'reports'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    media_analysis_content = db.Column(db.Text, nullable=True)
    complaint_analysis_content = db.Column(db.Text, nullable=True)
    final_report_content = db.Column(db.Text, nullable=True)
    risk_score = db.Column(db.Float, nullable=True)
    conflict_level = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Blockchain notarization fields (safe to be nullable)
    pdf_hash = db.Column(db.String(64), nullable=True)             # SHA256 hex (no 0x)
    blockchain_tx_hash = db.Column(db.String(66), nullable=True)   # 0x-prefixed tx hash
    blockchain_block_number = db.Column(db.Integer, nullable=True)
    blockchain_status = db.Column(db.String(32), nullable=True)    # CONFIRMED/FAILED/SKIPPED/PENDING

    def __repr__(self):
        return f'<Report {self.id}: {self.filename}>'