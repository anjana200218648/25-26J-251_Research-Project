export type Language = 'en' | 'si';

export const translations = {
  en: {
    // Onboarding
    onboarding: {
      welcome: {
        title: "Welcome to ChildSafe Scan",
        description: "Easily check if a screenshot may be addictive for your child."
      },
      security: {
        title: "Private and Secure",
        description: "We don't share personal data without consent. Only guardian-provided details are used."
      },
      quick: {
        title: "Quick & Friendly",
        description: "Upload a screenshot and get an easy-to-understand result."
      },
      skip: "Skip",
      next: "Next",
      back: "Back",
      getStarted: "Start Scan"
    },
    
    // Navigation
    nav: {
      language: "Language"
    },
    
    // Upload Screen
    upload: {
      title: "Upload Screenshot",
      subtitle: "Check if social media content may be addictive for your child",
      dragDrop: "Drag and drop your screenshot here, or",
      chooseFile: "Choose file",
      supportedFormats: "Supported: JPG, PNG, WEBP (Max 10 MB)",
      helpText: "Make sure the screenshot includes captions/hashtags",
      uploading: "Processing...",
      uploadAnother: "Upload Another"
    },
    
    // Form
    form: {
      childName: "Child's Name",
      childNamePlaceholder: "Enter child's name",
      age: "Age",
      agePlaceholder: "Select age",
      guardianName: "Guardian Name",
      guardianNamePlaceholder: "Your name",
      guardianPhone: "Phone Number",
      guardianPhonePlaceholder: "Your phone number",
      region: "Region",
      regionPlaceholder: "Select region ",
      happiness: "Child's Happiness Note",
      happinessPlaceholder: "Brief note about your child's mood ",
      submit: "Upload & Scan",
      required: "This field is required",
      invalidPhone: "Please enter a valid phone number",
      invalidAge: "Age must be between 1 and 18"
    },
    
    // Consent
    consent: {
      title: "Guardian Consent",
      description: "By continuing you confirm you are the child's guardian and consent to use this data for research purposes only.",
      checkbox: "I confirm I am the child's guardian",
      continue: "Continue",
      cancel: "Cancel"
    },
    
    // Results
    results: {
      title: "Scan Results",
      addictiveScore: "Addictive Risk Score",
      low: "Low Risk",
      lowDescription: "Not likely addictive",
      medium: "Medium Risk",
      mediumDescription: "Some addictive elements detected",
      high: "High Risk",
      highDescription: "May be addictive",
      breakdown: "Risk Breakdown",
      detectedFeatures: "Detected Risky Features",
      evidence: "Evidence",
      suggestions: "Suggested Actions",
      actions: {
        talkWithChild: "Talk with your child about online safety",
        reduceScreenTime: "Consider reducing screen time",
        reportContent: "Report concerning content to the platform",
        seekSupport: "Contact guardian helpline for support"
      },
      downloadReport: "Download Report (PDF)",
      share: "Share",
      scanAnother: "Scan Another",
      backToHome: "Back to Home"
    },
    
    // Features
    features: {
      hashtags: "Provocative Hashtags",
      captions: "Attention-grabbing Captions",
      rewards: "Repeated Reward Cues",
      autoplay: "Autoplay Content",
      visuals: "Provocative Visuals"
    },
    
    // Privacy
    privacy: {
      notice: "Your data is used only for research with guardian consent."
    },
    
    // Errors
    errors: {
      fileTooBig: "File size exceeds 10 MB",
      invalidFormat: "Invalid file format. Please use JPG, PNG, or WEBP",
      noFile: "Please select a file to upload",
      scanFailed: "Scan failed. Please try again or contact support"
    }
  },
  
  si: {
    // Onboarding
    onboarding: {
      welcome: {
        title: "ChildSafe Scan වෙත සාදරයෙන් පිළිගනිමු",
        description: "ළමයින්ට ආසාධ්‍යකරණය වීමට ඇති දැක්මන් හඳුනාගන්න පහසු ක්‍රමයක්."
      },
      security: {
        title: "නිෂ්පාදිත හා ආරක්ෂිත",
        description: "කවුරුන්ගේ අවසරය නැතිව පුද්ගලික දත්ත බෙදා නොහැරේ."
      },
      quick: {
        title: "වේගවත් සහ මිත්‍රශීලී",
        description: "ස්ක්‍රීන්‌ශොට් එකක් උඩුගත කර පහසු ලෙස ලද ප්‍රතිඵල බලන්න."
      },
      skip: "මඟ හරින්න",
      next: "ඊළඟ",
      back: "ආපසු",
      getStarted: "පරීක්ෂාව ආරම්භ කරන්න"
    },
    
    // Navigation
    nav: {
      language: "භාෂාව"
    },
    
    // Upload Screen
    upload: {
      title: "ස්ක්‍රීන්‌ශොට් උඩුගත කරන්න",
      subtitle: "සමාජ මාධ්‍ය අන්තර්ගතය ළමයින්ට ආසාධ්‍යකරණවීමේ අවදානම පරීක්ෂා කරන්න",
      dragDrop: "ඔබගේ ස්ක්‍රීන්‌ශොට් මෙහි ඇද දමන්න, හෝ",
      chooseFile: "ගොනුවක් තෝරන්න",
      supportedFormats: "සහාය දක්වන්නේ: JPG, PNG, WEBP (උපරිමය 10 MB)",
      helpText: "ස්ක්‍රීන්‌ශොට් එකේ කැප්ෂන් සහ හැෂ්ටැග් ඇතුළත් බවට පරීක්ෂා කරන්න",
      uploading: "සකසමින්...",
      uploadAnother: "තවත් උඩුගත කරන්න"
    },
    
    // Form
    form: {
      childName: "ළමයාගේ නම",
      childNamePlaceholder: "ළමයාගේ නම ඇතුළත් කරන්න",
      age: "වයස",
      agePlaceholder: "වයස තෝරන්න",
      guardianName: "දෙමාපියගේ නම",
      guardianNamePlaceholder: "ඔබගේ නම",
      guardianPhone: "දුරකථන අංකය",
      guardianPhonePlaceholder: "ඔබගේ දුරකථන අංකය",
      region: "ප්‍රදේශය",
      regionPlaceholder: "ප්‍රදේශය තෝරන්න ",
      happiness: "ළමයාගේ සතුට",
      happinessPlaceholder: "ළමයාගේ මනෝභාවය පිළිබඳ කෙටි සටහනක් ",
      submit: "උඩුගත කර පරීක්ෂා කරන්න",
      required: "මෙම ක්ෂේත්‍රය අවශ්‍ය වේ",
      invalidPhone: "කරුණාකර වලංගු දුරකථන අංකයක් ඇතුළත් කරන්න",
      invalidAge: "වයස 1 සිට 18 දක්වා විය යුතුය"
    },
    
    // Consent
    consent: {
      title: "දෙමාපිය එකඟතාවය",
      description: "ඉදිරියට යාමෙන් ඔබ ළමයාගේ භාරකරු බව සහ මෙම දත්ත පර්යේෂණ අරමුණු සඳහා පමණක් භාවිතා කිරීමට එකඟ බව තහවුරු කරයි.",
      checkbox: "මම ළමයාගේ දෙමාපියෙක් බවට තහවුරු කරමි",
      continue: "ඉදිරියට යන්න",
      cancel: "අවලංගු කරන්න"
    },
    
    // Results
    results: {
      title: "පරීක්ෂණ ප්‍රතිඵල",
      addictiveScore: "ආසාධ්‍යකරණ අවදානම් ලකුණු",
      low: "අඩු අවදානම",
      lowDescription: "ආසාධ්‍යකරණවීමේ අවදානම අඩුයි",
      medium: "මධ්‍යම අවදානම",
      mediumDescription: "සමහර ආසාධ්‍යකරණ අංග හඳුනාගෙන ඇත",
      high: "ඉහළ අවදානම",
      highDescription: "ආසාධ්‍යකරණ වීමේ අවදානම ඇත",
      breakdown: "අවදානම් විශ්ලේෂණය",
      detectedFeatures: "හඳුනාගත් අවදානම් ලක්ෂණ",
      evidence: "සාක්ෂි",
      suggestions: "යෝජිත ක්‍රියාමාර්ග",
      actions: {
        talkWithChild: "ඔන්ලයින් ආරක්ෂාව පිළිබඳ ඔබේ දරුවා සමඟ කතා කරන්න",
        reduceScreenTime: "තිර කාලය අඩු කිරීම සලකා බලන්න",
        reportContent: "සැලකිය යුතු අන්තර්ගතය වේදිකාවට වාර්තා කරන්න",
        seekSupport: "සහාය සඳහා භාරකරු උපකාර මාර්ගය අමතන්න"
      },
      downloadReport: "වාර්තාව බාගන්න (PDF)",
      share: "බෙදාගන්න",
      scanAnother: "තවත් පරීක්ෂාවක් කරන්න",
      backToHome: "මුල් පිටුවට"
    },
    
    // Features
    features: {
      hashtags: "උත්තේජක හැෂ්ටැග්",
      captions: "අවධානය ආකර්ෂණය කරන කැප්ෂන්",
      rewards: "පුනරාවර්තන ත්‍යාග ඉඟි",
      autoplay: "ස්වයංක්‍රීය වාදන අන්තර්ගතය",
      visuals: "උත්තේජක දෘශ්‍ය"
    },
    
    // Privacy
    privacy: {
      notice: "ඔබගේ දත්ත දෙමාපියගේ අවසරය මත පර්යේෂණ සඳහා පමණක් භාවිතා කරයි."
    },
    
    // Errors
    errors: {
      fileTooBig: "ගොනු ප්‍රමාණය 10 MB ඉක්මවයි",
      invalidFormat: "වලංගු නොවන ගොනු ආකෘතිය. කරුණාකර JPG, PNG, හෝ WEBP භාවිතා කරන්න",
      noFile: "කරුණාකර උඩුගත කිරීමට ගොනුවක් තෝරන්න",
      scanFailed: "පරිලෝකනය අසාර්ථක විය. කරුණාකර නැවත උත්සාහ කරන්න හෝ සහාය අමතන්න"
    }
  }
};

export type TranslationKey = keyof typeof translations.en;
