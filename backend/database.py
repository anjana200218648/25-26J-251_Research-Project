from dotenv import load_dotenv
load_dotenv()

# --- PostgreSQL + SQLAlchemy setup 
import os
from typing import Optional, Any, Dict, Iterable
from datetime import datetime

try:
    from sqlalchemy import (
        create_engine, Column, Integer, String, DateTime, Text, func, Index
    )
    from sqlalchemy.orm import sessionmaker, declarative_base, Session
    from sqlalchemy.dialects.postgresql import JSONB
except Exception:
    import sys, subprocess
    print("sqlalchemy or psycopg2-binary not found; attempting to install required packages...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "sqlalchemy", "psycopg2-binary"])
        from sqlalchemy import (
            create_engine, Column, Integer, String, DateTime, Text, func, Index
        )
        from sqlalchemy.orm import sessionmaker, declarative_base, Session
        from sqlalchemy.dialects.postgresql import JSONB
        print("Installed sqlalchemy and psycopg2-binary successfully.")
    except Exception as e:
        raise ModuleNotFoundError(
            "Required packages 'sqlalchemy' and 'psycopg2-binary' are not installed and automatic "
            f"installation failed: {e}. Please install them manually (pip install sqlalchemy psycopg2-binary)."
        )

# PostgreSQL connection settings
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:9590952Kpg@localhost:5432/user_complaints"
)

print("Loading PostgreSQL config:")
print(f"   DATABASE_URL: {DATABASE_URL[:50]}..." if len(DATABASE_URL) > 50 else f"   DATABASE_URL: {DATABASE_URL}")

# SQLAlchemy globals
engine = None  # type: ignore
SessionLocal: Optional[sessionmaker] = None
_db_session: Optional[Session] = None

Base = declarative_base()

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Keep common fields for indexing/filtering
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    risk_level = Column(String(32), nullable=True, index=True)
    region = Column(String(128), nullable=True, index=True)
    # Optional fields
    reporter_role = Column(String(128), nullable=True)
    text = Column(Text, nullable=True)
    # Store the original/extra document for flexibility
    payload = Column(JSONB, nullable=True)


