import re
from typing import Dict, List, Optional


def calculate_risk_score(
    ml_probability: float,
    complaint_text: str,
    hours_per_day: float,
    previous_risk_level: str = "low",
    previous_ml_score: Optional[float] = None
) -> Dict:
    """
    Calculate comprehensive risk score combining ML predictions, behavioral rules, and history.
    
    Args:
        ml_probability: ML model's probability output (0.0 to 1.0)
        complaint_text: The complaint description text
        hours_per_day: Daily social media usage hours
        previous_risk_level: Previous assessment risk level ("low", "medium", "high")
        previous_ml_score: Previous ML score for trend analysis (optional)
    
    Returns:
        Dictionary containing:
        - total_score: Final risk score (0-100)
        - risk_level: Classification ("low", "medium", "high")
        - score_breakdown: Individual score components
        - triggered_indicators: List of detected risk factors
    """
    
    # Initialize scores and indicators
    ml_score = 0.0
    rule_score = 0.0
    history_score = 0.0
    triggered_indicators = []
    
    print(f"\n RISK SCORING - Processing complaint:")
    print(f"   Text length: {len(complaint_text)} chars")
    print(f"   First 100 chars: {complaint_text[:100]}...")
    print(f"   Hours per day: {hours_per_day}")
    

    # 1. MACHINE LEARNING SCORE (0-60 points)
    ml_score = ml_probability * 60
    
    
    # 2. RULE-BASED BEHAVIORAL SCORE (0-30 points)
    complaint_lower = complaint_text.lower()
    
    if hours_per_day >= 6:
        rule_score += 20
        triggered_indicators.append(f"High risk usage: {hours_per_day} hours/day")
    elif hours_per_day > 2:
        rule_score += 15
        triggered_indicators.append(f"Medium risk usage: {hours_per_day} hours/day")
    
    # Check sleep-related issues (8 points)
    sleep_patterns = [
        r'\bstays?\s+awake\b',
        r'\bno\s+sleep\b',
        r'\ball\s+night\b',
        r'\blate\s+night\b',
        r'\bcan\'?t\s+sleep\b',
        r'\binsomnia\b',
        r'\bsleep\s+deprived\b',
        r'\btired\b.*\bsocial\s+media\b'
    ]
    
    for pattern in sleep_patterns:
        if re.search(pattern, complaint_lower):
            rule_score += 8
            triggered_indicators.append("Sleep disruption detected")
            break
    
    school_patterns = [
        r'\bmiss(?:ed|ing)?\s+school\b',
        r'\babsent\b',
        r'\bgrades?\s+(?:dropped|falling|decreased|low|decline)\b',
        r'\bacademic\s+(?:problems?|issues?|decline)\b',
        r'\bfailing\b.*\bschool\b',
        r'\bhomework\b.*\b(?:not|never|didn\'?t)\b',
        r'\b(?:not|never)\b.*\b(?:study|studying|studies)\b',
        r'\bschool\s+performance\b.*\b(?:dropped|declining|poor|worse)\b',
        r'\bperformance\b.*\bdropped\b',
        r'\bmiss(?:ed|ing)?\s+(?:studies?|homework|classes?|lessons?)\b'
    ]
    
    for pattern in school_patterns:
        if re.search(pattern, complaint_lower):
            rule_score += 7
            triggered_indicators.append("Academic/school issues detected")
            print(f"   ✓ School pattern matched: {pattern}")
            break
    
    # Check for addiction/withdrawal symptoms (8 points)
    addiction_patterns = [
        r'\bangry\b.*\bphone\b.*\b(?:taken|take|away)\b',
        r'\bphone\b.*\b(?:taken|take|away)\b.*\bangry\b',
        r'\bextremely\s+angry\b',
        r'\baddicted\b',
        r'\baddiction\b',
        r'\bcan\'?t\s+stop\b',
        r'\bwithdrawa?l\b',
        r'\bobsessed\b',
        r'\blong\s+hours\b.*\bsocial\s+media\b',
        r'\bspends?\s+(?:all|entire|whole)\s+(?:day|time)\b'
    ]
    
    for pattern in addiction_patterns:
        if re.search(pattern, complaint_lower):
            rule_score += 8
            triggered_indicators.append("Addiction/withdrawal behaviors detected")
            print(f"   ✓ Addiction pattern matched: {pattern}")
            break
    
    # Check for social isolation/family avoidance (6 points)
    isolation_patterns = [
        r'\bavoid(?:s|ing)?\s+(?:family|us|me|interaction)\b',
        r'\bisolate(?:d|s)?\b',
        r'\bno\s+(?:social|friends)\b',
        r'\bwithdrawn\b',
        r'\bdoesn\'?t\s+(?:talk|speak|interact)\b',
        r'\bstays?\s+(?:in|alone)\b',
        r'\broom\b.*\balone\b',
        r'\bavoid(?:s|ing)?\s+(?:people|everyone|others)\b'
    ]
    
    for pattern in isolation_patterns:
        if re.search(pattern, complaint_lower):
            rule_score += 6
            triggered_indicators.append("Social isolation/family avoidance detected")
            print(f"   ✓ Isolation pattern matched: {pattern}")
            break
    
    # Check emotional distress (5 points)
    emotional_patterns = [
        r'\bangry\b',
        r'\banxious\b',
        r'\banxiety\b',
        r'\birritated\b',
        r'\birritab(?:le|ility)\b',
        r'\baggressive\b',
        r'\bdepressed\b',
        r'\bmood\s+swings?\b',
        r'\bmental\s+health\b',
        r'\bstressed?\b',
        r'\bfrustrated\b',
        r'\bwithdraw(?:n|al)?\b',
        r'\bbehavior\s+changed?\b',
        r'\bacting\s+(?:out|different)\b'
    ]
    
    for pattern in emotional_patterns:
        if re.search(pattern, complaint_lower):
            rule_score += 5
            triggered_indicators.append("Emotional distress indicators")
            break
    
    # Check physical health neglect (6 points) - missed meals, hygiene, etc.
    neglect_patterns = [
        r'\bmiss(?:ed|ing)?\s+(?:meals?|food|eating)\b',
        r'\bnot\s+eating\b',
        r'\bhungry\b',
        r'\bno\s+(?:food|meals?|dinner|lunch|breakfast)\b',
        r'\bhygiene\b.*\b(?:poor|bad|neglected)\b',
        r'\bnot\s+(?:shower|bath|clean)\b',
        r'\bdirty\b',
        r'\bneglected\b'
    ]
    
    for pattern in neglect_patterns:
        if re.search(pattern, complaint_lower):
            rule_score += 6
            triggered_indicators.append("Physical health/neglect indicators")
            print(f"   ✓ Neglect pattern matched: {pattern}")
            break
    

    # 3. HISTORY-BASED SCORE (0-10 points)
    
    
    # Previous high risk adds concern (5 points)
    if previous_risk_level.lower() == "high":
        history_score += 5
        triggered_indicators.append("Previous high-risk case")
    
    # Increasing trend detection (5 points)
    if previous_ml_score is not None and ml_score > previous_ml_score:
        history_score += 5
        triggered_indicators.append(f"Risk trend increasing (was {previous_ml_score:.1f}, now {ml_score:.1f})")
    
  
    # 4. TOTAL SCORE CALCULATION

    total_score = ml_score + rule_score + history_score
    
    # Cap at 100
    total_score = min(total_score, 100)
    
   
    # 5. THREE-LEVEL RISK CLASSIFICATION (Low/Medium/High)
    severe_indicator_count = len([ind for ind in triggered_indicators if any(keyword in ind.lower() for keyword in 
        ['addiction', 'withdrawal', 'academic', 'school', 'isolation', 'high risk usage'])])
    
    if total_score >= 70:
        risk_level = "high"
    elif total_score >= 40:
        risk_level = "medium"
    else:
        risk_level = "low"
    

    # 6. RETURN COMPREHENSIVE RESULT
 
    return {
        "total_score": round(total_score, 2),
        "risk_level": risk_level,
        "score_breakdown": {
            "ml_score": round(ml_score, 2),
            "rule_score": round(rule_score, 2),
            "history_score": round(history_score, 2)
        },
        "triggered_indicators": triggered_indicators,
        "explanation": _generate_explanation(total_score, risk_level, triggered_indicators)
    }


