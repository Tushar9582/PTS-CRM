import React, { useEffect } from 'react';

interface DocuSignEmbedProps {
  documentUrl: string;
  onSigningComplete: (signedDocumentUrl: string) => void;
}

export const DocuSignEmbed: React.FC<DocuSignEmbedProps> = ({
  documentUrl,
  onSigningComplete
}) => {
  useEffect(() => {
    // This would be your actual e-signature provider integration
    // For example, loading the DocuSign or Adobe Sign JS SDK
    // and embedding the signing experience
    
    console.log('Loading e-signature experience for:', documentUrl);
    
    // Simulate signing completion
    const timer = setTimeout(() => {
      onSigningComplete(`${documentUrl}?signed=true`);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [documentUrl, onSigningComplete]);

  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-medium mb-4">Sign Document</h4>
      <div className="h-64 flex items-center justify-center bg-gray-100 rounded">
        <p className="text-muted-foreground">E-Signature provider iframe would appear here</p>
      </div>
    </div>
  );
};