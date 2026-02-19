from flask import Blueprint, request, jsonify
from user_model import User
import jwt
import os
import random
import string
from datetime import datetime, timedelta
from functools import wraps

# Twilio SMS configuration (optional - falls back to console if not configured)
try:
    from twilio.rest import Client
    TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
    TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
    TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER')  # Your Twilio phone number
    
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER:
        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        SMS_ENABLED = True
    else:
        twilio_client = None
        SMS_ENABLED = False
except ImportError:
    twilio_client = None
    SMS_ENABLED = False

auth_bp = Blueprint('auth', __name__)

# Secret key for JWT
SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-change-in-production')

# In-memory storage for OTPs and reset tokens (use Redis in production)
otp_storage = {}
reset_tokens = {}

def generate_otp():
    """Generate a 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=6))

def generate_reset_token():
    """Generate a secure reset token"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=32))

def send_sms(phone_number: str, message: str) -> bool:
    """Send SMS to phone number using Twilio"""
    if SMS_ENABLED and twilio_client:
        try:
            message_obj = twilio_client.messages.create(
                body=message,
                from_=TWILIO_PHONE_NUMBER,
                to=phone_number
            )
            print(f"✅ SMS sent successfully to {phone_number}. SID: {message_obj.sid}")
            return True
        except Exception as e:
            print(f"❌ Failed to send SMS to {phone_number}: {e}")
            return False
    else:
        print(f"📱 SMS not configured. OTP would be sent to: {phone_number}")
        print(f"   Message: {message}")
        return False

def token_required(f):
    """Decorator to protect routes with JWT authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            # Remove 'Bearer ' prefix if present
            if token.startswith('Bearer '):
                token = token[7:]
            
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = User.get_by_id(data['user_id'])
            
            if not current_user:
                return jsonify({'message': 'Invalid token'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'email', 'phone', 'password']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'message': f'{field} is required'}), 400
        
        # Validate email format
        import re
        email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_regex, data['email']):
            return jsonify({'message': 'Invalid email format'}), 400
        
        # Validate password length
        if len(data['password']) < 8:
            return jsonify({'message': 'Password must be at least 8 characters long'}), 400
        
        # Create user
        user = User.create_user(
            name=data['name'],
            email=data['email'],
            phone=data['phone'],
            password=data['password']
        )
        
        return jsonify({
            'message': 'User registered successfully',
            'user': user
        }), 201
        
    except ValueError as e:
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        print(f"Error during registration: {e}")
        return jsonify({'message': 'Registration failed'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user - Direct login without OTP"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('email') or not data.get('password'):
            return jsonify({'message': 'Email and password are required'}), 400
        
        # Authenticate user
        user = User.authenticate(data['email'], data['password'])
        
        if not user:
            return jsonify({'message': 'Invalid email or password'}), 401
        
        # Generate JWT token directly
        token = jwt.encode({
            'user_id': user['_id'],
            'email': user['email'],
            'exp': datetime.utcnow() + timedelta(days=7)
        }, SECRET_KEY, algorithm='HS256')
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': user
        }), 200
        
    except Exception as e:
        print(f"Error during login: {e}")
        return jsonify({'message': 'Login failed'}), 500

@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    """Login user - Step 2: Verify OTP and return JWT token"""
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('otp'):
            return jsonify({'message': 'Email and OTP are required'}), 400
        
        email = data['email']
        otp = data['otp']
        
        # Check if OTP exists
        if email not in otp_storage:
            return jsonify({'message': 'OTP expired or not found'}), 400
        
        stored_data = otp_storage[email]
        
        # Check if OTP expired
        if datetime.utcnow() > stored_data['expires_at']:
            del otp_storage[email]
            return jsonify({'message': 'OTP has expired'}), 400
        
        # Verify OTP
        if stored_data['otp'] != otp:
            return jsonify({'message': 'Invalid OTP'}), 401
        
        # Get user
        user = User.get_by_id(stored_data['user_id'])
        
        if not user:
            return jsonify({'message': 'User not found'}), 404
        
        # Clear OTP
        del otp_storage[email]
        
        # Generate JWT token
        token = jwt.encode({
            'user_id': user['_id'],
            'email': user['email'],
            'exp': datetime.utcnow() + timedelta(days=7)
        }, SECRET_KEY, algorithm='HS256')
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': user
        }), 200
        
    except Exception as e:
        print(f"Error during OTP verification: {e}")
        return jsonify({'message': 'Verification failed'}), 500

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset - Send OTP to phone number (2FA)"""
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('phone'):
            return jsonify({'message': 'Email and phone number are required'}), 400
        
        email = data['email']
        phone = data['phone']
        user = User.get_by_email(email)
        
        if not user:
            return jsonify({'message': 'No account found with this email'}), 404
        
        # Verify phone number matches
        if user.get('phone') != phone:
            return jsonify({'message': 'Phone number does not match our records'}), 400
        
        # Generate 6-digit OTP
        otp = generate_otp()
        otp_storage[phone] = {
            'otp': otp,
            'email': email,
            'user_id': user['_id'],
            'expires_at': datetime.utcnow() + timedelta(minutes=10)
        }
        
        # Send OTP via SMS
        sms_message = f"Your SafeKidScan password reset OTP is: {otp}. Valid for 10 minutes."
        sms_sent = send_sms(phone, sms_message)
        
        # For development: also print to console
        print(f"🔑 Password reset OTP for {phone}: {otp}")
        
        response_data = {
            'message': 'OTP sent to your phone number'
        }
        
        # In development mode (when SMS is not configured), return OTP in response
        if not SMS_ENABLED:
            response_data['otp'] = otp  # Remove this when SMS is enabled!
            response_data['dev_mode'] = True
        
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"Error in forgot password: {e}")
        return jsonify({'message': 'Failed to process request'}), 500