def _generate_explanation(total_score: float, risk_level: str, indicators: List[str]) -> str:
    """Generate human-readable explanation of the risk score."""
    
    explanation = f"Risk Score: {total_score:.0f}/100 - {risk_level.upper()} RISK\n\n"
    
    if indicators:
        explanation += "Risk Factors Detected:\n"
        for i, indicator in enumerate(indicators, 1):
            explanation += f"{i}. {indicator}\n"
    else:
        explanation += "No significant risk factors detected.\n"
    
    # Add detailed recommendations based on level and specific indicators
    explanation += "\n" + "="*70 + "\n"
    explanation += "RECOMMENDATIONS:\n"
    explanation += "="*70 + "\n"
    
    if risk_level == "high":
        explanation += "\n🔴 URGENT ACTION REQUIRED:\n\n"
        explanation += "Immediate Steps:\n"
        explanation += "• Seek professional counseling or mental health support immediately\n"
        explanation += "• Implement strict screen time limits (maximum 1-2 hours daily)\n"
        explanation += "• Remove devices from bedroom, especially at night\n"
        explanation += "• Schedule family meeting to discuss concerns openly\n"
        explanation += "• Contact school counselor about academic support\n\n"
        
        # Specific recommendations based on indicators
        if any('sleep' in ind.lower() for ind in indicators):
            explanation += "Sleep-Related Actions:\n"
            explanation += "• Establish no-device rule 2 hours before bedtime\n"
            explanation += "• Create consistent sleep schedule\n"
            explanation += "• Consider medical consultation if sleep issues persist\n\n"
        
        if any('school' in ind.lower() or 'academic' in ind.lower() for ind in indicators):
            explanation += "Academic Support:\n"
            explanation += "• Meet with teachers to create support plan\n"
            explanation += "• Arrange tutoring if needed\n"
            explanation += "• Set up homework-first, social media-later rule\n"
            explanation += "• Monitor school attendance daily\n\n"
        
        if any('addiction' in ind.lower() or 'withdrawal' in ind.lower() for ind in indicators):
            explanation += "Addiction Intervention:\n"
            explanation += "• Consult with addiction specialist or therapist\n"
            explanation += "• Consider digital detox program\n"
            explanation += "• Gradually reduce usage with structured plan\n"
            explanation += "• Replace social media time with physical activities\n\n"
        
        if any('isolation' in ind.lower() for ind in indicators):
            explanation += "Social Connection:\n"
            explanation += "• Encourage in-person social activities\n"
            explanation += "• Plan family activities and outings\n"
            explanation += "• Connect with school social worker\n"
            explanation += "• Consider group therapy for social skills\n\n"
        
        explanation += "Professional Resources:\n"
        explanation += "• Child psychologist or therapist\n"
        explanation += "• School counselor or social worker\n"
        explanation += "• Pediatrician for overall health assessment\n"
        explanation += "• Digital wellness programs\n"
        
    elif risk_level == "medium":
        explanation += "\n🟠 MODERATE CONCERN:\n\n"
        explanation += "Recommended Actions:\n"
        explanation += "• Set clear daily screen time limits (2-3 hours max)\n"
        explanation += "• Enforce device-free time before bed\n"
        explanation += "• Monitor school performance and sleep quality\n"
        explanation += "• Encourage offline activities and social time\n"
        explanation += "• Review app usage and consider parental controls\n\n"
        explanation += "Follow-Up:\n"
        explanation += "• Reassess in 2-4 weeks\n"
        explanation += "• Escalate to professional support if behaviors worsen\n"
    else:  # low risk
        explanation += "\n🟢 PREVENTIVE MEASURES:\n\n"
        explanation += "Monitoring and Prevention:\n"
        explanation += "• Continue regular check-ins about online activities\n"
        explanation += "• Maintain current screen time limits\n"
        explanation += "• Encourage balanced lifestyle with offline activities\n"
        explanation += "• Keep open communication channels\n"
        explanation += "• Monitor for any changes in behavior or mood\n\n"
        
        explanation += "Healthy Digital Habits:\n"
        explanation += "• Set family media use rules together\n"
        explanation += "• Create tech-free zones (dining table, bedrooms)\n"
        explanation += "• Promote critical thinking about online content\n"
        explanation += "• Encourage hobbies and physical activities\n"
        explanation += "• Model healthy technology use as parent\n\n"
        
        explanation += "Educational Support:\n"
        explanation += "• Teach digital citizenship and online safety\n"
        explanation += "• Discuss privacy and responsible sharing\n"
        explanation += "• Review social media accounts periodically\n"
        explanation += "• Stay informed about popular platforms\n"
    
    return explanation

