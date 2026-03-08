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
    
    
    # 2. RULE-BASED BEHAVIORAL SCORE
    complaint_lower = complaint_text.lower()

    # --- Hours per day (tiered) ---
    if hours_per_day >= 9:
        rule_score += 25
        triggered_indicators.append(f"Extreme risk usage: {hours_per_day} hours/day")
        print(f"   [X] Extreme usage tier: {hours_per_day}h/day")
    elif hours_per_day >= 6:
        rule_score += 20
        triggered_indicators.append(f"High risk usage: {hours_per_day} hours/day")
    elif hours_per_day > 2:
        rule_score += 15
        triggered_indicators.append(f"Medium risk usage: {hours_per_day} hours/day")

    # --- Sleep disruption (8 pts) ---
    sleep_patterns = [
        r'\bstays?\s+awake\b',
        r'\bno\s+sleep\b',
        r'\ball\s+night\b',
        r'\blate\s+night\b',
        r'\bcan\'?t\s+sleep\b',
        r'\binsomnia\b',
        r'\bsleep\s+depriv(?:ed|ation)\b',
        r'\btired\b.*\bsocial\s+media\b',
        r'\bup\s+(?:until|till|to)\s+(?:\d+\s*am|midnight|dawn)\b',
        r'\bphone\b.*\bbed\b',
        r'\bsocial\s+media\b.*\bbed\b',
        r'\bnot\s+sleep(?:ing)?\b',
        r'\bnever\s+sleep(?:s)?\b',
        r'\bwon\'?t\s+sleep\b',
        r'\brefus(?:es?|ing)\s+to\s+sleep\b',
        r'\bnight\s+(?:long|through)\b',
        r'\bawake\s+(?:all|the\s+whole)\s+night\b',
        r'\bsleep\s+(?:schedule|routine|habit)\b.*\b(?:broken|destroyed|ruined|bad|poor)\b',
    ]
    for pattern in sleep_patterns:
        if re.search(pattern, complaint_lower):
            rule_score += 8
            triggered_indicators.append("Sleep disruption detected")
            print(f"   [+] Sleep pattern matched: {pattern}")
            break

    # --- Academic / school issues (7 pts) ---
    school_patterns = [
        # Allow 0-3 words between "miss/skip" and "school/class/studies"
        r'\bmiss(?:ed|ing|es)?\s+(?:\w+\s+){0,3}school\b',
        r'\bskip(?:ped|ping|s)?\s+(?:\w+\s+){0,3}(?:school|class(?:es)?|lessons?)\b',
        r'\bbunk(?:ed|ing|s)?\s+(?:\w+\s+){0,3}(?:school|class(?:es)?)\b',
        r'\bnot\s+(?:\w+\s+){0,3}(?:going\s+to\s+)?school\b',
        r'\bdrop(?:ped|ping)?\s+(?:out\s+of\s+)?school\b',
        r'\babsent\b',
        r'\btruant\b',
        r'\bgrades?\s+(?:dropped?|falling|fall|decreased?|low|declin(?:ed?|ing))\b',
        r'\bacademic\s+(?:problems?|issues?|declin(?:e|ing)|performance|result)\b',
        r'\bfailing\b.*\b(?:school|class(?:es)?|subjects?|exams?)\b',
        r'\bhomework\b.*\b(?:not|never|didn\'?t|don\'?t|won\'?t|refuses?|ignor(?:e|es|ing))\b',
        r'\b(?:not|never|don\'?t|doesn\'?t|won\'?t|refuses?\s+to)\b.*\b(?:study|studying|studies)\b',
        r'\bschool\s+performance\b.*\b(?:dropped?|declin(?:ing|ed?)|poor|worse|bad)\b',
        r'\bperformance\b.*\bdropped?\b',
        r'\bmiss(?:ed|ing|es)?\s+(?:\w+\s+){0,2}(?:studies?|homework|classes?|lessons?|exams?|tests?)\b',
        r'\bno\s+(?:interest|focus|attention)\b.*\b(?:school|study|studies|class)\b',
        r'\bcan\'?t\s+(?:focus|concentrate)\b',
        r'\b(?:poor|bad|failing|low)\s+(?:grades?|marks?|results?|performance)\b',
        r'\bschool\b.*\b(?:suffer(?:ing)?|problem|issue|concern)\b',
        r'\bnot\s+(?:attending|going\s+to)\s+school\b',
        r'\brefus(?:es?|ing)\s+to\s+(?:go\s+to\s+school|study|attend)\b',
        r'\b(?:education|learning|studies)\b.*\b(?:affected?|suffer(?:ing)?|neglect(?:ed)?|ignored?)\b',
    ]
    for pattern in school_patterns:
        if re.search(pattern, complaint_lower):
            rule_score += 7
            triggered_indicators.append("Academic/school issues detected")
            print(f"   [+] School pattern matched: {pattern}")
            break

    # --- Addiction / compulsive use (8 pts) ---
    addiction_patterns = [
        r'\baddicted\b',
        r'\baddiction\b',
        r'\bobsessed\b',
        r'\bobsession\b',
        r'\bcan\'?t\s+stop\b',
        r'\bwon\'?t\s+stop\b',
        r'\brefus(?:es?|ing)\s+to\s+stop\b',
        r'\bwithdrawa?l\b',
        r'\bcompulsive(?:ly)?\b',
        r'\bhooked\s+on\b',
        r'\blong\s+hours\b.*\b(?:social\s+media|phone|online|screen)\b',
        r'\bspends?\s+(?:all|entire|whole|most)\s+(?:day|time|hours?)\b',
        r'\b(?:all|every|most)\s+(?:day|his|her|their)\s+(?:time|hours?)\b.*\b(?:phone|online|screen|social\s+media)\b',
        r'\bangry\b.*\b(?:phone|device|screen|tablet)\b.*\b(?:taken|take|away|removed)\b',
        r'\b(?:phone|device|screen)\b.*\b(?:taken|take|away|removed)\b.*\bangry\b',
        r'\bextremely\s+angry\b',
        r'\bscreams?\b.*\b(?:phone|device|screen|taken|away)\b',
        r'\b(?:phone|device|screen)\b.*\b(?:screams?|cries?|yells?|freaks?\s+out)\b',
        r'\bcan\'?t\s+function\b',
        r'\bconstantly\s+(?:on\s+(?:phone|screen|social\s+media)|checking|scrolling|watching)\b',
        r'\bglued\s+to\b',
        r'\b(?:never|won\'?t)\s+put\s+(?:down|away)\s+(?:the\s+)?(?:phone|device|screen)\b',
        r'\bignores?\s+(?:everything|everyone|family|us|me)\b.*\b(?:phone|social\s+media|screen)\b',
        r'\b(?:phone|social\s+media|screen)\b.*\bignores?\s+(?:everything|everyone|family|us|me)\b',
        r'\bunable\s+to\s+(?:stop|quit|control)\b',
        r'\bhours?\s+(?:and\s+hours?|on\s+end)\b',
        r'\ball\s+day\s+(?:long\s+)?(?:on|using|watching|scrolling)\b',
    ]
    for pattern in addiction_patterns:
        if re.search(pattern, complaint_lower):
            rule_score += 8
            triggered_indicators.append("Addiction/withdrawal behaviors detected")
            print(f"   [+] Addiction pattern matched: {pattern}")
            break

    # --- Content creation / excessive uploading (5 pts) ---
    content_patterns = [
        r'\buploading\b',
        r'\bposting\s+(?:videos?|content|pictures?|photos?|reels?|stories?)\b',
        r'\bgoing\s+live\b',
        r'\b(?:live\s+streaming|livestream(?:ing)?)\b',
        r'\bcreating\s+(?:content|videos?|reels?)\b',
        r'\brecording\s+(?:videos?|herself|himself|themselves)\b',
        r'\b(?:youtube|tiktok|instagram|facebook)\b.*\b(?:content|channel|page|follower)\b',
        r'\bwants?\s+(?:to\s+be\s+(?:famous|influencer|youtuber|tiktoker))\b',
        r'\bobsessed\s+with\s+(?:followers?|likes?|views?|comments?)\b',
        r'\bfollower\s+count\b',
        r'\b(?:like|view|comment)\s+count\b',
    ]
    for pattern in content_patterns:
        if re.search(pattern, complaint_lower):
            rule_score += 5
            triggered_indicators.append("Excessive content creation/uploading detected")
            print(f"   [+] Content creation pattern matched: {pattern}")
            break

    # --- Social isolation / family avoidance (6 pts) ---
    isolation_patterns = [
        r'\bavoid(?:s|ing)?\s+(?:\w+\s+){0,2}(?:family|us|me|interaction|people|everyone|others?)\b',
        r'\bisolate(?:d|s)?\b',
        r'\bisolation\b',
        r'\bno\s+(?:social\s+)?(?:friends?|life|interaction|contact)\b',
        r'\bwithdrawn?\b',
        r'\bdoesn\'?t\s+(?:talk|speak|interact|communicate|respond)\b',
        r'\bwon\'?t\s+(?:talk|speak|interact|communicate)\b',
        r'\brefus(?:es?|ing)\s+to\s+(?:talk|speak|interact|come\s+out)\b',
        r'\bstays?\s+(?:in|alone|inside|home|room)\b.*\b(?:all\s+day|all\s+the\s+time|always|constantly)\b',
        r'\blocked\s+(?:in|inside)\s+(?:(?:her|his|their)\s+)?room\b',
        r'\broom\b.*\b(?:all\s+day|alone|locked|shut)\b',
        r'\bnever\s+(?:leaves?|comes?\s+out|goes?\s+out|goes?\s+outside)\b',
        r'\bno\s+(?:real\s+)?friends?\b',
        r'\blost\s+(?:all\s+)?(?:friends?|interest\s+in\s+(?:family|people|social))\b',
        r'\bprefers?\s+(?:phone|screen|online|social\s+media)\s+(?:over|to|instead\s+of)\s+(?:family|people|us)\b',
    ]
    for pattern in isolation_patterns:
        if re.search(pattern, complaint_lower):
            rule_score += 6
            triggered_indicators.append("Social isolation/family avoidance detected")
            print(f"   [+] Isolation pattern matched: {pattern}")
            break

    # --- Emotional distress (5 pts) ---
    emotional_patterns = [
        r'\bangry\b',
        r'\banxious\b',
        r'\banxiety\b',
        r'\birritated?\b',
        r'\birritab(?:le|ility)\b',
        r'\baggressive(?:ly|ness)?\b',
        r'\bdepressed\b',
        r'\bdepression\b',
        r'\bmood\s+swings?\b',
        r'\bmental\s+health\b',
        r'\bstressed?\b',
        r'\bfrustrated?\b',
        r'\bfrustration\b',
        r'\bwithdraw(?:n|al)?\b',
        r'\bbehaviou?r\s+(?:changed?|problem|issue)\b',
        r'\bacting\s+(?:out|different|strange|weird|unusual)\b',
        r'\btemper\s+(?:tantrum|outburst|problem)\b',
        r'\brages?\b',
        r'\bhostile\b',
        r'\bupset\b',
        r'\bcrying\s+(?:a\s+lot|constantly|all\s+the\s+time)\b',
        r'\bemotionally\s+(?:unstable|disturbed|affected)\b',
        r'\bsad\s+(?:all\s+the\s+time|always|constantly)\b',
        r'\bno\s+(?:motivation|interest|desire)\b',
    ]
    for pattern in emotional_patterns:
        if re.search(pattern, complaint_lower):
            rule_score += 5
            triggered_indicators.append("Emotional distress indicators")
            print(f"   [+] Emotional pattern matched: {pattern}")
            break

    # --- Physical health / neglect (6 pts) ---
    neglect_patterns = [
        r'\bmiss(?:ed|ing|es)?\s+(?:\w+\s+){0,2}(?:meals?|food|eating|lunch|dinner|breakfast)\b',
        r'\bnot\s+eating\b',
        r'\bwon\'?t\s+eat\b',
        r'\brefus(?:es?|ing)\s+to\s+eat\b',
        r'\bhungry\b',
        r'\bno\s+(?:food|meals?|dinner|lunch|breakfast)\b',
        r'\bhygiene\b.*\b(?:poor|bad|neglected?|terrible|awful)\b',
        r'\bnot\s+(?:shower(?:ing)?|bath(?:ing)?|clean(?:ing)?)\b',
        r'\bwon\'?t\s+(?:shower|bathe|clean)\b',
        r'\bdirty\b',
        r'\bneglect(?:ed|ing|s)?\b',
        r'\bphysical(?:ly)?\s+(?:weak|unhealthy|unwell|deteriorating)\b',
        r'\bweight\s+(?:loss|losing|lost|dropped|reduced)\b',
        r'\bheadache\b',
        r'\beye\s+(?:strain|pain|problem)\b',
        r'\bback\s+pain\b',
        r'\bnot\s+(?:exercising|playing|active|moving)\b',
        r'\bsedentary\b',
    ]
    for pattern in neglect_patterns:
        if re.search(pattern, complaint_lower):
            rule_score += 6
            triggered_indicators.append("Physical health/neglect indicators")
            print(f"   [+] Neglect pattern matched: {pattern}")
            break

    # --- Multi-factor severity boost ---
    # If 3+ distinct risk categories fired (excluding hours), add a bonus
    non_hours_indicators = [i for i in triggered_indicators
                            if 'hours/day' not in i and 'usage' not in i.lower()]
    if len(non_hours_indicators) >= 3:
        boost = 5 * (len(non_hours_indicators) - 2)  # +5 per extra factor beyond 2
        rule_score += boost
        triggered_indicators.append(f"Multiple risk factors compounding (+{boost} pts)")
        print(f"   [X] Multi-factor boost: {len(non_hours_indicators)} factors -> +{boost} pts")

    # --- Mitigating / positive context detection ---
    # When the guardian describes normal, managed, purposeful usage,
    # reduce the ML score contribution so the model's baseline ~34% probability
    # doesn't incorrectly push a benign complaint into MEDIUM/HIGH.
    mitigating_patterns = [
        # Educational / purposeful use
        r'\bfor\s+(?:studies?|learning|education|school\s+work|homework|research|class(?:es)?)\b',
        r'\beducation(?:al)?\s+(?:purpose|use|content|video)\b',
        r'\bstudying\b',
        r'\blearning\b',
        r'\bhomework\b',
        r'\bschool\s+(?:project|assignment|work|task)\b',
        r'\bacademic\s+(?:purpose|use|help)\b',
        # Routine / balance maintained
        r'\bmanag(?:ing|es?|ed)\s+(?:\w+\s+){0,3}(?:daily\s+routine|routine|schedule|time|life|activities)\b',
        r'\bdaily\s+routine\b',
        r'\bbalanced?\b',
        r'\bwell[\s\-]balanced\b',
        r'\bno\s+(?:problem|issue|concern|complaint|trouble)\b',
        r'\b(?:doing|performing)\s+(?:well|fine|good|great|okay|ok)\b',
        r'\b(?:still|also)\s+(?:doing|completing|finishing|attending|going)\b',
        r'\bresponsib(?:le|ility)\b',
        r'\b(?:healthy|good)\s+(?:habit|routine|balance|lifestyle)\b',
        r'\b(?:normal|regular)\s+(?:schedule|routine|activity|life)\b',
        r'\bunder\s+control\b',
        r'\bmoderat(?:e|ely|ion)\b',
        r'\bin\s+(?:control|check|moderation)\b',
        r'\bno\s+(?:negative|bad|harmful)\s+(?:effect|impact|behavior|behaviour)\b',
        r'\bstill\s+(?:going\s+to\s+school|attending|active|social)\b',
    ]

    mitigating_count = 0
    mitigating_matched = []
    for pattern in mitigating_patterns:
        if re.search(pattern, complaint_lower):
            mitigating_count += 1
            mitigating_matched.append(pattern)

    if mitigating_count > 0:
        # Calculate deduction: stronger deduction when no other risk factors present
        risk_factor_count = len(non_hours_indicators)
        if risk_factor_count == 0:
            # Only hours triggered, complaint is purely informational with positive context
            # Deduct enough to counteract the ML model's ~34% baseline
            ml_deduction = min(ml_score * 0.6, 15)  # remove up to 60% of ML score, max 15 pts
        else:
            # Other risk factors exist but some positive context too — smaller deduction
            ml_deduction = min(ml_score * 0.2, 5)

        ml_score = max(0.0, ml_score - ml_deduction)
        triggered_indicators.append(
            f"Mitigating context detected ({mitigating_count} positive indicator(s)) — score reduced by {ml_deduction:.1f} pts"
        )
        print(f"   [+] Mitigating context: {mitigating_count} pattern(s) matched, ML score reduced by {ml_deduction:.1f} pts")

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
    
    # Format score with 2 decimal places for medium risk, 0 for others
    if risk_level == "medium":
        score_display = f"{total_score:.2f}"
    else:
        score_display = f"{total_score:.0f}"
    
    explanation = f"Risk Score: {score_display}/100 - {risk_level.upper()} RISK\n\n"
    
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


