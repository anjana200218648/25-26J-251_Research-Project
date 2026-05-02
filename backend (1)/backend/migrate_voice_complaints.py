"""
Migration script to update voice_complaints table schema
Run this script once to add new columns to existing voice_complaints table
"""
from sqlalchemy import text
import database

def migrate_voice_complaints_table():
    """Add new columns to voice_complaints table"""
    
    # Initialize database connection first
    database.init_db()
    
    migrations = [
        # Guardian and Child Info
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(256)",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS child_name VARCHAR(256)",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS age INTEGER",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS phone_number VARCHAR(32)",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS region VARCHAR(256)",
        
        # Complaint Details  
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS complaint TEXT",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS child_gender VARCHAR(32)",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS hours_per_day_on_social_media FLOAT",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS reporter_role VARCHAR(64)",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS device_type VARCHAR(64)",
        
        # Voice-specific metadata
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS voice_confidence FLOAT",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS audio_duration FLOAT",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS speaker_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS speaker_similarity FLOAT",
        
        # Risk Assessment Results
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS risk_level VARCHAR(32)",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS risk_score FLOAT",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS risk_probability FLOAT",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS predicted_label INTEGER",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS ml_risk_score FLOAT",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS rule_risk_score FLOAT",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS temporal_drift_score FLOAT",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS risk_explanation TEXT",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS triggered_indicators TEXT",
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS temporal_data TEXT",
        
        # Timestamps
        "ALTER TABLE voice_complaints ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE",
        
        # Rename old column
        "ALTER TABLE voice_complaints RENAME COLUMN transcribed_text TO complaint_old",
        
        # Drop complaint_id if it's not being used
        "ALTER TABLE voice_complaints DROP COLUMN IF EXISTS complaint_id",
        
        # Create indexes
        "CREATE INDEX IF NOT EXISTS idx_voice_complaints_user_child ON voice_complaints(user_id, child_name)",
        "CREATE INDEX IF NOT EXISTS idx_voice_complaints_created ON voice_complaints(created_at DESC)",
    ]
    
    db = database.SessionLocal()
    try:
        print("Starting voice_complaints table migration...")
        
        for i, migration_sql in enumerate(migrations, 1):
            try:
                db.execute(text(migration_sql))
                db.commit()
                print(f"✓ Migration {i}/{len(migrations)}: {migration_sql[:80]}...")
            except Exception as e:
                print(f"✗ Migration {i}/{len(migrations)} failed: {e}")
                db.rollback()
                # Continue with other migrations
                
        print("\nMigration completed!")
        print("\nNew columns added:")
        print("  - guardian_name, child_name, age, phone_number, region")
        print("  - complaint, child_gender, hours_per_day_on_social_media")
        print("  - reporter_role, device_type, voice_confidence")
        print("  - risk_level, risk_score, risk_probability, predicted_label")
        print("  - ml_risk_score, rule_risk_score, temporal_drift_score")
        print("  - risk_explanation, triggered_indicators, temporal_data")
        print("  - updated_at")
        
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 80)
    print("Voice Complaints Table Migration")
    print("=" * 80)
    migrate_voice_complaints_table()
