"""
Temporal Drift Tracking Module

This module monitors changes in a child's risk level over time by analyzing 
complaint history. It detects behavioral pattern trends (worsening, stable, improving)
to provide more accurate risk assessments.

Key Features:
- Time-series analysis of complaint history
- Moving average calculation for risk trends
- Spike detection for sudden behavioral changes
- Drift score calculation (temporal risk adjustment)
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Tuple
import statistics


class TemporalDriftAnalyzer:
    """
    Analyzes complaint history to detect temporal patterns in child behavior.
    
    Uses statistical methods to identify:
    - Escalating risk patterns
    - Stable behavior
    - Improving trends
    """
    
    def __init__(self):
        # Thresholds for drift detection
        self.CRITICAL_INCREASE_THRESHOLD = 20  # 20+ point increase = critical
        self.MODERATE_INCREASE_THRESHOLD = 8   # 8-19 point increase = escalation
        self.SPIKE_THRESHOLD = 15  # Single complaint spike threshold (vs recent avg)
        
        # Time windows for analysis
        self.RECENT_WINDOW_DAYS = 7    # Recent behavior window
        self.BASELINE_WINDOW_DAYS = 30  # Baseline comparison window
        
    def analyze_temporal_drift(
        self, 
        child_id: str, 
        current_score: float, 
        complaint_history: List[Dict]
    ) -> Dict:
        """
        Main analysis function that evaluates temporal drift patterns.
        
        Args:
            child_id: Unique identifier for the child
            current_score: Current complaint risk score (0-100)
            complaint_history: List of previous complaints with scores and timestamps
            
        Returns:
            Dict containing:
            - drift_score: Additional risk points based on temporal patterns
            - pattern: Classification (stable/escalation/critical)
            - explanation: Human-readable description
            - trend_data: Statistical trend information
        """
        
        # If no history, return neutral baseline
        if not complaint_history or len(complaint_history) == 0:
            return {
                'drift_score': 0,
                'pattern': 'baseline',
                'explanation': 'First complaint - no historical data available',
                'trend_data': {
                    'complaint_count': 0,
                    'avg_recent': current_score,
                    'avg_baseline': current_score
                }
            }
        
        # Sort complaints by timestamp (oldest to newest)
        sorted_complaints = sorted(
            complaint_history, 
            key=lambda x: self._to_utc_aware(x.get('timestamp'))
        )
        
        # Calculate time-based metrics
        recent_avg = self._calculate_moving_average(
            sorted_complaints, 
            days=self.RECENT_WINDOW_DAYS
        )
        
        baseline_avg = self._calculate_moving_average(
            sorted_complaints, 
            days=self.BASELINE_WINDOW_DAYS
        )
        
        # Detect sudden spikes in recent complaints
        spike_detected = self._detect_spike(sorted_complaints, current_score)
        
        # Calculate drift based on trend comparison
        drift_score, pattern, explanation = self._calculate_drift_adjustment(
            current_score=current_score,   # full base score (ml + rule)
            recent_avg=recent_avg,
            baseline_avg=baseline_avg,
            spike_detected=spike_detected,
            complaint_count=len(sorted_complaints)
        )
        
        return {
            'drift_score': drift_score,
            'pattern': pattern,
            'explanation': explanation,
            'trend_data': {
                'complaint_count': len(sorted_complaints),
                'avg_recent': round(recent_avg, 2),
                'avg_baseline': round(baseline_avg, 2),
                'spike_detected': spike_detected,
                'days_since_first': self._days_between(
                    sorted_complaints[0].get('timestamp'),
                    datetime.now()
                )
            }
        }
    
    def _calculate_moving_average(
        self, 
        complaints: List[Dict], 
        days: int
    ) -> float:
        """
        Calculate average risk score for complaints within specified time window.
        
        Args:
            complaints: Sorted list of complaints
            days: Number of days to look back
            
        Returns:
            Average risk score for the time window
        """
        if not complaints:
            return 0.0
        
        # Define time window cutoff
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        # Filter complaints within time window
        recent_complaints = [
            c for c in complaints 
            if self._to_utc_aware(c.get('timestamp')) >= cutoff_date
        ]
        
        if not recent_complaints:
            # If no complaints in window, use oldest available
            recent_complaints = complaints
        
        # Extract risk scores (handle both 'ml_risk_score' and 'risk_score' fields)
        scores = []
        for c in recent_complaints:
            score = c.get('ml_risk_score') or c.get('risk_score', 0)
            scores.append(float(score))
        
        return statistics.mean(scores) if scores else 0.0
    
    def _detect_spike(
        self, 
        complaints: List[Dict], 
        current_score: float
    ) -> bool:
        """
        Detect if current complaint represents a sudden spike in risk.
        
        A spike is defined as a sudden large increase compared to recent history.
        
        Args:
            complaints: Historical complaints
            current_score: Current complaint risk score
            
        Returns:
            True if spike detected, False otherwise
        """
        if not complaints:
            return False
        
        # Get last 3 complaints for comparison
        recent_complaints = complaints[-3:] if len(complaints) >= 3 else complaints
        
        # Calculate average of recent complaints
        recent_scores = [
            float(c.get('ml_risk_score') or c.get('risk_score', 0)) 
            for c in recent_complaints
        ]
        recent_avg = statistics.mean(recent_scores) if recent_scores else 0
        
        # Spike detected if current score significantly exceeds recent average
        score_increase = current_score - recent_avg
        return score_increase >= self.SPIKE_THRESHOLD
    
    def _calculate_drift_adjustment(
        self,
        current_score: float,
        recent_avg: float,
        baseline_avg: float,
        spike_detected: bool,
        complaint_count: int
    ) -> Tuple[float, str, str]:
        """
        Calculate temporal drift adjustment and classify pattern.
        
        Logic:
        - Compare recent trend vs baseline trend
        - Detect escalation, stability, or improvement
        - Apply drift score adjustment
        
        Args:
            current_score: Current complaint score
            recent_avg: Recent 7-day average
            baseline_avg: 30-day baseline average
            spike_detected: Whether a sudden spike was detected
            complaint_count: Total number of historical complaints
            
        Returns:
            Tuple of (drift_score, pattern, explanation)
        """
        
        # Calculate trend difference (positive = worsening, negative = improving)
        trend_difference = recent_avg - baseline_avg
        
        # Secondary signal: how does the CURRENT complaint compare to child's baseline?
        current_vs_baseline = current_score - baseline_avg if baseline_avg > 0 else 0

        # CRITICAL PATTERN: Sudden spike OR severe trend escalation OR current complaint far above history
        if spike_detected or trend_difference >= self.CRITICAL_INCREASE_THRESHOLD or current_vs_baseline >= 25:
            reason = []
            if spike_detected:
                reason.append('Sudden spike detected in current complaint.')
            if trend_difference >= self.CRITICAL_INCREASE_THRESHOLD:
                reason.append(f'Trend increased by {trend_difference:.1f} points.')
            if current_vs_baseline >= 25:
                reason.append(f'Current score ({current_score:.1f}) is {current_vs_baseline:.1f} points above historical average.')
            return (
                15,
                'critical_escalation',
                f'Critical escalation detected: Recent behavior significantly worse than baseline. '
                + ' '.join(reason)
            )

        # ESCALATION PATTERN: Moderate worsening trend OR current complaint notably above history
        elif trend_difference >= self.MODERATE_INCREASE_THRESHOLD or current_vs_baseline >= 15:
            reason = []
            if trend_difference >= self.MODERATE_INCREASE_THRESHOLD:
                reason.append(f'Recent average {recent_avg:.1f} vs baseline {baseline_avg:.1f}.')
            if current_vs_baseline >= 15:
                reason.append(f'Current score ({current_score:.1f}) exceeds historical average by {current_vs_baseline:.1f} points.')
            return (
                10,
                'escalation',
                f'Escalating risk pattern: Behavior worsening over time. '
                + ' '.join(reason)
                + f' Based on {complaint_count} previous complaints.'
            )

        # STABLE PATTERN: No significant change
        elif abs(trend_difference) < self.MODERATE_INCREASE_THRESHOLD and abs(current_vs_baseline) < 15:
            if baseline_avg >= 50:
                return (
                    5,
                    'stable_high',
                    f'Consistently high risk: Pattern stable but concerning. '
                    f'Average score remains around {baseline_avg:.1f}. '
                    f'{complaint_count} complaints recorded.'
                )
            else:
                return (
                    0,
                    'stable',
                    f'Stable pattern: No significant change in behavior. '
                    f'Average score around {baseline_avg:.1f}.'
                )

        # IMPROVING PATTERN: Risk decreasing over time
        else:
            return (
                -5,
                'improving',
                f'Improving trend: Recent behavior better than baseline. '
                f'Risk decreased by {abs(trend_difference):.1f} points. '
                f'Continue monitoring for sustained improvement.'
            )
    
    def _days_between(self, start_date: datetime, end_date: datetime) -> int:
        """
        Calculate number of days between two dates.
        
        Args:
            start_date: Earlier date
            end_date: Later date
            
        Returns:
            Number of days between dates
        """
        if not start_date or not end_date:
            return 0

        start_aware = self._to_utc_aware(start_date)
        end_aware = self._to_utc_aware(end_date)
        delta = end_aware - start_aware
        return delta.days

    def _to_utc_aware(self, dt) -> datetime:
        """Normalize datetime values to timezone-aware UTC for safe comparison."""
        if not isinstance(dt, datetime):
            return datetime.min.replace(tzinfo=timezone.utc)

        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)

        return dt.astimezone(timezone.utc)
    
    def generate_time_series_data(self, complaints: List[Dict]) -> List[Dict]:
        """
        Generate time-series data points for visualization.
        
        Args:
            complaints: List of complaints with timestamps and scores
            
        Returns:
            List of data points with date and risk score
        """
        if not complaints:
            return []
        
        # Sort by timestamp
        sorted_complaints = sorted(
            complaints,
            key=lambda x: self._to_utc_aware(x.get('timestamp'))
        )
        
        # Create time series data points
        time_series = []
        for complaint in sorted_complaints:
            timestamp = complaint.get('timestamp')
            score = complaint.get('ml_risk_score') or complaint.get('risk_score', 0)
            
            time_series.append({
                'date': timestamp.isoformat() if timestamp else None,
                'risk_score': float(score),
                'complaint_id': complaint.get('id') or complaint.get('_id'),
                'risk_level': complaint.get('risk_level', 'Unknown')
            })
        
        return time_series


def integrate_temporal_drift(
    child_id: str,
    current_ml_score: float,
    current_rule_score: float,
    complaint_history: List[Dict]
) -> Dict:
    """
    Integration function to combine ML score, rule score, and temporal drift.
    
    This function should be called after ML and rule-based scoring to add
    temporal context to the final risk assessment.
    
    Args:
        child_id: Child identifier
        current_ml_score: ML model risk score (0-100)
        current_rule_score: Rule-based risk score (0-100)
        complaint_history: Previous complaints for this child
        
    Returns:
        Dict with:
        - final_score: Adjusted total risk score
        - temporal_data: Drift analysis results
    """
    analyzer = TemporalDriftAnalyzer()

    # Full base score (ml + rule) — used for spike/trend detection against history
    base_score = round(current_ml_score + current_rule_score, 2)

    # Run temporal drift analysis using the FULL base score so spike detection
    # correctly compares the current complaint against stored full scores in history
    drift_analysis = analyzer.analyze_temporal_drift(
        child_id=child_id,
        current_score=base_score,
        complaint_history=complaint_history
    )

    # Calculate final score with drift adjustment
    final_score = round(min(base_score + drift_analysis['drift_score'], 100), 2)

    return {
        'final_score': final_score,
        'base_score': base_score,
        'drift_adjustment': drift_analysis['drift_score'],
        'temporal_data': drift_analysis
    }
