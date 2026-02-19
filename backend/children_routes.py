from flask import Blueprint, request, jsonify
from child_model import Child
from auth_routes import token_required

children_bp = Blueprint('children', __name__)

@children_bp.route('', methods=['GET'])
@token_required
def get_children(current_user):
    """Get all children for the current user"""
    try:
        children = Child.get_children_by_user(current_user['_id'])
        
        return jsonify({
            'children': children
        }), 200
        
    except Exception as e:
        print(f"Error fetching children: {e}")
        return jsonify({'message': 'Failed to fetch children'}), 500

@children_bp.route('', methods=['POST'])
@token_required
def add_child(current_user):
    """Add a new child"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'age', 'gender']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'message': f'{field} is required'}), 400
        
        # Validate age
        try:
            age = int(data['age'])
            if age < 1 or age > 18:
                return jsonify({'message': 'Age must be between 1 and 18'}), 400
        except ValueError:
            return jsonify({'message': 'Invalid age'}), 400
        
        # Validate gender
        if data['gender'] not in ['M', 'F']:
            return jsonify({'message': 'Gender must be M or F'}), 400
        
        # Create child
        child = Child.create_child(
            user_id=current_user['_id'],
            name=data['name'],
            age=age,
            gender=data['gender']
        )
        
        return jsonify({
            'message': 'Child added successfully',
            'child': child
        }), 201
        
    except Exception as e:
        print(f"Error adding child: {e}")
        return jsonify({'message': 'Failed to add child'}), 500

@children_bp.route('/<child_id>', methods=['GET'])
@token_required
def get_child(current_user, child_id):
    """Get a specific child"""
    try:
        child = Child.get_child_by_id(child_id, current_user['_id'])
        
        if not child:
            return jsonify({'message': 'Child not found'}), 404
        
        return jsonify({'child': child}), 200
        
    except Exception as e:
        print(f"Error fetching child: {e}")
        return jsonify({'message': 'Failed to fetch child'}), 500

@children_bp.route('/<child_id>', methods=['PUT'])
@token_required
def update_child(current_user, child_id):
    """Update child information"""
    try:
        data = request.get_json()
        
        # Validate age if provided
        if 'age' in data:
            try:
                age = int(data['age'])
                if age < 1 or age > 18:
                    return jsonify({'message': 'Age must be between 1 and 18'}), 400
                data['age'] = age
            except ValueError:
                return jsonify({'message': 'Invalid age'}), 400
        
        # Validate gender if provided
        if 'gender' in data and data['gender'] not in ['M', 'F']:
            return jsonify({'message': 'Gender must be M or F'}), 400
        
        # Update child
        success = Child.update_child(child_id, current_user['_id'], **data)
        
        if not success:
            return jsonify({'message': 'Child not found or no changes made'}), 404
        
        # Fetch updated child
        child = Child.get_child_by_id(child_id, current_user['_id'])
        
        return jsonify({
            'message': 'Child updated successfully',
            'child': child
        }), 200
        
    except Exception as e:
        print(f"Error updating child: {e}")
        return jsonify({'message': 'Failed to update child'}), 500

@children_bp.route('/<child_id>', methods=['DELETE'])
@token_required
def delete_child(current_user, child_id):
    """Delete a child"""
    try:
        success = Child.delete_child(child_id, current_user['_id'])
        
        if not success:
            return jsonify({'message': 'Child not found'}), 404
        
        return jsonify({'message': 'Child deleted successfully'}), 200
        
    except Exception as e:
        print(f"Error deleting child: {e}")
        return jsonify({'message': 'Failed to delete child'}), 500
