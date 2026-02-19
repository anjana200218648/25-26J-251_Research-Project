"""
Quick test to submit a complaint and see the actual response
"""
import requests
import json

API_URL = "http://localhost:8000/api/complaints/submit"

# Test complaint data
complaint_data = {
    "guardian_name": "Test Parent",
    "child_name": "Test Child",
    "age": 14,
    "phone_number": "1234567890",
    "region": "Test Region",
    "complaint": "My daughter spends long hours on social media every day and becomes extremely angry when her phone is taken away. Her school performance has dropped significantly, and she avoids family interactions.",
    "child_gender": "Female",
    "hours_per_day_on_social_media": 7.0,

    "reporter_role": "parent",
    "user_id": "test123"
}

print("="*80)
print("SUBMITTING COMPLAINT TO BACKEND...")
print("="*80 + "\n")

try:
    response = requests.post(API_URL, json=complaint_data, timeout=30)
    
    print(f"Status Code: {response.status_code}\n")
    
    if response.ok:
        result = response.json()
        print("✅ SUCCESS! Response from backend:")
        print("="*80)
        print(f"Risk Level: {result.get('risk_level')}")
        print(f"Risk Score: {result.get('risk_score')}/100")
        print(f"ML Probability: {result.get('risk_probability'):.2%}")
        print(f"ML Predicted Label: {result.get('predicted_label')}")
        print(f"\nTriggered Indicators:")
        for indicator in result.get('triggered_indicators', []):
            print(f"  ✓ {indicator}")
        print("="*80)
        
        # Check what the frontend will see
        risk_level_str = result.get('risk_level', '').lower()
        will_show_high = 'high' in risk_level_str
        will_show_medium = 'medium' in risk_level_str
        
        print(f"\nFRONTEND WILL DISPLAY:")
        if will_show_high:
            print("  🔴 HIGH RISK")
        elif will_show_medium:
            print("  🟠 MEDIUM RISK")
        else:
            print("  🟢 LOW RISK")
        print("="*80)
    else:
        print(f"❌ ERROR: {response.status_code}")
        print(response.text)
        
except requests.exceptions.ConnectionError:
    print("❌ ERROR: Cannot connect to backend. Make sure it's running on http://localhost:8000")
except Exception as e:
    print(f"❌ ERROR: {e}")
