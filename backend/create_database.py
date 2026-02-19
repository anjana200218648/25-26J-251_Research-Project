"""
Script to create the database if it doesn't exist.
Run this before starting the Flask app for the first time.
"""
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv

load_dotenv()

# Database configuration
DB_HOST = "localhost"
DB_PORT = "5432"
DB_USER = "postgres"
DB_PASSWORD = "9590952Kpg"  # Update if different
DB_NAME = "user_complaints"

def create_database():
    """Create the database if it doesn't exist."""
    try:
        # Connect to default 'postgres' database first
        print(f"Connecting to PostgreSQL server at {DB_HOST}:{DB_PORT}...")
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database="postgres"  # Connect to default database first
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (DB_NAME,)
        )
        exists = cursor.fetchone()
        
        if exists:
            print(f"✅ Database '{DB_NAME}' already exists")
        else:
            # Create the database
            print(f"Creating database '{DB_NAME}'...")
            cursor.execute(f'CREATE DATABASE "{DB_NAME}"')
            print(f"✅ Database '{DB_NAME}' created successfully")
        
        cursor.close()
        conn.close()
        
        # Now connect to the new database and verify
        print(f"\nVerifying connection to '{DB_NAME}'...")
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        print(f"✅ Successfully connected to '{DB_NAME}' database")
        
        # Check for tables
        cursor = conn.cursor()
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        tables = cursor.fetchall()
        
        if tables:
            print(f"\n📋 Existing tables in '{DB_NAME}':")
            for table in tables:
                print(f"   - {table[0]}")
        else:
            print(f"\n⚠️  No tables found in '{DB_NAME}' yet.")
            print("   Tables will be created when you run 'python app.py'")
        
        cursor.close()
        conn.close()
        
        return True
        
    except psycopg2.OperationalError as e:
        print(f"\n❌ Connection Error: {e}")
        print("\nPossible issues:")
        print("1. PostgreSQL server is not running")
        print("2. Incorrect password (current: 9590952Kpg)")
        print("3. PostgreSQL is not listening on localhost:5432")
        print("\nTo fix:")
        print("- Check PostgreSQL service is running in Services (Windows)")
        print("- Verify password in pgAdmin")
        print("- Update DB_PASSWORD in this script if needed")
        return False
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("PostgreSQL Database Setup")
    print("=" * 60)
    
    success = create_database()
    
    if success:
        print("\n" + "=" * 60)
        print("✅ Database setup complete!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Run 'python app.py' to start the Flask server")
        print("2. The tables (complaints, users, children) will be created automatically")
        print("3. Check pgAdmin to see the tables")
    else:
        print("\n" + "=" * 60)
        print("❌ Database setup failed")
        print("=" * 60)
