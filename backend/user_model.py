from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from typing import Optional
import os

# Use PostgreSQL repo from database.py
from database import get_users_repo


class User:
    """User model wrapper using PostgreSQL-backed UsersRepo"""

    @staticmethod
    def create_user(name, email, phone, password):
        users_repo = get_users_repo()
        hashed_password = generate_password_hash(password)
        user = users_repo.create_user(name=name, email=email, phone=phone, password_hashed=hashed_password)
        return user

    @staticmethod
    def authenticate(email, password):
        users_repo = get_users_repo()
        user = users_repo.get_by_email(email)
        if not user:
            return None
        # Need to fetch hashed password from DB - query directly
        # The UsersRepo currently does not return password for safety, so fetch raw via a session
        from database import SessionLocal, User as _UserModel
        with SessionLocal() as s:
            u = s.query(_UserModel).filter(_UserModel.email == email).first()
            if not u:
                return None
            if not check_password_hash(u.password, password):
                return None
            return {"_id": str(u.id), "name": u.name, "email": u.email, "phone": u.phone}

    @staticmethod
    def get_by_email(email) -> Optional[dict]:
        users_repo = get_users_repo()
        return users_repo.get_by_email(email)

    @staticmethod
    def get_by_id(user_id) -> Optional[dict]:
        users_repo = get_users_repo()
        return users_repo.get_by_id(user_id)

    @staticmethod
    def update_password(user_id, new_password) -> bool:
        users_repo = get_users_repo()
        hashed = generate_password_hash(new_password)
        return users_repo.update_password(user_id, hashed)
