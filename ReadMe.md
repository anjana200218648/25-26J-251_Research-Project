
# 🛡️ Safe Kid Webapp

##  Project Details

- **Project Title:** Safe Kid Webapp  
- **Authors:** 25-26J-251-Students  
- **University:** Sri Lanka Institute of Information Technology (SLIIT)  
- **Supervisor:** Ms. Jenny Krishara  
- **Co-Supervisor:** Ms. Poorna Panduwawala  

---

##  Table of Contents

1. [Introduction](#-introduction)  
2. [Problem Statement](#-problem-statement)  
3. [Objectives](#-objectives)    
5. [System Architecture](#-system-architecture)  
6. [Core Modules](#-core-modules)  
7. [Technologies Used](#-technologies-used)  
8. [Installation](#-installation)  
9. [Configuration](#-configuration)  
10. [Running the Application](#-running-the-application)  
11. [Testing](#-testing)  
12. [Use Cases](#-use-cases)  
13. [Security & Privacy](#-security--privacy)  
14. [Limitations](#-limitations)  
15. [Future Enhancements](#-future-enhancements)  
16. [Contributors](#-contributors)  
17. [Support](#-support)  
18. [License](#-license)

---

##  Introduction

This project aims to detect and intervene in social media addiction among adolescents aged 10–18. It integrates AI-driven image and voice analysis, blockchain-secured data storage, IoT-based behavioral monitoring, and automated risk scoring. The system identifies harmful content, assesses addiction levels, and sends real-time alerts to authorized stakeholders, enabling early intervention and ensuring a safer digital environment for minors.

---

##  Problem Statement

Adolescents are increasingly exposed to addictive social media content, leading to behavioral changes, mental health issues, and reduced academic performance. Existing solutions lack:
- Real-time detection
- Multimodal analysis
- Secure and transparent decision-making
- Early intervention mechanisms

---

##  Objectives

- Detect addictive social media content using AI  
- Analyze behavioral patterns using multimodal data  
- Monitor physiological and behavioral indicators in real time  
- Provide explainable, privacy-preserving risk assessments  
- Enable early intervention through alerts and reports  

---


##  System Architecture

<img width="1920" height="741" alt="Untitled Diagram drawio (5) (1)" src="https://github.com/user-attachments/assets/092cf0da-7ede-4078-98f7-c956b3a2cddd" />



---

##  Core Modules

### 1. Addictive Content Analysis (IMPACT Component)

**Objective :**  
To analyze social media content shared by adolescents and identify addictive patterns by evaluating images, captions, and hashtags using cognitive-based analysis techniques.

**Key Features :**
Multimodal content analysis combining image processing, caption sentiment analysis, and hashtag pattern detection.
AI-driven cognitive scaling engine to quantify addiction risk levels. Real-time processing with automated risk scoring and reporting.

**Applications :**
Early identification of social media addiction tendencies among adolescents. Decision support for parents, educators, and mental health professionals to enable timely intervention.

---

### 2. Multimodal Complaint-Driven Risk Detection

**Objective :**  
To analyze parent and guardian complaints submitted in text and voice formats in order to detect early signs of digital addiction in children and assess associated risk levels.

**Key Features :**
The system accepts text and voice-based complaints, converting speech to text for accessibility. It analyzes content to detect digital addiction patterns, tracks behavior changes over time, calculates weighted risk scores, classifies risk levels, generates reports, and alerts counselors when critical thresholds are exceeded.

**Applications :**
The system can be applied in schools, counseling centers, and child welfare organizations to support early identification of digital addiction risks. By analyzing multimodal complaints, it enables timely risk assessment, automated reporting, and efficient intervention by assigned counselors.

---

### 3. Final Decision Behavior Analysis System

**Objective :**  
To analyze multi-source behavioral data and generate a reliable final decision that identifies addiction and mental health risks while ensuring privacy and accountability.

**Key Features :**
Multi-agent Al analysis of image, text, voice, and activity data, transformer-based final decision aggregation, conflict-aware reasoning across independent reports, explainable risk classification with confidence estimation, privacy-preserving data handling, blockchain-based audit logging of decisions and authority
actions.

**Applications :**
Early detection of mental health and addiction risks, decision support for child protection and parental guidance, transparent authority notification and compliance tracking, remote monitoring support for vulnerable individuals.

---

### 4. Smart IoT-Based Behavioral Risk Monitoring System

**Objective :**  
To identify children aged 10–18 with potential mental health issues and support early diagnosis and treatment using real-time behavioral and physiological data.

**Key Features :**
The system enables real-time monitoring of facial expressions, speech intensities, and body movements, while continuously monitoring vital signs such as heart rate, ECG, body temperature, and activity levels. By analyzing this data, it helps identify stress levels and abnormal behavior patterns. The system automatically generates a smart medical card containing the patient’s complete medical history and sends SMS alerts to ensure timely follow-up treatment and continuous medical support.  

**Applications :**
This system can be applied in hospitals, pediatric clinics, and mental health centers to support early detection of mental health issues in children aged 10–18. By integrating real-time behavioral and physiological data, it assists doctors in accurate assessment, continuous monitoring, timely follow-up, and improved clinical decision-making.

---

##  Technologies Used

- **Backend:** Python, Flask  
- **Frontend:** React, Vite  
- **AI/ML:** TensorFlow, OpenCV, NLP  
- **IoT:** Sensors, Microcontrollers  
- **Blockchain:** Distributed Ledger  
- **Database:** Secure Encrypted Storage  

---

##  Installation

### 1. Clone Repository

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
```

### 2. Backend Setup

```bash
python -m venv venv

# Activate
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cd ..
```

---

##  Configuration

- Update environment variables in `.env`
- Configure API keys and database credentials
- Ensure IoT devices are properly paired

---

##  Running the Application

### Backend

```bash
python app.py
```
Runs on: `http://localhost:5000`

### Frontend

```bash
cd frontend
npm run dev
```
Runs on: `http://localhost:5173`

---

##  Testing

### Backend

```bash
python -m pytest tests/ -v
```

### Frontend

```bash
npm test
npm run build
```

---

##  Use Cases

- Detecting social media addiction  
- Monitoring mental health risks  
- School counseling systems  
- Hospital pediatric monitoring  
- Parent and guardian supervision  

---

##  Security & Privacy

- End-to-end data encryption  
- Role-based access control  
- Blockchain-based audit trails  
- Privacy-preserving AI analysis  

---

##  Limitations

- Requires stable internet connectivity  
- Accuracy depends on data quality  
- IoT hardware availability  

---

##  Future Enhancements

- Mobile application support  
- Advanced deep learning models  
- Multi-language support  
- Government and school system integration  

---

##  Contributors

- 25-26J-251-Students  
- SLIIT Faculty of Computing  

---

##  Support

For assistance:
- Check documentation and issues  
- Email: **it22097774@my.sliit.lk**  

---

##  License

This project is developed for **academic and research purposes** under SLIIT.
