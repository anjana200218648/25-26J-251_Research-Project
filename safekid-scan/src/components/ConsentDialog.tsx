import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ShieldCheck } from 'lucide-react';

interface ConsentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConsentDialog = ({ isOpen, onClose, onConfirm }: ConsentDialogProps) => {
  const [agreed, setAgreed] = useState(false);
  const { t } = useLanguage();

  const handleConfirm = () => {
    if (agreed) {
      onConfirm();
      setAgreed(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">
            {t.consent.title}
          </DialogTitle>
          <DialogDescription className="text-center text-base leading-relaxed pt-2">
            {t.consent.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start space-x-3 rounded-lg border bg-muted/50 p-4">
          <Checkbox
            id="consent"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked as boolean)}
            className="mt-1"
          />
          <Label
            htmlFor="consent"
            className="cursor-pointer text-sm leading-relaxed"
          >
            {t.consent.checkbox}
          </Label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            {t.consent.cancel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!agreed}
            className="bg-primary hover:bg-primary-hover"
          >
            {t.consent.continue}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
