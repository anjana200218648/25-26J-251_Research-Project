// Create a new component: src/components/ReportLanguageModal.tsx

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Languages, Download } from 'lucide-react';

interface ReportLanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: (language: 'english' | 'sinhala' | 'both') => void;
}

export const ReportLanguageModal: React.FC<ReportLanguageModalProps> = ({
  isOpen,
  onClose,
  onDownload
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Languages className="h-5 w-5 text-blue-600" />
            Download Report
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <Button
            onClick={() => onDownload('both')}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white py-6"
          >
            <Download className="h-5 w-5" />
            Bilingual Report (English & සිංහල)
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => onDownload('english')}
              className="gap-2 py-6"
            >
              <span className="font-bold">EN</span>
              English Only
            </Button>
            
            <Button
              variant="outline"
              onClick={() => onDownload('sinhala')}
              className="gap-2 py-6"
            >
              <span className="font-bold text-lg">සි</span>
              සිංහල පමණි
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
