"""
Unit tests for RiskAnalyzer
"""

import sys
from pathlib import Path

# Add src to Python path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

# Now import from src
from risk_analyzer import RiskAnalyzer, RiskLevel, ConflictType


def test_normalize_score():
    """Test score normalization"""
    analyzer = RiskAnalyzer()
    
    assert analyzer.normalize_score(0) == 0.0
    assert analyzer.normalize_score(50) == 5.0
    assert analyzer.normalize_score(100) == 10.0
    assert analyzer.normalize_score(69) == 6.9
    assert analyzer.normalize_score(78) == 7.8
    
    print("✓ Score normalization test passed!")


def test_classify_risk_level():
    """Test risk level classification"""
    analyzer = RiskAnalyzer()
    
    assert analyzer.classify_risk_level(30) == RiskLevel.LOW
    assert analyzer.classify_risk_level(55) == RiskLevel.MEDIUM
    assert analyzer.classify_risk_level(85) == RiskLevel.HIGH
    assert analyzer.classify_risk_level(None) == RiskLevel.UNCERTAIN
    
    print("✓ Risk level classification test passed!")


def test_calculate_risk_gap():
    """Test risk gap calculation"""
    analyzer = RiskAnalyzer()
    
    assert analyzer.calculate_risk_gap(69, 78) == 9
    assert analyzer.calculate_risk_gap(78, 69) == 9
    assert analyzer.calculate_risk_gap(50, 50) == 0
    assert analyzer.calculate_risk_gap(30, 80) == 50
    
    print("✓ Risk gap calculation test passed!")


def test_classify_conflict():
    """Test conflict classification"""
    analyzer = RiskAnalyzer()
    
    # Consistent (0-15)
    assert analyzer.classify_conflict(10) == ConflictType.CONSISTENT
    
    # Partial inconsistency (16-40)
    assert analyzer.classify_conflict(25) == ConflictType.PARTIAL_INCONSISTENCY
    
    # High inconsistency (>40)
    assert analyzer.classify_conflict(50) == ConflictType.HIGH_INCONSISTENCY
    
    print("✓ Conflict classification test passed!")


def test_unified_risk_score():
    """Test unified risk score calculation"""
    analyzer = RiskAnalyzer()
    
    # Consistent reports (equal weight)
    score = analyzer.calculate_unified_risk_score(60, 70, ConflictType.CONSISTENT)
    assert score == 65  # (60*0.5 + 70*0.5)
    
    # Partial inconsistency (60% weight to complaint)
    score = analyzer.calculate_unified_risk_score(60, 80, ConflictType.PARTIAL_INCONSISTENCY)
    assert score == 72  # (60*0.4 + 80*0.6)
    
    # High inconsistency (should return None)
    score = analyzer.calculate_unified_risk_score(30, 90, ConflictType.HIGH_INCONSISTENCY)
    assert score is None
    
    print("✓ Unified risk score test passed!")


def test_full_analysis():
    """Test complete risk analysis with sample data"""
    analyzer = RiskAnalyzer()
    
    # Sample data from your example reports
    media_data = {
        'risk_score': 69,
        'category': 'Anime Content',
        'drugs_detected': False,
        'weapon_detected': False,
        'obsession_level': 'Moderate'
    }
    
    complaint_data = {
        'risk_score': 78,
        'sleep_issues': True,
        'school_avoidance': True,
        'previous_complaints': 3,
        'trend': 'Worsening',
        'frequency': 'Daily'
    }
    
    result = analyzer.analyze(media_data, complaint_data)
    
    print("\n=== Full Analysis Test ===")
    print(f"Media Risk: {result['media_risk']['raw_score']} → {result['media_risk']['risk_level']}")
    print(f"Complaint Risk: {result['complaint_risk']['raw_score']} → {result['complaint_risk']['risk_level']}")
    print(f"Risk Gap: {result['risk_gap']}")
    print(f"Conflict Type: {result['conflict_type']}")
    print(f"Unified Score: {result['unified_risk_score']}")
    print(f"Confidence: {result['confidence_level']}")
    print(f"Manual Review Required: {result['requires_manual_review']}")
    print(f"\nSummary: {result['analysis_summary'][:100]}...")
    
    # Assertions
    assert result['risk_gap'] == 9
    assert result['conflict_type'] == "Consistent"
    assert result['unified_risk_score'] is not None
    assert result['confidence_level'] > 0.9
    assert result['requires_manual_review'] == False
    
    print("\n✓ Full analysis test passed!")


def test_high_conflict_scenario():
    """Test high conflict detection"""
    analyzer = RiskAnalyzer()
    
    # High conflict: low media risk but very high complaint risk
    media_data = {
        'risk_score': 25,
        'drugs_detected': False,
        'weapon_detected': False
    }
    
    complaint_data = {
        'risk_score': 85,
        'sleep_issues': True,
        'school_avoidance': True,
        'previous_complaints': 5,
        'trend': 'Worsening'
    }
    
    result = analyzer.analyze(media_data, complaint_data)
    
    print("\n=== High Conflict Scenario Test ===")
    print(f"Risk Gap: {result['risk_gap']}")
    print(f"Conflict Type: {result['conflict_type']}")
    print(f"Conflict Reason: {result['conflict_reason']}")
    print(f"Unified Score: {result['unified_risk_score']}")
    print(f"Manual Review Required: {result['requires_manual_review']}")
    
    assert result['risk_gap'] == 60
    assert result['conflict_type'] == "High Inconsistency"
    assert result['unified_risk_score'] is None  # Suspended for high conflict
    assert result['requires_manual_review'] == True
    
    print("✓ High conflict scenario test passed!")


if __name__ == "__main__":
    print("Running RiskAnalyzer tests...")
    print("=" * 60)
    
    test_normalize_score()
    test_classify_risk_level()
    test_calculate_risk_gap()
    test_classify_conflict()
    test_unified_risk_score()
    test_full_analysis()
    test_high_conflict_scenario()
    
    print("\n" + "=" * 60)
    print("✓ All RiskAnalyzer tests passed successfully!")