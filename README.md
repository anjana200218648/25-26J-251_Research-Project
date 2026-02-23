# SafeKid-Scan Research Project
# Child Social Media Risk Assessment System

## 📁 Project Structure 

```
25-26J-251_Research-Project/
├── backend/                  # Flask backend API
│   ├── app.py               # Main application
│   ├── model_service.py     # ML model inference
│   ├── risk_scoring.py      # Risk analysis (English + Sinhala)
│   ├── temporal_drift.py    # Temporal trend analysis
│   └── trained_model/       # Pre-trained model files
├── safekid-scan/            # React frontend
│   ├── src/
│   │   ├── pages/          # Main pages
│   │   ├── components/     # Reusable components
│   │   └── contexts/       # Language context
│   └── package.json
├── ml_training/             # ML model training scripts
│   ├── train_model.py      # Main training script
│   ├── README.md           # Detailed training guide
│   ├── QUICKSTART.md       # Quick start guide
│   └── sample_training_data.csv  # Dataset template
└── README.md               # This file
```

---

## 🚀 Getting Started / ආරම්භ කිරීම

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 2. Frontend Setup

```bash
cd safekid-scan
npm install
npm run dev
```

### 3. Access Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000

---

## 🎯 Key Features / ප්‍රධාන විශේෂාංග

### 1. **Multilingual Support / බහු භාෂා සහාය**
   - English / ඉංග්‍රීසි
   - Sinhala / සිංහල
   - Language toggle in navbar

### 2. **Sinhala Text Analysis / සිංහල පාඨ විශ්ලේෂණය**
   - Rule-based analysis for Sinhala complaints
   - 12 risk categories (addiction, academic, sleep, etc.)
   - Bilingual recommendations

### 3. **ML Model Training / ML ආකෘති පුහුණු කිරීම**
   - Multimodal deep learning (RoBERTa + MLP + Embeddings)
   - Training scripts in `ml_training/` directory
   - Google Colab compatible

### 4. **Risk Assessment / අවදානම් තක්සේරුව**
   - Combined ML + Rule-based analysis
   - Temporal drift detection
   - Comprehensive scoring (0-100)
   - Three-level classification (Low/Medium/High)

---

## 📊 System Architecture / පද්ධති ගෘහනිර්මාණය

# Research

 """
        IMPROVED HYBRID PREDICTION with balanced threshold.
        
        This model uses a TWO-LAYER APPROACH for accurate risk assessment:
        
        LAYER 1: RULE-BASED SAFETY CHECKS (catches extreme cases)
        - Identifies critical keywords (suicide, abuse, exploitation)
        - Checks excessive usage patterns for young children
        - Provides immediate high-risk flag when safety concerns detected
        
        LAYER 2: ML MODEL with OPTIMIZED 60% THRESHOLD
        - Combines structured data + text analysis
        - Uses 60% threshold instead of 50% to fix data imbalance
        - Eliminates false positives on low-risk cases
        - Still catches genuine high-risk situations
        
        STRUCTURED DATA:
        - age_of_child, hours_per_day_on_social_media
        - child_gender, reporter_role (encoded)
        
        TEXT ANALYSIS:
        - RoBERTa transformer for contextual understanding
        - Sentiment, behavioral patterns, severity indicators
        
        Args:
            text: Complaint text describing the concern
            numeric_features: Dict with age_of_child, hours_per_day_on_social_media,
                            child_gender, reporter_role
            threshold: ML model threshold (default 0.60 - optimized for balance)
        
        Returns:
            Dict with 'probability_high_risk', 'predicted_label', 'rule_triggered', 'method'
        """
================================================================================
COMPREHENSIVE RISK SCORING ALGORITHM FOR CHILD SOCIAL MEDIA ADDICTION ASSESSMENT
================================================================================

OVERVIEW:
---------
This system implements a HYBRID RISK ASSESSMENT approach combining:
1. Machine Learning predictions (RoBERTa-based multimodal classifier)
2. Rule-based behavioral analysis (pattern matching)
3. Historical trend analysis (previous assessments)

SCORING COMPONENTS:
------------------
1. ML SCORE (0-60 points): Based on model's probability output
2. RULE SCORE (0-30 points): Pattern-based detection of risk factors
3. HISTORY SCORE (0-10 points): Previous risk levels and trends

FINAL CLASSIFICATION:
--------------------
- LOW RISK: Total score < 35 AND < 2 severe indicators
- MEDIUM RISK: Total score 35-49 OR 1 severe indicator
- HIGH RISK: Total score >= 50 OR >= 2 severe indicators

RULE-BASED DETECTION CATEGORIES:
-------------------------------
1. EXCESSIVE USAGE (15-10 points):
   - ≥10 hours/day: 15 points (Very excessive)
   - ≥6 hours/day: 10 points (Excessive)

2. ACADEMIC/SCHOOL ISSUES (7 points):
   - Missed school/classes/studies/homework
   - Declining grades/performance
   - Academic problems

3. SLEEP DISRUPTION (8 points):
   - Staying awake all night
   - Sleep deprivation
   - Tired from social media

4. ADDICTION/WITHDRAWAL (8 points):
   - Angry when phone taken away
   - Can't stop using
   - Obsessed with social media

5. SOCIAL ISOLATION (6 points):
   - Avoiding family/friends
   - Withdrawn behavior
   - No social interaction

6. EMOTIONAL DISTRESS (5 points):
   - Angry/irritated/anxious
   - Mood swings/depressed
   - Behavioral changes

7. PHYSICAL HEALTH NEGLECT (6 points):
   - Missed meals/eating
   - Poor hygiene
   - Physical neglect indicators

SEVERE INDICATORS (trigger immediate high risk if 2+ present):
- Addiction/withdrawal behaviors
- Academic/school issues
- Social isolation/family avoidance
- Excessive usage patterns

CRITICAL SAFETY CHECKS (immediate high risk):
- Suicide/self-harm keywords
- Sexual abuse/exploitation
- Excessive usage (>10hrs) for children <13 years

================================================================================
"""