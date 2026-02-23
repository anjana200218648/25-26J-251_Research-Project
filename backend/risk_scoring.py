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


def rule_based_analysis_parent_child(text: str) -> Dict:
    """
    Rule-based Sinhala complaint analysis with parent/guardian context awareness.
    Only triggers risk if complaint refers to the child.
    Provides comprehensive addiction and behavioral risk assessment.
    """
    from typing import Any, Dict
    
    # Lowercase text for uniform matching
    text_lower = text.lower()

    # Guardian-child indicator keywords (Sinhala)
    child_keywords = [
        'මගේ ළමයා', 'මගේ පුතා', 'මගේ දියණිය', 
        'ඔහු', 'ඇය', 'ඇයගේ', 'ඔහුගේ', 'child',
        'ළමයා', 'පුතා', 'දියණිය', 'දරුවා'
    ]

    # Only analyze if text refers to child
    child_context = any(kw in text_lower for kw in child_keywords)

    if not child_context:
        return {
            "is_appropriate": True,
            "risk_level": "very low",
            "risk_score": 0,
            "max_risk_score": 100.0,
            "risk_categories": [],
            "explanation": "විශ්ලේෂණය සඳහා දරුවා සම්බන්ධ අන්තර්ගතයක් අනාවරණය වී නොමැත (No child context detected for analysis)",
            "confidence": 0.5,
            "recommendations": ["විශ්ලේෂණය සඳහා පැමිණිල්ල දරුවා සඳහා වන බව සහතික කරන්න (Ensure complaint refers to the child for meaningful analysis)"],
            "model_used": "rule_based_parent_child",
            "model_supports_sinhala": True
        }

    # Risk keyword categories with comprehensive Sinhala keywords
    risk_keywords = {
        'gambling': ['සූදු', 'බෙට්', 'බෙටින්', 'ජූදු'],
        'violence': ['පහර', 'මරණ', 'හිංසා', 'ප්‍රචණ්ඩත්වය'],
        'sexual': ['ලිංගික', 'අශ්ලීල', 'අසභ්‍ය'],
        'drugs': ['මත්ද්‍රව්‍ය', 'මත්පැන්', 'මත්', 'බීම'],
        'bullying': ['වධ', 'පීඩා', 'හිරිහැර', 'තර්ජන'],
        'suicide': ['සියදිවි', 'මරණය', 'මියයෑම', 'සියදිවි නසා'],
        'hate': ['වෛරය', 'වෙනස්කම්', 'ද්වේෂය'],
        'addiction': [
            'සමාජ මාධ්‍ය', 'ඇල්ම', 'ඔන්ලයින් ගේම්', 'අඩුපාඩු', 
            'ඇල්ම අසමත්', 'නතර කළ නොහැකි', 'යැපීම', 'අධික භාවිතය',
            'දිගු වේලා', 'සමාජ', 'මාධ්‍ය', 'ගේම්', 'ඉන්ටර්නෙට්',
            'ෆේස්බුක්', 'ටික්ටොක්', 'යූටියුබ්', 'පැය ගණනක්'
        ],
        'academic': [
            'පාසැල්', 'ගණිතය', 'පාඩම්', 'හෝම්වර්ක්', 'ග්‍රේඩ්', 
            'අධ්‍යාපන', 'විභාග', 'ශිෂ්‍ය', 'ඉගෙනීම', 'පන්ති',
            'ගුරු', 'අධ්‍යයනය', 'ලකුණු', 'කාර්ය සාධනය'
        ],
        'sleep': [
            'නිදා', 'නින්ද', 'මුළු රාත්‍රිය', 'අවදි', 'නොනිදා',
            'රාත්‍රී', 'අධික රාත්‍රී'
        ],
        'emotional': [
            'කෝපය', 'තරහ', 'චිත්තවේගීය', 'මානසික', 'ආතතිය',
            'කලබල', 'අධික චිත්තවේගීය', 'හැඟීම්'
        ],
        'isolation': [
            'හුදකලා', 'තනිකම', 'සමාජ විරහිත', 'කතා නොකිරීම',
            'මිතුරන් නැති', 'වෙන්වීම'
        ]
    }

    detected_categories = []
    total_risk = 0
    category_details = {}

    # Check each category
    for category, keywords in risk_keywords.items():
        for kw in keywords:
            if kw in text_lower:
                if category not in detected_categories:
                    detected_categories.append(category)
                    
                    # Assign risk scores based on severity
                    if category in ['sexual', 'suicide', 'drugs']:
                        total_risk += 20
                        category_details[category] = {'severity': 'critical', 'score': 20}
                    elif category == 'addiction':
                        total_risk += 20  # High priority for addiction
                        category_details[category] = {'severity': 'high', 'score': 20}
                    elif category in ['violence', 'bullying', 'academic']:
                        total_risk += 15
                        category_details[category] = {'severity': 'high', 'score': 15}
                    elif category in ['sleep', 'emotional', 'isolation']:
                        total_risk += 12
                        category_details[category] = {'severity': 'medium', 'score': 12}
                    else:
                        total_risk += 10
                        category_details[category] = {'severity': 'medium', 'score': 10}
                break  # only once per category

    total_risk = min(total_risk, 100)

    # Determine risk level
    if total_risk >= 60:
        risk_level = "high"
        is_appropriate = False
    elif total_risk >= 30:
        risk_level = "medium"
        is_appropriate = False
    elif total_risk >= 10:
        risk_level = "low"
        is_appropriate = True
    else:
        risk_level = "very low"
        is_appropriate = True

    # Generate detailed recommendations in Sinhala and English
    recommendations = []
    
    # Base recommendations
    recommendations.append("දරුවාගේ ඔන්ලයින් සහ නොබැඳි ක්‍රියාකාරකම් නිරීක්ෂණය කරන්න (Monitor child's online and offline activities)")
    recommendations.append("දරුවා සමඟ විවෘතව සාකච්ඡා කරන්න (Discuss concerns openly with child)")
    
    if 'addiction' in detected_categories:
        recommendations.insert(0, "🚨 සමාජ මාධ්‍ය ඇල්ම: වහාම මැදිහත්වීම අවශ්‍යයි (Social Media Addiction: Immediate intervention required)")
        recommendations.append("දෛනික තිර කාලය සීමා කරන්න (Set strict screen time limits)")
        recommendations.append("විකල්ප ක්‍රියාකාරකම් හඳුන්වා දෙන්න (Introduce alternative activities)")
        recommendations.append("මානසික සෞඛ්‍ය විශේෂඥයෙකු හමුවන්න (Consult a mental health professional)")
    
    if 'academic' in detected_categories:
        recommendations.append("අධ්‍යාපන සහාය සඳහා ගුරුවරුන් හමුවන්න (Meet with teachers for academic support)")
        recommendations.append("ගෙදර වැඩ සඳහා කාලය වෙන් කරන්න (Allocate specific time for homework)")
    
    if 'sleep' in detected_categories:
        recommendations.append("නිදා යාමට පැය 2 කට පෙර උපාංග භාවිතය තහනම් කරන්න (Ban device use 2 hours before bedtime)")
        recommendations.append("නිතිපතා නින්ද කාලසටහනක් තබන්න (Maintain a regular sleep schedule)")
    
    if 'emotional' in detected_categories or 'isolation' in detected_categories:
        recommendations.append("සමාජ කුසලතා සඳහා උපදේශනය ලබා ගන්න (Seek counseling for social skills)")
        recommendations.append("පවුල් ක්‍රියාකාරකම් සංවිධානය කරන්න (Organize family activities)")
    
    if total_risk >= 60:
        recommendations.insert(0, "🚨 හදිසි ක්‍රියාමාර්ග අවශ්‍යයි (URGENT ACTION REQUIRED)")
        recommendations.append("වහාම වෘත්තීය උපදේශනය හෝ මානසික සෞඛ්‍ය සහාය ලබා ගන්න (Seek professional counseling immediately)")
    
    if not recommendations:
        recommendations.append("දිගටම නිරීක්ෂණය කරන්න (Continue monitoring)")

    # Generate detailed explanation in both languages
    explanation_parts = [
        f"අවදානම් ලකුණු: {total_risk}/100 (Risk Score: {total_risk}/100)",
        f"අවදානම් මට්ටම: {risk_level.upper()} (Risk Level: {risk_level.upper()})"
    ]
    
    if detected_categories:
        categories_si = {
            'addiction': 'ඇල්ම (Addiction)',
            'academic': 'අධ්‍යාපනික (Academic)',
            'sleep': 'නින්ද ගැටළු (Sleep Issues)',
            'emotional': 'චිත්තවේගීය (Emotional)',
            'isolation': 'හුදකලාව (Isolation)',
            'bullying': 'වධ හිංසා (Bullying)',
            'violence': 'ප්‍රචණ්ඩත්වය (Violence)',
            'sexual': 'ලිංගික අන්තර්ගතය (Sexual Content)',
            'drugs': 'මත්ද්‍රව්‍ය (Drugs)',
            'suicide': 'සියදිවි නසා ගැනීම (Suicide)',
            'hate': 'වෛරය (Hate)'
        }
        
        category_labels = [categories_si.get(cat, cat) for cat in detected_categories]
        explanation_parts.append(f"\nඅනාවරණය වූ අවදානම්:\n(Detected Risks):\n" + "\n".join([f"• {cat}" for cat in category_labels]))
        
        # Add severity breakdown
        if category_details:
            explanation_parts.append("\nතීව්‍රතා විස්තර (Severity Breakdown):")
            for cat, details in category_details.items():
                cat_label = categories_si.get(cat, cat)
                explanation_parts.append(f"  {cat_label}: {details['score']} points ({details['severity']})")

    explanation = "\n".join(explanation_parts)

    return {
        "is_appropriate": is_appropriate,
        "risk_level": risk_level,
        "risk_score": total_risk,
        "max_risk_score": 100.0,
        "risk_categories": detected_categories,
        "category_details": category_details,
        "explanation": explanation,
        "confidence": 0.85,  # High confidence for rule-based Sinhala analysis
        "recommendations": recommendations,
        "model_used": "rule_based_parent_child",
        "model_supports_sinhala": True,
        "language_detected": "sinhala"
    }


def detect_language(text: str) -> str:
    """
    Detect if text contains Sinhala characters.
    Returns 'sinhala' if Sinhala characters detected, otherwise 'english'.
    """
    import re
    # Sinhala Unicode range: 0D80–0DFF
    sinhala_pattern = re.compile(r'[\u0D80-\u0DFF]')
    if sinhala_pattern.search(text):
        return 'sinhala'
    return 'english'


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
