"""
Unit tests for ReportParser
"""

import sys
from pathlib import Path

# Add src to Python path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

# Now import from src
from report_parser import ReportParser


def test_parse_media_report():
    """Test parsing media report from text"""
    
    sample_text = """
    📘 Report 1 – Media Analysis
    
    1. Image Content Detection:
    - Primary Detected Category: Anime Content
    - Drugs Detected: No
    - Weapon Detected: No
    - Environment: Indoor, night-time usage
    
    2. Caption Analysis:
    - Obsession Indicator: Moderate
    
    3. Hashtag Analysis:
    - Community Type: anime-related online groups
    
    4. Media Risk Score:
    Final Media Risk Score: 69 / 100
    
    5. Interpretation:
    The detected media content indicates a moderate level of risk.
    """
    
    parser = ReportParser()
    result = parser.parse_media_report(sample_text)
    
    print("\n=== Media Report Parsing Test ===")
    print(f"Risk Score: {result['risk_score']}")
    print(f"Category: {result['category']}")
    print(f"Drugs Detected: {result['drugs_detected']}")
    print(f"Obsession Level: {result['obsession_level']}")
    print(f"Community Type: {result['community_type']}")
    
    assert result['risk_score'] == 69, f"Expected 69, got {result['risk_score']}"
    assert result['category'] == "Anime Content"
    assert result['drugs_detected'] == False
    
    print("✓ Media report parsing test passed!")


def test_parse_complaint_report():
    """Test parsing complaint report from text"""
    
    sample_text = """
    📗 Report 2 – Complaint Analysis
    
    2. Text Analysis:
    - Sleep-related issues: Yes
    - School avoidance behaviour: Yes
    - Excessive device usage: Yes
    - Behavioural reaction to restriction: Anger
    
    3. Past Complaint Analysis:
    - Number of previous complaints: 3
    - Behaviour frequency: Daily
    - Behaviour trend over time: Worsening
    
    4. Complaint Risk Score:
    Final Complaint Risk Score: 78 / 100
    
    5. System Interpretation:
    The complaint description suggests a high behavioural risk.
    
    6. Recommended Action:
    Immediate intervention and counselling are recommended.
    """
    
    parser = ReportParser()
    result = parser.parse_complaint_report(sample_text)
    
    print("\n=== Complaint Report Parsing Test ===")
    print(f"Risk Score: {result['risk_score']}")
    print(f"Sleep Issues: {result['sleep_issues']}")
    print(f"Previous Complaints: {result['previous_complaints']}")
    print(f"Trend: {result['trend']}")
    print(f"Recommended Action: {result['recommended_action']}")
    
    assert result['risk_score'] == 78, f"Expected 78, got {result['risk_score']}"
    assert result['sleep_issues'] == True
    assert result['previous_complaints'] == 3
    assert result['trend'] == "Worsening"
    
    print("✓ Complaint report parsing test passed!")


if __name__ == "__main__":
    print("Running ReportParser tests...")
    print("=" * 50)
    
    test_parse_media_report()
    test_parse_complaint_report()
    
    print("\n" + "=" * 50)
    print("✓ All tests passed successfully!")