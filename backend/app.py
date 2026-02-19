from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import os
from dotenv import load_dotenv
from werkzeug.exceptions import BadRequest, NotFound, InternalServerError
from werkzeug.utils import secure_filename

# Import our custom modules
from database import init_db, get_complaints_collection, get_db
from model_service import ModelService
from risk_scoring import calculate_risk_score
from auth_routes import auth_bp, token_required
from children_routes import children_bp
from child_model import Child
from temporal_drift import TemporalDriftAnalyzer, integrate_temporal_drift
from voice_processor import process_voice_complaint

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Register authentication blueprint
app.register_blueprint(auth_bp, url_prefix='/api/auth')

# Register children blueprint
app.register_blueprint(children_bp, url_prefix='/api/children')

# Initialize model service and load the model
model_service = ModelService()
model_service.load_model()
print("Model loaded successfully")

# Initialize database connection
try:
    init_db()
    print("Connected to PostgreSQL")
except Exception as e:
    print(f"Database connection error: {e}")

@app.route("/")
def root():
    """Root endpoint to provide API information."""
    return jsonify({
        "message": "Child Social Media Risk Assessment API (Flask Version)",
        "version": "1.0.0",
        "endpoints": {
            "submit_complaint": "/api/complaints/submit",
            "get_complaint": "/api/complaints/<complaint_id>",
            "list_complaints": "/api/complaints",
            "health": "/health"
        }
    })

