import { LanguageToggle } from './LanguageToggle';
import { Shield } from 'lucide-react';

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-foreground">ChildSafe Scan</h1>
            <p className="text-xs text-muted-foreground">Social Media Safety</p>
          </div>
        </div>
        
        <LanguageToggle />
      </div>
    </header>
  );
};
