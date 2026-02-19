#!/usr/bin/env python3
"""Test multimodal ML model output only (no risk scoring)."""

from model_service import ModelService

def test_ml_model_only():
    """Test the ML model predictions without risk scoring"""

    # Initialize and load model
    service = ModelService()
    service.load_model()

    print('=' * 80)
    print('MULTIMODAL ML MODEL OUTPUT ONLY - TEST CASES')
    print('=' * 80)

    # Test Case 1: High risk scenario
    print('\nTEST CASE 1: HIGH RISK SCENARIO')
    print('-' * 50)

    result1 = service.predict(
        text='My daughter spends long hours on social media every day and becomes extremely angry when her phone is taken away. Her school performance has dropped significantly, and she avoids family interactions.',
        numeric_features={
            'age_of_child': 14,
            'hours_per_day_on_social_media': 14.5,
            'child_gender': 'Female',
            'reporter_role': 'parent',
            'device_type': 'smartphone'
        }
    )

    print('   ML MODEL OUTPUT:')
    print(f'   Probability High Risk: {result1["probability_high_risk"]:.2%}')
    print(f'   Predicted Label: {result1["predicted_label"]} ({result1.get("predicted_label_name", "")})')
    print(f'   Threshold Used: {result1["threshold_used"]}')
    print(f'   Method: {result1["method"]}')

    # Test Case 2: Low risk scenario
    print('\n TEST CASE 2: LOW RISK SCENARIO')
    print('-' * 50)

    result2 = service.predict(
        text='My son uses social media mostly in the evenings after finishing his homework. Occasionally he spends a bit too much time but generally balanced.',
        numeric_features={
            'age_of_child': 16,
            'hours_per_day_on_social_media': 3.5,
            'child_gender': 'Male',
            'reporter_role': 'mother',
            'device_type': 'laptop'
        }
    )

    print('  ML MODEL OUTPUT:')
    print(f'   Probability High Risk: {result2["probability_high_risk"]:.2%}')
    print(f'   Predicted Label: {result2["predicted_label"]} ({result2.get("predicted_label_name", "")})')
    print(f'   Threshold Used: {result2["threshold_used"]}')
    print(f'   Method: {result2["method"]}')

    # Test Case 3: Borderline case
    print('\n  TEST CASE 3: BORDERLINE CASE')
    print('-' * 50)

    result3 = service.predict(
        text='Child is spending 7 hours daily on social media. Notice some irritability when asked to stop. Homework completion has been inconsistent.',
        numeric_features={
            'age_of_child': 15,
            'hours_per_day_on_social_media': 7.0,
            'child_gender': 'Female',
            'reporter_role': 'parent',
            'device_type': 'tablet'
        }
    )

    print('  ML MODEL OUTPUT:')
    print(f'   Probability High Risk: {result3["probability_high_risk"]:.2%}')
    print(f'   Predicted Label: {result3["predicted_label"]} ({result3.get("predicted_label_name", "")})')
    print(f'   Threshold Used: {result3["threshold_used"]}')
    print(f'   Method: {result3["method"]}')

    # Test Case 4: Social media keyword stress test
    print('\n  TEST CASE 4: SOCIAL MEDIA KEYWORDS')
    print('-' * 50)

    result4 = service.predict(
        text='Spends hours scrolling TikTok and Instagram reels late at night, ignores family, and gets angry when screen time is limited.',
        numeric_features={
            'age_of_child': 13,
            'hours_per_day_on_social_media': 8.5,
            'child_gender': 'Female',
            'reporter_role': 'mother',
            'device_type': 'smartphone'
        }
    )

    print('  ML MODEL OUTPUT:')
    print(f'   Probability High Risk: {result4["probability_high_risk"]:.2%}')
    print(f'   Predicted Label: {result4["predicted_label"]} ({result4.get("predicted_label_name", "")})')
    print(f'   Threshold Used: {result4["threshold_used"]}')
    print(f'   Method: {result4["method"]}')

    print('\n' + '=' * 80)
    print('SUMMARY: ML MODEL PREDICTIONS ONLY')
    print('=' * 80)
    print(f'Test Case 1 (High Risk): {result1["probability_high_risk"]:.1%} → {result1.get("predicted_label_name", "")}')
    print(f'Test Case 2 (Low Risk):  {result2["probability_high_risk"]:.1%} → {result2.get("predicted_label_name", "")}')
    print(f'Test Case 3 (Borderline): {result3["probability_high_risk"]:.1%} → {result3.get("predicted_label_name", "")}')
    print(f'Test Case 4 (Keywords): {result4["probability_high_risk"]:.1%} → {result4.get("predicted_label_name", "")}')

if __name__ == "__main__":
    test_ml_model_only()