@app.route("/health")
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "model_loaded": model_service.is_loaded(),
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route("/api/complaints/submit", methods=["POST"])
def submit_complaint():
    """Submit a new complaint and get risk assessment."""
    try:
        data = request.get_json()
        if not data:
            raise BadRequest("Invalid JSON body")

        # Basic validation: required fields must exist and be non-empty
        required_fields = [
            "guardian_name", "child_name", "age", "phone_number", "region",
            "complaint", "child_gender", "hours_per_day_on_social_media",
            "reporter_role", "device_type"
        ]
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            raise BadRequest(f"Missing required field(s): {', '.join(missing_fields)}")

        empty_fields = []
        for field in required_fields:
            value = data.get(field)
            if value is None:
                empty_fields.append(field)
            elif isinstance(value, str) and not value.strip():
                empty_fields.append(field)
        if empty_fields:
            raise BadRequest(f"Empty required field(s): {', '.join(empty_fields)}")

        complaint_text = str(data.get('complaint', ''))
        complaint_preview = complaint_text[:100] + ("..." if len(complaint_text) > 100 else "")

        print("\n" + "="*80)
        print("RECEIVED DATA FROM FRONTEND:")
        print(f"   Guardian Name: {data.get('guardian_name')}")
        print(f"   Child Name: {data.get('child_name')}")
        print(f"   Age: {data.get('age')}")
        print(f"   Child Gender: {data.get('child_gender')}")
        print(f"   Hours/Day: {data.get('hours_per_day_on_social_media')}")
        print(f"   Reporter Role: {data.get('reporter_role')}")
        print(f"   Complaint: {complaint_preview}")
        print("="*80 + "\n")

        # Validate and normalize 'age' to ensure it's within allowed range (10-18)
        try:
            age_val = int(data['age'])
        except Exception:
            raise BadRequest("Invalid value for 'age'; must be an integer between 10 and 18")
        if not (10 <= age_val <= 18):
            raise BadRequest("Child age must be between 10 and 18 years")
        
        # Validate and convert hours_per_day_on_social_media to float
        try:
            hours_val = float(data['hours_per_day_on_social_media'])
        except Exception:
            raise BadRequest("Invalid value for 'hours_per_day_on_social_media'; must be a number")
        if not (0 <= hours_val <= 24):
            raise BadRequest("Hours per day must be between 0 and 24")

        # Prepare features for model prediction
        # These structured features provide accurate, unambiguous data for risk assessment
        # Map gender from frontend format (Male/Female/Other) to model format (M/F/Other)
        gender_map = {
            'Male': 'M',
            'Female': 'F',
            'Other': 'Other',
            'M': 'M',
            'F': 'F',
            'male': 'M',
            'female': 'F',
            'other': 'Other'
        }
        gender_value = gender_map.get(data['child_gender'], data['child_gender'][0].upper() if len(data['child_gender']) > 0 else 'M')
        
        features = {
            'age_of_child': age_val,
            'hours_per_day_on_social_media': hours_val,
            'child_gender': gender_value,
            'reporter_role': str(data['reporter_role']).lower().strip(),
            'device_type': str(data['device_type']).lower().strip()
        }
        
        print("TRANSFORMED FEATURES FOR MODEL:")
        for key, value in features.items():
            print(f"   {key}: {value} (type: {type(value).__name__})")
        print("="*80 + "\n")
        
        # Get prediction from model
        prediction = model_service.predict(data['complaint'], features)
        
        # Calculate comprehensive risk score
        risk_score_result = calculate_risk_score(
            ml_probability=prediction['probability_high_risk'],
            complaint_text=data['complaint'],
            hours_per_day=hours_val,
            previous_risk_level="low",  # Default for new complaints
            previous_ml_score=None  # No history for first submission
        )
        
        # Retrieve complaint history for temporal drift analysis
        # Filter by child name and user ID to track same child over time
        user_id = data.get('user_id')
        child_name = data.get('child_name')
        complaint_history = []
        
        if user_id and child_name:
            try:
                complaints_collection = get_complaints_collection()
                # Get previous complaints for this user
                all_complaints = complaints_collection.find(
                    filters={'user_id': user_id},
                    limit=50  # Last 50 complaints for analysis
                )
                
                # Filter to same child by name
                complaint_history = [
                    c for c in all_complaints 
                    if c.get('child_name', '').lower() == child_name.lower()
                ]
                
                # Convert timestamp strings back to datetime objects for analysis
                for c in complaint_history:
                    if isinstance(c.get('timestamp'), str):
                        try:
                            c['timestamp'] = datetime.fromisoformat(c['timestamp'])
                        except:
                            c['timestamp'] = datetime.now()
                    # Ensure risk score field exists
                    if 'ml_risk_score' not in c:
                        c['ml_risk_score'] = c.get('risk_score', 0)
                        
            except Exception as e:
                print(f"Warning: Could not retrieve complaint history: {e}")
                complaint_history = []
        
        # Apply temporal drift analysis
        child_identifier = f"{user_id}_{child_name}"
        temporal_result = integrate_temporal_drift(
            child_id=child_identifier,
            current_ml_score=risk_score_result['score_breakdown']['ml_score'],
            current_rule_score=risk_score_result['score_breakdown']['rule_score'],
            complaint_history=complaint_history
        )
        
        # Update risk score with temporal adjustment
        risk_score_result['total_score'] = temporal_result['final_score']
        risk_score_result['score_breakdown']['temporal_drift'] = temporal_result['drift_adjustment']
        risk_score_result['temporal_data'] = temporal_result['temporal_data']
        
        # Re-evaluate risk level with temporal score
        if temporal_result['final_score'] >= 50:
            risk_score_result['risk_level'] = 'high'
        elif temporal_result['final_score'] >= 35:
            risk_score_result['risk_level'] = 'medium'
        else:
            risk_score_result['risk_level'] = 'low'
        
        print("FINAL RISK ASSESSMENT (with Temporal Drift):")
        print(f"   ML Prediction: {prediction['predicted_label']} ({'High' if prediction['predicted_label'] == 1 else 'Low'})")
        print(f"   ML Probability: {prediction['probability_high_risk']:.2%}")
        print(f"   Base Score: {temporal_result['base_score']}/100")
        print(f"   Temporal Drift Adjustment: {temporal_result['drift_adjustment']:+.0f} points")
        print(f"   Final Score: {risk_score_result['total_score']}/100")
        print(f"   Final Risk Level: {risk_score_result['risk_level'].upper()}")
        print("="*80 + "\n")
        
        # Prepare document for database
        # USE COMPREHENSIVE RISK LEVEL, not just ML prediction
        complaint_doc = {
            "user_id": data.get('user_id'),  # Store user_id with complaint
            "guardian_name": data['guardian_name'],
            "child_name": data['child_name'],
            "age": age_val,
            "phone_number": data['phone_number'],
            "region": data['region'],
            "complaint": data['complaint'],
            "child_gender": features['child_gender'],
            "hours_per_day_on_social_media": hours_val,
            "reporter_role": features['reporter_role'],
            "device_type": features['device_type'],
            "risk_level": risk_score_result['risk_level'].title() + " Risk",  # Use comprehensive score
            "risk_probability": prediction['probability_high_risk'],
            "predicted_label": prediction['predicted_label'],
            # Add comprehensive risk scoring fields
            "risk_score": risk_score_result['total_score'],
            "risk_score_breakdown": risk_score_result['score_breakdown'],
            "triggered_indicators": risk_score_result['triggered_indicators'],
            "risk_explanation": risk_score_result['explanation'],
            "temporal_data": risk_score_result.get('temporal_data', {}),
            "timestamp": datetime.now()
        }
        
        # Insert into PostgreSQL (via repo)
        complaints_collection = get_complaints_collection()
        result = complaints_collection.insert_one(complaint_doc)

        # Prepare response
        complaint_doc['id'] = str(result.inserted_id)
        complaint_doc['_id'] = str(result.inserted_id)
        
        # Convert datetime to string for JSON serialization
        complaint_doc['timestamp'] = complaint_doc['timestamp'].isoformat()

        return jsonify(complaint_doc), 201
        
    except BadRequest as e:
        print(f"BadRequest Error: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f" Error processing complaint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error processing complaint: {str(e)}"}), 500

@app.route("/api/complaints/voice-submit", methods=["POST"])
@token_required
def submit_voice_complaint(current_user):
    """
    Submit a complaint via voice recording.
    
    Accepts audio file, converts to text using Google Speech API,
    then processes through standard complaint pipeline.
    
    Expects multipart/form-data with:
    - audio_file: Audio file (wav, mp3, ogg, flac, webm)
    - Additional form fields same as text complaint submission
    """
    try:
        # Validate that audio file is present
        if 'audio_file' not in request.files:
            raise BadRequest("No audio file provided")
        
        audio_file = request.files['audio_file']
        
        if audio_file.filename == '':
            raise BadRequest("Empty audio file")
        
        # Get file extension
        filename = secure_filename(audio_file.filename)
        file_extension = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        
        # Read audio data
        audio_data = audio_file.read()

        # Get language preference (default to English)
        language = request.form.get('language', 'en-US')
        manual_transcript = str(request.form.get('complaint', '')).strip()

        print(f"\nProcessing voice complaint: {filename} ({len(audio_data)} bytes)")

        if manual_transcript:
            transcript = manual_transcript
            try:
                confidence = float(request.form.get('voice_confidence', 0))
            except Exception:
                confidence = 0.0
            print("Using frontend-reviewed transcript for voice complaint")
        else:
            # Process audio to text using Google Speech API
            voice_result = process_voice_complaint(
                audio_data=audio_data,
                file_extension=file_extension,
                language=language
            )

            if not voice_result['success']:
                return jsonify({
                    "error": "Voice processing failed",
                    "details": voice_result['error']
                }), 400

            # Extract transcript
            transcript = voice_result['transcript']
            confidence = voice_result['confidence']
        
        print(f"Voice transcription successful (confidence: {confidence:.2%})")
        print(f"Transcript: {transcript}")
        
        # Get other form fields
        form_data = {
            'guardian_name': request.form.get('guardian_name'),
            'child_name': request.form.get('child_name'),
            'age': request.form.get('age'),
            'phone_number': request.form.get('phone_number'),
            'region': request.form.get('region'),
            'complaint': transcript,  # Use transcribed text
            'child_gender': request.form.get('child_gender'),
            'hours_per_day_on_social_media': request.form.get('hours_per_day_on_social_media'),
            'reporter_role': request.form.get('reporter_role'),
            'device_type': request.form.get('device_type', 'mobile'),
            'user_id': current_user.get('_id') if isinstance(current_user, dict) else str(current_user._id)
        }
        
        # Validate required fields
        required_fields = ['guardian_name', 'child_name', 'age', 'phone_number', 
                          'region', 'child_gender', 'hours_per_day_on_social_media', 
                          'reporter_role', 'device_type']
        
        for field in required_fields:
            if not form_data.get(field):
                raise BadRequest(f"Missing required field: {field}")
        
        # Convert numeric fields
        try:
            age_val = int(form_data['age'])
            hours_val = float(form_data['hours_per_day_on_social_media'])
        except ValueError:
            raise BadRequest("Invalid numeric values for age or hours")
        
        # Prepare features for ML model
        features = {
            'age_of_child': age_val,
            'hours_per_day_on_social_media': hours_val,
            'child_gender': form_data['child_gender'].lower(),
            'reporter_role': form_data['reporter_role'].lower(),
            'device_type': form_data['device_type'].lower()
        }
        
        # Get ML prediction
        prediction = model_service.predict(transcript, features)
        
        # Calculate risk score
        risk_score_result = calculate_risk_score(
            ml_probability=prediction['probability_high_risk'],
            complaint_text=transcript,
            hours_per_day=hours_val,
            previous_risk_level="low",
            previous_ml_score=None
        )
        
        # Apply temporal drift analysis (same as text complaints)
        user_id = form_data['user_id']
        child_name = form_data['child_name']
        complaint_history = []
        
        if user_id and child_name:
            try:
                complaints_collection = get_complaints_collection()
                all_complaints = complaints_collection.find(
                    filters={'user_id': user_id},
                    limit=50
                )
                
                complaint_history = [
                    c for c in all_complaints 
                    if c.get('child_name', '').lower() == child_name.lower()
                ]
                
                for c in complaint_history:
                    if isinstance(c.get('timestamp'), str):
                        try:
                            c['timestamp'] = datetime.fromisoformat(c['timestamp'])
                        except:
                            c['timestamp'] = datetime.now()
                    if 'ml_risk_score' not in c:
                        c['ml_risk_score'] = c.get('risk_score', 0)
                        
            except Exception as e:
                print(f"Warning: Could not retrieve complaint history: {e}")
                complaint_history = []
        
        child_identifier = f"{user_id}_{child_name}"
        temporal_result = integrate_temporal_drift(
            child_id=child_identifier,
            current_ml_score=risk_score_result['score_breakdown']['ml_score'],
            current_rule_score=risk_score_result['score_breakdown']['rule_score'],
            complaint_history=complaint_history
        )
        
        risk_score_result['total_score'] = temporal_result['final_score']
        risk_score_result['score_breakdown']['temporal_drift'] = temporal_result['drift_adjustment']
        risk_score_result['temporal_data'] = temporal_result['temporal_data']
        
        if temporal_result['final_score'] >= 50:
            risk_score_result['risk_level'] = 'high'
        elif temporal_result['final_score'] >= 35:
            risk_score_result['risk_level'] = 'medium'
        else:
            risk_score_result['risk_level'] = 'low'
        
        # Prepare complaint document
        complaint_doc = {
            "user_id": user_id,
            "guardian_name": form_data['guardian_name'],
            "child_name": form_data['child_name'],
            "age": age_val,
            "phone_number": form_data['phone_number'],
            "region": form_data['region'],
            "complaint": transcript,
            "child_gender": features['child_gender'],
            "hours_per_day_on_social_media": hours_val,
            "reporter_role": features['reporter_role'],
            "device_type": features['device_type'],
            "risk_level": risk_score_result['risk_level'].title() + " Risk",
            "risk_probability": prediction['probability_high_risk'],
            "predicted_label": prediction['predicted_label'],
            "risk_score": risk_score_result['total_score'],
            "risk_score_breakdown": risk_score_result['score_breakdown'],
            "triggered_indicators": risk_score_result['triggered_indicators'],
            "risk_explanation": risk_score_result['explanation'],
            "temporal_data": risk_score_result.get('temporal_data', {}),
            "input_method": "voice",  # Mark as voice input
            "voice_confidence": confidence,  # Store speech recognition confidence
            "timestamp": datetime.now()
        }
        
        # Save to database
        complaints_collection = get_complaints_collection()
        result = complaints_collection.insert_one(complaint_doc)
        
        complaint_doc['id'] = str(result.inserted_id)
        complaint_doc['_id'] = str(result.inserted_id)
        complaint_doc['timestamp'] = complaint_doc['timestamp'].isoformat()
        
        return jsonify(complaint_doc), 201
        
    except BadRequest as e:
        print(f"BadRequest Error: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"Error processing voice complaint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error processing voice complaint: {str(e)}"}), 500

@app.route("/api/complaints/voice-transcribe", methods=["POST"])
@token_required
def transcribe_voice_complaint(current_user):
    """Generate transcript preview for a recorded voice complaint."""
    try:
        if 'audio_file' not in request.files:
            raise BadRequest("No audio file provided")

        audio_file = request.files['audio_file']
        if audio_file.filename == '':
            raise BadRequest("Empty audio file")

        filename = secure_filename(audio_file.filename)
        file_extension = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        language = request.form.get('language', 'en-US')
        audio_data = audio_file.read()

        voice_result = process_voice_complaint(
            audio_data=audio_data,
            file_extension=file_extension,
            language=language
        )

        if not voice_result.get('success'):
            error_details = voice_result.get('error', 'Unable to transcribe audio')
            non_fatal_errors = [
                'Voice processing not available. Missing dependencies.',
                'Speech API not initialized. Check credentials.'
            ]

            if error_details in non_fatal_errors:
                return jsonify({
                    "transcript": "",
                    "confidence": 0.0,
                    "language": language,
                    "warning": error_details
                }), 200

            return jsonify({
                "error": "Voice transcription failed",
                "details": error_details
            }), 400

        return jsonify({
            "transcript": voice_result.get('transcript', ''),
            "confidence": voice_result.get('confidence', 0.0),
            "language": language
        })
    except BadRequest as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"Error transcribing voice complaint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error transcribing voice complaint: {str(e)}"}), 500