# EXAMPLE USAGE / TESTING

if __name__ == "__main__":
    # Test case 1: High risk scenario
    print("=" * 70)
    print("TEST CASE 1: HIGH RISK")
    print("=" * 70)
    
    result1 = calculate_risk_score(
        ml_probability=0.85,
        complaint_text="My child stays awake all night on social media, missing school frequently. Grades have dropped significantly and he's become very angry and irritated.",
        hours_per_day=9.5,
        previous_risk_level="medium",
        previous_ml_score=45.0
    )
    
    print(result1["explanation"])
    print(f"\nScore Breakdown: {result1['score_breakdown']}")
    print("\n")
    
    # Test case 2: Low risk scenario
    print("=" * 70)
    print("TEST CASE 2: LOW RISK")
    print("=" * 70)
    
    result2 = calculate_risk_score(
        ml_probability=0.25,
        complaint_text="My child uses social media to stay connected with friends after school. Sometimes spends a bit too much time but generally balanced.",
        hours_per_day=2.5,
        previous_risk_level="low"
    )
    
    print(result2["explanation"])
    print(f"\nScore Breakdown: {result2['score_breakdown']}")
    print("\n")
    
    # Test case 3: Medium risk scenario
    print("=" * 70)
    print("TEST CASE 3: MEDIUM RISK")
    print("=" * 70)
    
    result3 = calculate_risk_score(
        ml_probability=0.55,
        complaint_text="Child is spending 7 hours daily on social media. Notice some irritability when asked to stop. Homework completion has been inconsistent.",
        hours_per_day=7.0,
        previous_risk_level="low"
    )
    
    print(result3["explanation"])
    print(f"\nScore Breakdown: {result3['score_breakdown']}")
