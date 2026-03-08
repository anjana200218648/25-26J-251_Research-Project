export interface TextExtractionData {
  text: string;
  word_count: number;
  confidence: number;
}

export interface ContentAnalysis {
  confidence: number;
  recommendations: string[];
}

export interface ExtractionResult {
  english: TextExtractionData;
  content_analysis: ContentAnalysis;
  age_appropriateness: 'safe' | 'caution' | 'warning' | 'danger';
  safety_score: number;
}