def rule_based_analysis_parent_child(text: str, hours_per_day: float = 0.0) -> Dict:
    """
    Rule-based Sinhala complaint analysis with parent/guardian context awareness.
    Only triggers risk if complaint refers to the child.
    Provides comprehensive addiction and behavioral risk assessment.
    
    Args:
        text: The complaint text (Sinhala or mixed Sinhala-English)
        hours_per_day: Daily social media usage hours (from form input)
    """
    from typing import Any, Dict
    
    # Lowercase text for uniform matching
    text_lower = text.lower()

    # Guardian-child indicator keywords (Sinhala) — expanded with common variants
    child_keywords = [
        'මගේ ළමයා', 'මගේ පුතා', 'මගේ දියණිය', 'මගේ දරුවා',
        'ඔහු', 'ඇය', 'ඇයගේ', 'ඔහුගේ', 'child',
        'ළමයා', 'පුතා', 'දියණිය', 'දරුවා', 'දරුවාගේ',
        'බබා', 'කොල්ලා', 'කෙල්ල', 'ළමයි', 'දරුවන්',
        'මගේ කොල්ලා', 'මගේ කෙල්ල', 'අපේ දරුවා', 'අපේ ළමයා',
        'මගේ son', 'මගේ daughter', 'my child', 'my son', 'my daughter'
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

    # Risk keyword categories — comprehensive Sinhala keywords + common English mixed in
    risk_keywords = {
        'gambling': ['සූදු', 'බෙට්', 'බෙටින්', 'ජූදු', 'gambling', 'betting'],
        'violence': ['පහර', 'හිංසා', 'ප්‍රචණ්ඩත්වය', 'සටන්', 'violence'],  # Removed 'මරණ'(death-can match in other contexts)
        'sexual': ['ලිංගික', 'අශ්ලීල', 'අසභ්‍ය', 'porn', 'sexual'],
        'drugs': ['මත්ද්‍රව්‍ය', 'මත්පැන්', 'drugs', 'alcohol'],  # Removed 'මත්'(matches තවමත්=still) and 'බීම'(too generic=drink)
        'bullying': ['පීඩා', 'හිරිහැර', 'තර්ජන', 'බුලි', 'bullying', 'bully', 'cyberbullying'],  # Removed 'වධ'(too short)
        'suicide': ['සියදිවි', 'සියදිවි නසා', 'suicide', 'self harm'],  # Removed 'මරණය'/'මියයෑම'(death-generic)
        'hate': ['වෛරය', 'ද්වේෂය'],  # Removed 'වෙනස්කම්'(differences-generic)
        'addiction': [
            # Sinhala: ONLY words that CLEARLY indicate addiction/problematic use
            'ඇබ්බැහි',             # addicted (strongest indicator)
            'නතර කළ නොහැකි',      # can't stop
            'යැපීම',               # dependence
            'අධික භාවිතය',         # excessive use
            'ඇල්ම අසමත්',         # unable to quit habit
            'පැය ගණනක්',          # for hours on end
            'දිගු වේලා',           # for a long time (excessive)
            'ඔන්ලයින් ගේම්',      # online games (compound = complaint-specific)
            'වීඩියෝ ක්‍රීඩා',      # video games (compound = complaint-specific)
            # English: ONLY words that indicate problematic addiction
            'addicted', 'addiction', 'obsessed', "can't stop",
            'hooked'
            # REMOVED: 'ක්‍රීඩා'(games-generic), 'සමාජ'(social), 'මාධ්‍ය'(media),
            # 'online', 'game', 'games', 'phone', 'internet', 'mobile', platform names
            # These are too generic and cause false positives
        ],
        'academic': [
            # ONLY negative academic indicators (NOT neutral school/study mentions)
            'මග හරවා',            # skipping/avoiding
            'මග අරිනවා',          # skipping (variant)
            'නොකර',               # not doing
            'අතහැර',              # abandoned
            'අත්හැරීම',          # abandoning
            'ඉගෙන ගන්නේ නැ',      # not learning
            'පාඩම් කරන්නේ නැ',    # not studying
            'ලකුණු අඩු',          # low marks
            'අසමත්',             # failed
            'පල්වීම',             # declining
            'පාසල් යන්නේ නැ',     # not going to school
            # English: ONLY negative academic phrases
            'missing school', 'grades dropped',
            'failing', 'not studying', 'skipping class'
            # REMOVED: 'පාසල්'(school), 'අධ්‍යයනය'(studies), 'ඉගෙනීම'(learning),
            # 'school', 'study', 'studies', 'homework' - too generic, cause false positives
        ],
        'sleep': [
            'නින්ද නැ',            # no sleep
            'නොනිදා',              # not sleeping
            'මුළු රාත්‍රිය',       # all night
            'අවදි',                 # awake (late)
            'අධික රාත්‍රී',        # excessive late night  
            'sleep deprived', 'no sleep', 'stays awake', 'all night'
            # REMOVED: 'නිදා'(sleep-neutral), 'නින්ද'(sleep-neutral), 'රෑ'(night-generic)
        ],
        'emotional': [
            'කෝපය', 'තරහ', 'චිත්තවේගීය', 'ආතතිය',
            'කලබල', 'කේන්ති', 'ආක්‍රමණශීලී',
            'angry', 'aggressive', 'depressed', 'anxiety'
            # REMOVED: 'මානසික'(mental-generic), 'හැඟීම්'(feelings-generic), 'හැසිරීම'(behavior-generic)
        ],
        'isolation': [
            'හුදකලා', 'තනිකම', 'කතා නොකිරීම',
            'මිතුරන් නැති', 'එළියට යන්නේ නැ',
            'isolated', 'no friends', 'withdrawn'
            # REMOVED: 'සමාජ විරහිත'(partial match risk), 'වෙන්වීම'(separation-generic), 'alone'(too common)
        ],
        # New: contact with unknown/stranger online (Sinhala + English)
        'stranger_contact': [
            'නාඳුනන', 'නාඳුනන අය', 'නොදන්නා', 'නුහුරු ',
            'unknown people', 'unknown person', 'stranger', 'strangers', 'ගෙදරට එන',
            'playing with strangers', 'plays with strangers', 'playing with unknown'
        ],
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
                    
                    # Calibrated risk scores - balanced to prevent false HIGH for benign complaints
                    # Score ranges designed to work with temporal drift thresholds (50/35)
                    if category == 'suicide':
                        total_risk += 25
                        category_details[category] = {'severity': 'critical', 'score': 25}
                    elif category == 'sexual':
                        total_risk += 22
                        category_details[category] = {'severity': 'critical', 'score': 22}
                    elif category == 'drugs':
                        total_risk += 18
                        category_details[category] = {'severity': 'critical', 'score': 18}
                    elif category == 'addiction':
                        total_risk += 18
                        category_details[category] = {'severity': 'high', 'score': 18}
                    elif category == 'stranger_contact':
                        # Contact with unknown people online is a high-safety concern
                        total_risk += 20
                        category_details[category] = {'severity': 'high', 'score': 20}
                    elif category in ['violence', 'bullying']:
                        total_risk += 12
                        category_details[category] = {'severity': 'high', 'score': 12}
                    elif category == 'academic':
                        total_risk += 10
                        category_details[category] = {'severity': 'medium', 'score': 10}
                    elif category in ['sleep', 'emotional', 'isolation']:
                        total_risk += 8
                        category_details[category] = {'severity': 'medium', 'score': 8}
                    else:
                        total_risk += 5
                        category_details[category] = {'severity': 'low', 'score': 5}
                break  # only once per category

    # Hours-based risk scoring (user's classification: 1-2=LOW, 3-5=MEDIUM, 6+=HIGH)
    hours_risk = 0
    if hours_per_day >= 6:
        hours_risk = 18
        detected_categories.append('high_usage')
        category_details['high_usage'] = {'severity': 'high', 'score': 18}
    elif hours_per_day >= 3:
        hours_risk = 10
        detected_categories.append('medium_usage')
        category_details['medium_usage'] = {'severity': 'medium', 'score': 10}
    elif hours_per_day >= 2:
        hours_risk = 5
        detected_categories.append('low_usage')
        category_details['low_usage'] = {'severity': 'low', 'score': 5}
    
    total_risk += hours_risk
    
    # Safety override for critical categories
    if 'suicide' in detected_categories:
        total_risk = max(total_risk, 55)  # Force HIGH risk for suicide/self-harm
    if 'sexual' in detected_categories:
        total_risk = max(total_risk, 38)  # Force at least MEDIUM for sexual content
    # Force HIGH if contact with unknown/strangers detected (safety concern)
    if 'stranger_contact' in detected_categories:
        total_risk = max(total_risk, 50)
    
    total_risk = min(total_risk, 100)

    # Determine risk level (calibrated thresholds matching temporal drift: 50/35)
    if total_risk >= 50:
        risk_level = "high"
        is_appropriate = False
    elif total_risk >= 35:
        risk_level = "medium"
        is_appropriate = False
    elif total_risk > 0:
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
    
    if total_risk >= 50:
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
            'addiction': 'ඇබ්බැහිය / ඇල්ම (Addiction)',
            'academic': 'අධ්‍යාපනික (Academic)',
            'sleep': 'නින්ද ගැටළු (Sleep Issues)',
            'emotional': 'චිත්තවේගීය (Emotional)',
            'isolation': 'හුදකලාව (Isolation)',
            'bullying': 'වධ හිංසා (Bullying)',
            'violence': 'ප්‍රචණ්ඩත්වය (Violence)',
            'sexual': 'ලිංගික අන්තර්ගතය (Sexual Content)',
            'drugs': 'මත්ද්‍රව්‍ය (Drugs)',
            'suicide': 'සියදිවි නසා ගැනීම (Suicide)',
            'hate': 'වෛරය (Hate)',
            'gambling': 'සූදු (Gambling)',
            'high_usage': 'අධික භාවිතය - දිනකට පැය 6+ (High Usage - 6+ hrs/day)',
            'medium_usage': 'සැලකිය යුතු භාවිතය - දිනකට පැය 3-5 (Notable Usage - 3-5 hrs/day)',
            'low_usage': 'සාමාන්‍ය භාවිතය - දිනකට පැය 2-3 (Normal Usage - 2-3 hrs/day)'
        }
        
        # Filter out usage categories from display (hours info shown separately)
        usage_cats = {'high_usage', 'medium_usage', 'low_usage'}
        display_categories = [cat for cat in detected_categories if cat not in usage_cats]
        
        category_labels = [categories_si.get(cat, cat) for cat in display_categories]
        explanation_parts.append(f"\nඅනාවරණය වූ අවදානම්:\n(Detected Risks):\n" + "\n".join([f"• {cat}" for cat in category_labels]))
        
        # Add severity breakdown (exclude usage categories)
        if category_details:
            explanation_parts.append("\nතීව්‍රතා විස්තර (Severity Breakdown):")
            for cat, details in category_details.items():
                if cat in usage_cats:
                    continue
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

    # TEST CASE 4: Rule-based Sinhala high-risk example (guardian complaint)
    print("=" * 70)
    print("TEST CASE 4: RULE-BASED HIGH RISK (Sinhala)")
    print("=" * 70)
    sinhala_complaint = (
        "මගේ පුතා ෆේස්බුක් එකේ වීඩියෝ බලනවා, අන්තර්ජාලය හරහා නාඳුනන අය එක්ක ක්‍රීඩා කරනවා, "
        "එයාගේ අධ්‍යයන කටයුතු කළමනාකරණය කරන්නේ නැතුව"
    )
    rb_result_high = rule_based_analysis_parent_child(sinhala_complaint, hours_per_day=8.0)
    print(rb_result_high["explanation"])
    print(f"Risk Level: {rb_result_high['risk_level']}, Score: {rb_result_high['risk_score']}")
    print("\n")

    # TEST CASE 5: Rule-based low-risk example
    print("=" * 70)
    print("TEST CASE 5: RULE-BASED LOW RISK")
    print("=" * 70)
    low_complaint = (
        "My child occasionally watches videos and connects with close friends online, "
        "uses about 1 hour per day, homework is done."
    )
    rb_result_low = rule_based_analysis_parent_child(low_complaint, hours_per_day=1.0)
    print(rb_result_low["explanation"])
    print(f"Risk Level: {rb_result_low['risk_level']}, Score: {rb_result_low['risk_score']}")
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
