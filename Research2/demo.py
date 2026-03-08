"""
Demo Script - Complete Integration Test
Shows how to use ReportParser and RiskAnalyzer together
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from report_parser import ReportParser
from risk_analyzer import RiskAnalyzer


def demo_text_analysis():
    """
    Demo: Analyze two text reports (simulating PDF input)
    This is what happens when user uploads two PDF reports
    """
    
    print("=" * 70)
    print("AI-BASED CHILD SOCIAL MEDIA ADDICTION RISK ASSESSMENT SYSTEM")
    print("=" * 70)
    
    # Sample Report 1 - Media Analysis
    media_report_text = """
    Complaint ID: C-0001
    Generated On: 2025-01-08 09:05 | Model Version: v2.1
    
    📘 Report 1 – Media Analysis
    
    Input Type: Image + Caption + Hashtags
    
    1. Image Content Detection:
    - Primary Detected Category: Anime Content
    - Detected Elements: anime, phone
    - Drugs Detected: No
    - Weapon Detected: No
    - Fight Scene Detected: No
    - Environment: Indoor, night-time usage
    
    2. Caption Analysis:
    - Caption Text: "Just one more episode before sleep."
    - Obsession Indicator: Moderate
    - Negative Emotional Indicators: Mild
    - Self-harm or suicidal indications: Not detected
    
    3. Hashtag Analysis:
    - Community Type: anime-related online groups
    - Engagement Pattern: Repeated interaction observed
    
    4. Media Risk Score:
    Final Media Risk Score: 69 / 100
    
    5. Interpretation:
    The detected media content and engagement patterns indicate a moderate level of media-related risk.
    """
    
    # Sample Report 2 - Complaint Analysis
    complaint_report_text = """
    📗 Report 2 – Complaint Analysis
    
    1. Complaint Summary:
    The parent reports that the child binge-watches animated series for extended periods and neglects proper rest.
    
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
    The complaint description aligns with the detected media content and suggests a high behavioural risk.
    
    6. Recommended Action:
    Immediate intervention and counselling are recommended.
    """
    
    print("\n📥 STEP 1: PARSING UPLOADED REPORTS")
    print("-" * 70)
    
    # Initialize parser
    parser = ReportParser()
    
    # Parse both reports
    print("✓ Parsing Media Analysis Report...")
    media_data = parser.parse_media_report(media_report_text)
    
    print("✓ Parsing Complaint Analysis Report...")
    complaint_data = parser.parse_complaint_report(complaint_report_text)
    
    print("\n📊 EXTRACTED DATA:")
    print(f"  Media Risk Score: {media_data['risk_score']}/100")
    print(f"  Category: {media_data['category']}")
    print(f"  Complaint Risk Score: {complaint_data['risk_score']}/100")
    print(f"  Trend: {complaint_data['trend']}")
    
    # Analyze risks
    print("\n\n🔍 STEP 2: RISK ANALYSIS & CONFLICT DETECTION")
    print("-" * 70)
    
    analyzer = RiskAnalyzer()
    analysis = analyzer.analyze(media_data, complaint_data)
    
    print(f"\n📈 RISK COMPARISON:")
    print(f"  Media Risk:      {analysis['media_risk']['raw_score']}/100 → {analysis['media_risk']['risk_level']}")
    print(f"                   Normalized: {analysis['media_risk']['normalized_score']}/10")
    print(f"\n  Complaint Risk:  {analysis['complaint_risk']['raw_score']}/100 → {analysis['complaint_risk']['risk_level']}")
    print(f"                   Normalized: {analysis['complaint_risk']['normalized_score']}/10")
    
    print(f"\n⚠️  CONFLICT EVALUATION:")
    print(f"  Risk Gap: {analysis['risk_gap']} points")
    print(f"  Conflict Type: {analysis['conflict_type']}")
    if analysis['conflict_reason']:
        print(f"  Conflict Reason: {analysis['conflict_reason']}")
    
    print(f"\n🎯 FINAL DECISION:")
    if analysis['unified_risk_score']:
        print(f"  Unified Risk Score: {analysis['unified_risk_score']}/100")
        print(f"  Risk Level: {analysis['unified_risk_level']}")
    else:
        print(f"  Unified Risk Score: SUSPENDED (High Conflict)")
    
    print(f"  Confidence Level: {analysis['confidence_level'] * 100}%")
    print(f"  Manual Review Required: {'YES ⚠️' if analysis['requires_manual_review'] else 'NO ✓'}")
    
    print(f"\n💡 SYSTEM INTERPRETATION:")
    print(f"  {analysis['analysis_summary']}")
    
    print("\n" + "=" * 70)
    print("✓ ANALYSIS COMPLETE")
    print("=" * 70)
    
    return analysis


def demo_high_conflict():
    """
    Demo: Show what happens with high conflict (very different scores)
    """
    
    print("\n\n" + "=" * 70)
    print("DEMO: HIGH CONFLICT SCENARIO")
    print("=" * 70)
    
    # Low media risk but very high complaint risk
    media_data = {
        'risk_score': 25,
        'category': 'Educational Content',
        'drugs_detected': False,
        'weapon_detected': False,
        'fight_detected': False,
        'obsession_level': 'Low'
    }
    
    complaint_data = {
        'risk_score': 85,
        'sleep_issues': True,
        'school_avoidance': True,
        'device_usage': True,
        'behavioral_reaction': 'Extreme Anger',
        'previous_complaints': 7,
        'frequency': 'Constant',
        'trend': 'Rapidly Worsening'
    }
    
    print("\n📊 SCENARIO:")
    print(f"  Media shows: {media_data['category']} (Risk: {media_data['risk_score']}/100)")
    print(f"  Parent reports: Severe behavioral issues (Risk: {complaint_data['risk_score']}/100)")
    
    analyzer = RiskAnalyzer()
    analysis = analyzer.analyze(media_data, complaint_data)
    
    print(f"\n⚠️  CONFLICT DETECTION:")
    print(f"  Risk Gap: {analysis['risk_gap']} points")
    print(f"  Conflict Type: {analysis['conflict_type']}")
    print(f"  Probable Cause: {analysis['conflict_reason']}")
    
    print(f"\n🎯 SYSTEM DECISION:")
    print(f"  Unified Risk Score: {analysis['unified_risk_score'] or 'SUSPENDED'}")
    print(f"  Confidence: {analysis['confidence_level'] * 100}%")
    print(f"  Manual Review: {'REQUIRED ⚠️' if analysis['requires_manual_review'] else 'NOT REQUIRED'}")
    
    print(f"\n💡 EXPLANATION:")
    print(f"  {analysis['analysis_summary']}")
    
    print("\n" + "=" * 70)


if __name__ == "__main__":
    # Run the demos
    demo_text_analysis()
    demo_high_conflict()
    
    print("\n\n✅ All demos completed successfully!")
    print("\nNext Steps:")
    print("  1. Implement Report Generator (final PDF creation)")
    print("  2. Build web interface for PDF upload")
    print("  3. Deploy the system")


