import React from 'react';
import { Brain, Sparkles, Eye, Shield } from 'lucide-react';

interface ComplaintLoadingScreenProps {
  isAnalyzing: boolean;
}

const ComplaintLoadingScreen: React.FC<ComplaintLoadingScreenProps> = ({ isAnalyzing }) => {
  if (!isAnalyzing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="relative">
        {/* Animated background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 h-64 w-64 animate-pulse rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-64 w-64 animate-pulse rounded-full bg-secondary/10 blur-3xl" />
        </div>
        
        {/* Main loading container */}
        <div className="relative flex flex-col items-center justify-center space-y-8">
          {/* Animated circles */}
          <div className="relative h-48 w-48">
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <div className="absolute inset-4 animate-spin rounded-full border-4 border-secondary/20 border-t-secondary" style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
            <div className="absolute inset-8 animate-spin rounded-full border-4 border-accent/20 border-t-accent" style={{ animationDuration: '1.5s' }} />
            
            {/* Central icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <Brain className="h-16 w-16 animate-pulse text-primary" />
                <Sparkles className="absolute -right-2 -top-2 h-8 w-8 animate-bounce text-yellow-500" />
              </div>
            </div>
          </div>

          {/* Progress indicators */}
          <div className="text-center space-y-4 max-w-md">
            <h2 className="text-2xl font-bold text-foreground">Analyzing Your Complaint</h2>
            <p className="text-muted-foreground">Running AI analysis on ports 5000 & 8000...</p>
            
            {/* Progress steps */}
            <div className="flex items-center justify-center space-x-8 pt-4">
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Eye className="h-6 w-6 text-primary animate-pulse" />
                </div>
                <p className="mt-2 text-sm font-medium">Image Analysis</p>
                <p className="text-xs text-muted-foreground">Port 5000</p>
              </div>
              
              <div className="h-0.5 w-8 bg-primary/20">
                <div className="h-full w-0 animate-[progress_1s_ease-in-out_infinite] bg-primary" />
              </div>
              
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10">
                  <Brain className="h-6 w-6 text-secondary animate-pulse" style={{ animationDelay: '0.2s' }} />
                </div>
                <p className="mt-2 text-sm font-medium">Text Analysis</p>
                <p className="text-xs text-muted-foreground">Port 8000</p>
              </div>
              
              <div className="h-0.5 w-8 bg-primary/20">
                <div className="h-full w-0 animate-[progress_1s_ease-in-out_infinite] bg-primary" />
              </div>
              
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                  <Shield className="h-6 w-6 text-accent animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
                <p className="mt-2 text-sm font-medium">Risk Assessment</p>
                <p className="text-xs text-muted-foreground">Combining Results</p>
              </div>
            </div>

            {/* Loading dots */}
            <div className="flex justify-center space-x-2 pt-6">
              <div className="h-3 w-3 animate-bounce rounded-full bg-primary" />
              <div className="h-3 w-3 animate-bounce rounded-full bg-secondary" style={{ animationDelay: '0.1s' }} />
              <div className="h-3 w-3 animate-bounce rounded-full bg-accent" style={{ animationDelay: '0.2s' }} />
            </div>

            {/* Percentage */}
            <div className="pt-4">
              <div className="h-2 w-64 overflow-hidden rounded-full bg-muted">
                <div 
                  className="h-full w-0 animate-[loading_2s_ease-in-out_infinite] bg-gradient-to-r from-primary via-secondary to-accent"
                  style={{ animationDuration: '3s' }}
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Processing your complaint...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplaintLoadingScreen;