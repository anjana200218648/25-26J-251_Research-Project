export interface LanguageExtraction {
  text: string;
  word_count: number;
  confidence: number; // 0-100
}

export interface ContentAnalysis {
  confidence: number; // 0-1
  recommendations?: string[];
}

export type AgeAppropriateness = 'safe' | 'caution' | 'not_safe';

export interface ExtractionResult {
  english?: LanguageExtraction;
  sinhala?: LanguageExtraction;
  content_analysis?: ContentAnalysis;
  age_appropriateness?: AgeAppropriateness;
  safety_score?: number; // 0-100
}

export default ExtractionResult;
