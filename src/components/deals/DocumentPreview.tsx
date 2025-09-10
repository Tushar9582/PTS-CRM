import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, Clock, FileText, Send } from 'lucide-react';

interface DocumentPreviewProps {
  content: string;
  onSign: () => void;
  isSigning: boolean;
  signatureStatus: {
    isSent: boolean;
    isSigned: boolean;
    signedDocumentUrl?: string;
  };
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  content,
  onSign,
  isSigning,
  signatureStatus
}) => {
  return (
    <div className="border rounded-lg p-4 h-full">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Document Preview
        </h4>
        
        {signatureStatus.isSigned ? (
          <span className="flex items-center text-sm text-green-500">
            <Check className="h-4 w-4 mr-1" /> Signed
          </span>
        ) : signatureStatus.isSent ? (
          <span className="flex items-center text-sm text-yellow-500">
            <Clock className="h-4 w-4 mr-1" /> Sent for Signature
          </span>
        ) : (
          <Button
            onClick={onSign}
            disabled={isSigning}
            size="sm"
            className="flex items-center gap-1"
          >
            <Send className="h-4 w-4" />
            {isSigning ? 'Sending...' : 'Send for Signature'}
          </Button>
        )}
      </div>
      
      <div className="border rounded p-4 h-64 overflow-auto">
        {/* This would be your actual document preview implementation */}
        <pre className="text-xs">{content}</pre>
      </div>
      
      {signatureStatus.signedDocumentUrl && (
        <div className="mt-4">
          <a 
            href={signatureStatus.signedDocumentUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline"
          >
            View Signed Document
          </a>
        </div>
      )}
    </div>
  );
};