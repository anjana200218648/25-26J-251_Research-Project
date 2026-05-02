import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import welcomeImg from '@/assets/onboarding-welcome.png';
import securityImg from '@/assets/onboarding-security.png';
import scanImg from '@/assets/onboarding-scan.png';

const slides = [
  { 
    key: 'welcome' as const,
    image: welcomeImg 
  },
  { 
    key: 'security' as const,
    image: securityImg 
  },
  { 
    key: 'quick' as const,
    image: scanImg 
  }
];

export default function Onboarding() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleGetStarted();
    }
  };

  const handleBack = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleSkip = () => {
    handleGetStarted();
  };

  const handleGetStarted = () => {
    localStorage.setItem('childsafe-onboarded', 'true');
    navigate('/upload');
  };

  const slide = slides[currentSlide];
  const content = t.onboarding[slide.key];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/5 via-background to-secondary/30">
      {/* Skip Button */}
      <div className="container mx-auto flex justify-end px-4 pt-6">
        <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
          {t.onboarding.skip}
        </Button>
      </div>

      {/* Main Content */}
      <div className="container mx-auto flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Image */}
          <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-secondary/20 shadow-lg">
            <img
              src={slide.image}
              alt={content.title}
              className="h-full w-full object-cover"
            />
          </div>

          {/* Text Content */}
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {content.title}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {content.description}
            </p>
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide
                    ? 'w-8 bg-primary'
                    : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-4">
            {currentSlide > 0 && (
              <Button
                variant="outline"
                size="lg"
                onClick={handleBack}
                className="flex-1 gap-2"
              >
                <ChevronLeft className="h-5 w-5" />
                {t.onboarding.back}
              </Button>
            )}
            
            <Button
              size="lg"
              onClick={handleNext}
              className="flex-1 gap-2 bg-primary hover:bg-primary-hover"
            >
              {currentSlide === slides.length - 1 ? t.onboarding.getStarted : t.onboarding.next}
              {currentSlide < slides.length - 1 && <ChevronRight className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
