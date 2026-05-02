import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ExtractionResult } from '@/types/textAnalysis';

export interface TextAnalyzerProps {
  onAnalyzeComplete: (result: ExtractionResult) => void;
}

export const TextAnalyzerComponent: React.FC<TextAnalyzerProps> = ({ onAnalyzeComplete }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnalyze = () => {
    setLoading(true);
    // Simulate async analysis
    setTimeout(() => {
      const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
      const result: ExtractionResult = {
        english: {
          text,
          word_count: wordCount,
          confidence: Math.min(100, 80 + Math.floor(Math.random() * 20))
        },
        content_analysis: {
          confidence: 0.9,
          recommendations: wordCount > 0 ? ['Review for age-appropriate language', 'Consider simplifying complex phrases'] : []
        },
        age_appropriateness: wordCount > 0 ? 'safe' : 'caution',
        safety_score: wordCount > 0 ? 85 : 40
      };

      setLoading(false);
      onAnalyzeComplete(result);
    }, 600);
  };

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type text to analyze..."
        className="w-full p-3 border rounded min-h-[120px]"
      />

      <div className="flex items-center gap-2">
        <Button onClick={handleAnalyze} disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze Text'}
        </Button>
        <Button variant="ghost" onClick={() => setText('')}>Clear</Button>
      </div>
    </div>
  );
};

export default TextAnalyzerComponent;