@auth_bp.route('/verify-reset-otp', methods=['POST'])
def verify_reset_otp():
    """Verify OTP for password reset"""
    try:
        data = request.get_json()
        
        if not data.get('phone') or not data.get('otp'):
            return jsonify({'message': 'Phone number and OTP are required'}), 400
        
        phone = data['phone']
        otp = data['otp']
        
        # Check if OTP exists
        if phone not in otp_storage:
            return jsonify({'message': 'OTP not found. Please request a new one'}), 400
        
        stored_data = otp_storage[phone]
        
        # Check if OTP expired
        if datetime.utcnow() > stored_data['expires_at']:
            del otp_storage[phone]
            return jsonify({'message': 'OTP has expired. Please request a new one'}), 400
        
        # Verify OTP
        if stored_data['otp'] != otp:
            return jsonify({'message': 'Invalid OTP'}), 400
        
        # OTP verified, generate a temporary reset token
        reset_token = generate_reset_token()
        reset_tokens[reset_token] = {
            'user_id': stored_data['user_id'],
            'email': stored_data['email'],
            'expires_at': datetime.utcnow() + timedelta(minutes=15)
        }
        
        # Clear OTP after successful verification
        del otp_storage[phone]
        
        return jsonify({
            'message': 'OTP verified successfully',
            'reset_token': reset_token
        }), 200
        
    except Exception as e:
        print(f"Error verifying reset OTP: {e}")
        return jsonify({'message': 'Verification failed'}), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset password using verified token"""
    try:
        data = request.get_json()
        
        if not data.get('token') or not data.get('new_password'):
            return jsonify({'message': 'Token and new password are required'}), 400
        
        token = data['token']
        new_password = data['new_password']
        
        # Validate password length
        if len(new_password) < 8:
            return jsonify({'message': 'Password must be at least 8 characters long'}), 400
        
        # Check if token exists
        if token not in reset_tokens:
            return jsonify({'message': 'Invalid or expired reset token'}), 400
        
        token_data = reset_tokens[token]
        
        # Check if token expired
        if datetime.utcnow() > token_data['expires_at']:
            del reset_tokens[token]
            return jsonify({'message': 'Reset token has expired'}), 400
        
        # Update password
        User.update_password(token_data['user_id'], new_password)
        
        # Clear token
        del reset_tokens[token]
        
        return jsonify({'message': 'Password reset successful'}), 200
        
    except Exception as e:
        print(f"Error in reset password: {e}")
        return jsonify({'message': 'Failed to reset password'}), 500

@auth_bp.route('/resend-otp', methods=['POST'])
def resend_otp():
    """Resend OTP for 2FA"""
    try:
        data = request.get_json()
        
        if not data.get('email'):
            return jsonify({'message': 'Email is required'}), 400
        
        email = data['email']
        
        # Check if there's an existing OTP request
        if email not in otp_storage:
            return jsonify({'message': 'No active OTP request found'}), 400
        
        # Generate new OTP
        otp = generate_otp()
        otp_storage[email]['otp'] = otp
        otp_storage[email]['expires_at'] = datetime.utcnow() + timedelta(minutes=5)
        
        print(f"🔐 Resent OTP for {email}: {otp}")
        
        return jsonify({
            'message': 'OTP resent successfully',
            'otp': otp  # Remove this in production!
        }), 200
        
    except Exception as e:
        print(f"Error in resend OTP: {e}")
        return jsonify({'message': 'Failed to resend OTP'}), 500

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    """Get current authenticated user"""
    return jsonify({'user': current_user}), 200

@auth_bp.route('/verify', methods=['POST'])
def verify_token():
    """Verify if a token is valid"""
    try:
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'valid': False, 'message': 'Token is missing'}), 401
        
        # Remove 'Bearer ' prefix if present
        if token.startswith('Bearer '):
            token = token[7:]
        
        data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user = User.get_by_id(data['user_id'])
        
        if not user:
            return jsonify({'valid': False, 'message': 'Invalid token'}), 401
        
        return jsonify({'valid': True, 'user': user}), 200
        
    except jwt.ExpiredSignatureError:
        return jsonify({'valid': False, 'message': 'Token has expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'valid': False, 'message': 'Invalid token'}), 401
    except Exception as e:
        print(f"Error during token verification: {e}")
        return jsonify({'valid': False, 'message': 'Verification failed'}), 500

@auth_bp.route('/update-profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    """Update user profile"""
    try:
        from user_model import User as UserModel
        from database import SessionLocal, User as _UserModel

        data = request.get_json()

        update_fields = {}
        if 'name' in data:
            update_fields['name'] = data['name']
        if 'phone' in data:
            update_fields['phone'] = data['phone']

        try:
            uid = int(current_user['_id'])
        except Exception:
            return jsonify({'message': 'Invalid user id'}), 400

        with SessionLocal() as s:
            u = s.query(_UserModel).filter(_UserModel.id == uid).first()
            if not u:
                return jsonify({'message': 'User not found'}), 404
            if 'name' in update_fields:
                u.name = update_fields['name']
            if 'phone' in update_fields:
                u.phone = update_fields['phone']
            u.updated_at = datetime.utcnow()
            s.commit()

        # Get updated user
        updated_user = UserModel.get_by_id(current_user['_id'])

        return jsonify({
            'message': 'Profile updated successfully',
            'user': updated_user
        }), 200
        
    except Exception as e:
        print(f"Error updating profile: {e}")
        return jsonify({'message': 'Failed to update profile'}), 500