@app.route("/api/complaints/<string:complaint_id>", methods=["GET"])
def get_complaint(complaint_id: str):
    """Get a specific complaint by ID."""
    try:
        complaints_collection = get_complaints_collection()
        complaint = complaints_collection.find_one_by_id(complaint_id)
        
        if not complaint:
            raise NotFound("Complaint not found")
        
        complaint['id'] = str(complaint['_id'])
        complaint['_id'] = str(complaint['_id'])
        complaint['timestamp'] = complaint['timestamp'].isoformat()
        
        return jsonify(complaint)
    except NotFound as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/complaints", methods=["GET"])
def list_complaints():
    """List all complaints with pagination."""
    try:
        skip = int(request.args.get('skip', 0))
        limit = int(request.args.get('limit', 50))
        
        complaints_collection = get_complaints_collection()
        all_docs = complaints_collection.find(filters=None, limit=skip + limit)
        # apply skip/limit on the returned list
        sliced = all_docs[skip: skip + limit]
        complaints = []
        for doc in sliced:
            # Support both 'id' and '_id' styles
            if '_id' in doc:
                doc_id = doc['_id']
            else:
                doc_id = doc.get('id')
            doc['id'] = str(doc_id)
            doc['_id'] = str(doc_id)
            # timestamp may already be string
            if isinstance(doc.get('timestamp'), str):
                pass
            else:
                ts = doc.get('timestamp')
                doc['timestamp'] = ts.isoformat() if ts else None
            complaints.append(doc)
        
        return jsonify({
            "complaints": complaints,
            "count": len(complaints),
            "skip": skip,
            "limit": limit
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/complaints/latest", methods=["GET"])
@token_required
def get_latest_complaint(current_user):
    """Get the most recent complaint for the authenticated user."""
    try:
        complaints_collection = get_complaints_collection()
        # current_user is a dictionary, so access _id using dict syntax
        raw_user_id = current_user.get('_id') if isinstance(current_user, dict) else current_user._id
        user_id = str(raw_user_id)

        # Prefer normalized string user_id (how we store complaint payloads)
        try:
            results = complaints_collection.find(filters={"user_id": user_id}, limit=1)
            # Fallback for legacy records where user_id may be stored as non-string
            if not results and raw_user_id != user_id:
                results = complaints_collection.find(filters={"user_id": raw_user_id}, limit=1)
        except Exception:
            # Defensive fallback for adapter/filter edge-cases
            all_results = complaints_collection.find(filters=None, limit=500)
            filtered = [doc for doc in all_results if str(doc.get("user_id", "")) == user_id]
            results = filtered[:1]

        complaint = results[0] if results else None
        
        if not complaint:
            return jsonify({"error": "No complaints found"}), 404
        
        # Format the response
        complaint_id = complaint.get('_id', complaint.get('id'))
        complaint['id'] = str(complaint_id) if complaint_id is not None else None
        complaint['_id'] = str(complaint_id) if complaint_id is not None else None
        timestamp = complaint.get('timestamp')
        if isinstance(timestamp, str):
            complaint['timestamp'] = timestamp
        elif timestamp is not None and hasattr(timestamp, 'isoformat'):
            complaint['timestamp'] = timestamp.isoformat()
        else:
            complaint['timestamp'] = None
        
        return jsonify(complaint)
    except Exception as e:
        print(f"Error fetching latest complaint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/statistics", methods=["GET"])
def get_statistics():
    """Get user statistics - total complaints, high risk cases, and children count."""
    try:
        # Get user_id from request
        user_id = request.args.get('user_id')
        
        complaints_collection = get_complaints_collection()
        children_repo = get_children_collection = None
        # use children repo from database module
        from database import get_children_repo
        children_repo = get_children_repo()

        if user_id:
            total_complaints = complaints_collection.count_documents({"user_id": user_id})
            high_risk_complaints = complaints_collection.count_documents({"user_id": user_id, "risk_level": "High Risk"})
            children_count = children_repo.count_children(user_id)
        else:
            total_complaints = complaints_collection.count_documents({})
            high_risk_complaints = complaints_collection.count_documents({"risk_level": "High Risk"})
            children_count = children_repo.count_children()
        
        return jsonify({
            "totalComplaints": total_complaints,
            "highRiskComplaints": high_risk_complaints,
            "children": children_count
        })
    except Exception as e:
        print(f"Error fetching statistics: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/temporal/analysis/<string:user_id>/<string:child_name>", methods=["GET"])
@token_required
def get_temporal_analysis(current_user, user_id, child_name):
    """
    Get temporal drift analysis for a specific child.
    
    Returns complaint history with time-series data and trend analysis.
    """
    try:
        # Verify user authorization
        current_user_id = current_user.get('_id') if isinstance(current_user, dict) else str(current_user._id)
        if current_user_id != user_id:
            return jsonify({"error": "Unauthorized access"}), 403
        
        complaints_collection = get_complaints_collection()
        
        # Get all complaints for this child
        all_complaints = complaints_collection.find(
            filters={'user_id': user_id},
            limit=100  # Last 100 complaints
        )
        
        # Filter to specific child
        child_complaints = [
            c for c in all_complaints 
            if c.get('child_name', '').lower() == child_name.lower()
        ]
        
        if not child_complaints:
            return jsonify({
                "message": "No complaint history found for this child",
                "child_name": child_name,
                "complaint_count": 0
            }), 404
        
        # Convert timestamps for analysis
        for c in child_complaints:
            if isinstance(c.get('timestamp'), str):
                try:
                    c['timestamp'] = datetime.fromisoformat(c['timestamp'])
                except:
                    c['timestamp'] = datetime.now()
            if 'ml_risk_score' not in c:
                c['ml_risk_score'] = c.get('risk_score', 0)
        
        # Create analyzer and generate time series data
        analyzer = TemporalDriftAnalyzer()
        time_series = analyzer.generate_time_series_data(child_complaints)
        
        # Get current temporal analysis
        latest_complaint = sorted(child_complaints, key=lambda x: x['timestamp'])[-1]
        historical_complaints = child_complaints[:-1]  # Exclude latest
        
        temporal_analysis = analyzer.analyze_temporal_drift(
            child_id=f"{user_id}_{child_name}",
            current_score=latest_complaint.get('ml_risk_score', 0),
            complaint_history=historical_complaints
        )
        
        return jsonify({
            "child_name": child_name,
            "complaint_count": len(child_complaints),
            "time_series_data": time_series,
            "current_analysis": temporal_analysis,
            "date_range": {
                "first_complaint": time_series[0]['date'] if time_series else None,
                "latest_complaint": time_series[-1]['date'] if time_series else None
            }
        }), 200
        
    except Exception as e:
        print(f"Error fetching temporal analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Error Handlers
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({"error": "Not Found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal Server Error"}), 500

if __name__ == "__main__":
    # For development, use Flask's built-in server
    # For production, use a WSGI server like Gunicorn
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 8000)), debug=False)

