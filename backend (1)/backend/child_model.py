from datetime import datetime
import uuid
from database import get_children_repo


class Child:
    """Child model wrapper using PostgreSQL-backed ChildrenRepo"""

    @staticmethod
    def create_child(user_id, name, age, gender):
        children_repo = get_children_repo()
        # Generate unique child ID
        child_id = str(uuid.uuid4())[:8].upper()
        child = children_repo.create_child(user_id=user_id, name=name, age=age, gender=gender, child_id=child_id)
        return child

    @staticmethod
    def get_children_by_user(user_id):
        children_repo = get_children_repo()
        return children_repo.get_children_by_user(user_id)

    @staticmethod
    def get_child_by_id(child_id, user_id):
        children_repo = get_children_repo()
        return children_repo.get_child_by_id(child_id, user_id)

    @staticmethod
    def update_child(child_id, user_id, **kwargs):
        children_repo = get_children_repo()
        return children_repo.update_child(child_id, user_id, **kwargs)

    @staticmethod
    def delete_child(child_id, user_id):
        children_repo = get_children_repo()
        return children_repo.delete_child(child_id, user_id)
