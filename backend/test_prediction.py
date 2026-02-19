"""
Test script to verify model predictions for specific complaint scenarios
"""
from model_service import ModelService
from risk_scoring import calculate_risk_score

# Initialize model
print("Loading model...")
model_service = ModelService()
model_service.load_model()
print("✅ Model loaded\n")

# Test Case: Your example with high hours
complaint_text = "My daughter spends long hours on social media every day and becomes extremely angry when her phone is taken away. Her school performance has dropped significantly, and she avoids family interactions."

# Sample features for a 14-year-old spending 14.5 hours/day (VERY HIGH)
features = {
    'age_of_child': 14,
    'hours_per_day_on_social_media': 14.5,
    'child_gender': 'F',
    'reporter_role': 'parent'
}

print("="*80)
print("TEST COMPLAINT:")
print(f"Text: {complaint_text}")
print(f"\nFeatures:")
for key, value in features.items():
    print(f"  {key}: {value}")
print("="*80 + "\n")

# Get ML prediction
prediction = model_service.predict(complaint_text, features)

print("\n" + "="*80)
print("ML MODEL PREDICTION:")
print(f"  Probability High Risk: {prediction['probability_high_risk']:.2%}")
print(f"  Predicted Label: {prediction['predicted_label']} ({'High Risk' if prediction['predicted_label'] == 1 else 'Low Risk'})")
print(f"  Method: {prediction['method']}")
if prediction['rule_triggered']:
    print(f"  Rule Triggered: {prediction['rule_reason']}")
print("="*80 + "\n")

# Calculate comprehensive risk score
risk_score_result = calculate_risk_score(
    ml_probability=prediction['probability_high_risk'],
    complaint_text=complaint_text,
    hours_per_day=features['hours_per_day_on_social_media'],
    previous_risk_level="low",
    previous_ml_score=None
)

print("="*80)
print("COMPREHENSIVE RISK ASSESSMENT:")
print(f"  Total Score: {risk_score_result['total_score']}/100")
print(f"  Risk Level: {risk_score_result['risk_level'].upper()}")
print(f"\nScore Breakdown:")
for component, score in risk_score_result['score_breakdown'].items():
    print(f"  - {component}: {score}")
print(f"\nTriggered Indicators:")
for indicator in risk_score_result['triggered_indicators']:
    print(f"  ✓ {indicator}")
print(f"\nExplanation: {risk_score_result['explanation']}")
print("="*80)

# Expected result
print("\n" + "="*80)
print("EXPECTED RESULT FOR THIS CASE:")
print("  ✅ Should be: HIGH RISK")
print("  Reasons:")
print("    - Long hours on social media (7 hours/day)")
print("    - Addiction/withdrawal symptoms (extremely angry when phone taken)")
print("    - Academic decline (school performance dropped)")
print("    - Social isolation (avoids family interactions)")
print("="*80)