class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(256), nullable=False)
    email = Column(String(256), unique=True, nullable=False, index=True)
    phone = Column(String(32), nullable=True)
    password = Column(String(512), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ChildModel(Base):
    __tablename__ = 'children'

    id = Column(Integer, primary_key=True, autoincrement=True)
    child_id = Column(String(32), unique=True, nullable=False, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    name = Column(String(256), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(8), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# Note: Indexes are already created via index=True parameter on the columns above
# No need for explicit Index() declarations to avoid duplicates

def serialize_for_json(obj: Any) -> Any:
    """
    Recursively convert datetime objects to ISO format strings for JSON serialization.
    """
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: serialize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [serialize_for_json(item) for item in obj]
    return obj

class ComplaintsRepo:
  
    def __init__(self, session_factory: sessionmaker):
        self._Session = session_factory

    def insert_one(self, doc: Dict[str, Any]):
        with self._Session() as s:
            # Serialize datetime objects in payload for JSONB storage
            serialized_payload = serialize_for_json(doc)
            
            c = Complaint(
                timestamp=doc.get("timestamp"),
                risk_level=doc.get("risk_level"),
                region=doc.get("region"),
                reporter_role=doc.get("reporter_role"),
                text=doc.get("text") or doc.get("complaint_text"),
                payload=serialized_payload
            )
            s.add(c)
            s.commit()
            s.refresh(c)
            return InsertOneResult(c.id)

    def find(self, filters: Optional[Dict[str, Any]] = None, limit: Optional[int] = None) -> Iterable[Dict[str, Any]]:
        with self._Session() as s:
            q = s.query(Complaint)
            f = filters or {}

            # Map direct filters
            if "risk_level" in f:
                q = q.filter(Complaint.risk_level == f["risk_level"])
            if "region" in f:
                q = q.filter(Complaint.region == f["region"])
            if "reporter_role" in f:
                q = q.filter(Complaint.reporter_role == f["reporter_role"])
            if "timestamp" in f:
                # Support simple equality or range dict {'$gte':..., '$lte':...}
                ts = f["timestamp"]
                if isinstance(ts, dict):
                    if "$gte" in ts:
                        q = q.filter(Complaint.timestamp >= ts["$gte"])
                    if "$lte" in ts:
                        q = q.filter(Complaint.timestamp <= ts["$lte"])
                else:
                    q = q.filter(Complaint.timestamp == ts)

            # Fallback: for any other keys, try JSONB containment
            for k, v in f.items():
                if k not in {"risk_level", "region", "reporter_role", "timestamp"}:
                    q = q.filter(Complaint.payload.contains({k: v}))

            q = q.order_by(Complaint.timestamp.desc())
            if limit:
                q = q.limit(limit)

            rows = q.all()
            out = []
            for r in rows:
                # Reconstruct a dict similar to the original document
                doc = dict(r.payload or {})
                doc.update({
                    "id": r.id,
                    "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                    "risk_level": r.risk_level,
                    "region": r.region,
                    "reporter_role": r.reporter_role,
                    "text": r.text,
                })
                # For compatibility include _id as well
                doc['_id'] = r.id
                out.append(doc)
            return out

    def find_one_by_id(self, complaint_id: Any) -> Optional[Dict[str, Any]]:
        with self._Session() as s:
            # Try numeric id first
            try:
                cid = int(complaint_id)
                r = s.query(Complaint).filter(Complaint.id == cid).first()
            except Exception:
                # Fallback: search payload for matching id string
                r = s.query(Complaint).filter(Complaint.payload.contains({'id': complaint_id})).first()

            if not r:
                return None
            doc = dict(r.payload or {})
            doc.update({
                "id": r.id,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "risk_level": r.risk_level,
                "region": r.region,
                "reporter_role": r.reporter_role,
                "text": r.text,
            })
            # Keep compatibility with previous _id
            doc['_id'] = r.id
            return doc

    def count_documents(self, filters: Optional[Dict[str, Any]] = None) -> int:
        with self._Session() as s:
            q = s.query(Complaint)
            f = filters or {}
            if 'user_id' in f:
                q = q.filter(Complaint.payload.contains({'user_id': f['user_id']}))
            if 'risk_level' in f:
                q = q.filter(Complaint.risk_level == f['risk_level'])
            return q.count()

    def create_index(self, field: str):
        print(f"create_index('{field}') ignored (indexes managed by schema).")


class InsertOneResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class UsersRepo:
    def __init__(self, session_factory: sessionmaker):
        self._Session = session_factory

    def create_user(self, name: str, email: str, phone: str, password_hashed: str) -> Dict[str, Any]:
        with self._Session() as s:
            existing = s.query(User).filter(User.email == email).first()
            if existing:
                raise ValueError("User with this email already exists")
            u = User(name=name, email=email, phone=phone, password=password_hashed)
            s.add(u)
            s.commit()
            s.refresh(u)
            return {"_id": str(u.id), "name": u.name, "email": u.email, "phone": u.phone}

    def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        with self._Session() as s:
            u = s.query(User).filter(User.email == email).first()
            if not u:
                return None
            return {"_id": str(u.id), "name": u.name, "email": u.email, "phone": u.phone}

    def get_by_id(self, user_id: Any) -> Optional[Dict[str, Any]]:
        with self._Session() as s:
            try:
                uid = int(user_id)
            except Exception:
                return None
            u = s.query(User).filter(User.id == uid).first()
            if not u:
                return None
            return {"_id": str(u.id), "name": u.name, "email": u.email, "phone": u.phone}

    def update_password(self, user_id: Any, password_hashed: str) -> bool:
        with self._Session() as s:
            try:
                uid = int(user_id)
            except Exception:
                return False
            u = s.query(User).filter(User.id == uid).first()
            if not u:
                return False
            u.password = password_hashed
            s.commit()
            return True


class ChildrenRepo:
    def __init__(self, session_factory: sessionmaker):
        self._Session = session_factory

    def create_child(self, user_id: str, name: str, age: int, gender: str, child_id: str) -> Dict[str, Any]:
        with self._Session() as s:
            c = ChildModel(child_id=child_id, user_id=user_id, name=name, age=age, gender=gender)
            s.add(c)
            s.commit()
            s.refresh(c)
            return {
                "id": c.child_id,
                "user_id": c.user_id,
                "name": c.name,
                "age": c.age,
                "gender": c.gender,
                "created_at": c.created_at,
                "updated_at": c.updated_at
            }

    def get_children_by_user(self, user_id: str):
        with self._Session() as s:
            rows = s.query(ChildModel).filter(ChildModel.user_id == user_id).all()
            out = []
            for c in rows:
                out.append({
                    "id": c.child_id,
                    "user_id": c.user_id,
                    "name": c.name,
                    "age": c.age,
                    "gender": c.gender,
                    "created_at": c.created_at,
                    "updated_at": c.updated_at
                })
            return out

    def count_children(self, user_id: Optional[str] = None) -> int:
        with self._Session() as s:
            if user_id:
                return s.query(ChildModel).filter(ChildModel.user_id == user_id).count()
            return s.query(ChildModel).count()

    def get_child_by_id(self, child_id: str, user_id: str):
        with self._Session() as s:
            c = s.query(ChildModel).filter(ChildModel.child_id == child_id, ChildModel.user_id == user_id).first()
            if not c:
                return None
            return {"id": c.child_id, "user_id": c.user_id, "name": c.name, "age": c.age, "gender": c.gender}

    def update_child(self, child_id: str, user_id: str, **kwargs) -> bool:
        with self._Session() as s:
            c = s.query(ChildModel).filter(ChildModel.child_id == child_id, ChildModel.user_id == user_id).first()
            if not c:
                return False
            if 'name' in kwargs:
                c.name = kwargs['name']
            if 'age' in kwargs:
                c.age = kwargs['age']
            if 'gender' in kwargs:
                c.gender = kwargs['gender']
            c.updated_at = func.now()
            s.commit()
            return True

    def delete_child(self, child_id: str, user_id: str) -> bool:
        with self._Session() as s:
            res = s.query(ChildModel).filter(ChildModel.child_id == child_id, ChildModel.user_id == user_id).delete()
            s.commit()
            return res > 0

    def create_index(self, field: str):
        # Indexes are created in init_db; keep for API compatibility.
        print(f"create_index('{field}') ignored (indexes managed by schema).")

# Global repo
complaints_repo: Optional[ComplaintsRepo] = None
users_repo: Optional[UsersRepo] = None
children_repo: Optional[ChildrenRepo] = None

def init_db():
    """Initialize PostgreSQL connection, create tables and indexes."""
    global engine, SessionLocal, _db_session, complaints_repo

    if engine is not None:
        print("Database already initialized, skipping...")
        return

    try:
        print("Attempting to connect to PostgreSQL...")
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
        # Test connection
        with engine.connect() as conn:
            conn.execute(func.now().select())  # lightweight ping via SELECT now()

        # Create schema
        Base.metadata.create_all(engine)
        complaints_repo = ComplaintsRepo(SessionLocal)
        # Initialize other repos
        global users_repo, children_repo
        users_repo = UsersRepo(SessionLocal)
        children_repo = ChildrenRepo(SessionLocal)
        print("Successfully connected to PostgreSQL and ensured schema.")
    except Exception as e:
        print(f"Failed to connect to PostgreSQL: {e}")
        print("Server will start but database features will not be available")
        print("Please check your DATABASE_URL and network access")

def get_database():
    """Return SQLAlchemy engine (initialize if needed)."""
    global engine
    if engine is None:
        init_db()
    return engine

def get_db():
    """Alias for get_database()."""
    return get_database()

def get_complaints_collection():
    """
    Return a repository for the complaints table.
    Keeps name for backward compatibility with previous Mongo usage.
    """
    global complaints_repo
    if complaints_repo is None:
        print("Complaints repo is None, re-initializing...")
        init_db()
    if complaints_repo is None:
        raise Exception("Database not initialized properly - PostgreSQL connection failed")
    # Verify connection by opening/closing a session
    try:
        _ = SessionLocal()  # type: ignore
        print("PostgreSQL connection is active")
    except Exception as e:
        print(f"PostgreSQL connection issue: {e}, attempting to reconnect...")
        # Reset and retry
        reset_db_state()
        init_db()
        if complaints_repo is None:
            raise Exception("Failed to reconnect to PostgreSQL")
    return complaints_repo


def get_users_repo():
    global users_repo
    if users_repo is None:
        init_db()
    if users_repo is None:
        raise Exception("Database not initialized properly - PostgreSQL connection failed. Please ensure PostgreSQL is running on localhost:5432 and DATABASE_URL is correct.")
    return users_repo


def get_children_repo():
    global children_repo
    if children_repo is None:
        init_db()
    if children_repo is None:
        raise Exception("Database not initialized properly - PostgreSQL connection failed. Please ensure PostgreSQL is running on localhost:5432 and DATABASE_URL is correct.")
    return children_repo

def reset_db_state():
    """Internal helper to clear engine/session globals."""
    global engine, SessionLocal, _db_session, complaints_repo
    try:
        if _db_session is not None:
            _db_session.close()
    except Exception:
        pass
    _db_session = None
    complaints_repo = None
    SessionLocal = None
    if engine is not None:
        try:
            engine.dispose()
        except Exception:
            pass
    engine = None

def close_database():
    """Close database connections and dispose engine."""
    reset_db_state()

