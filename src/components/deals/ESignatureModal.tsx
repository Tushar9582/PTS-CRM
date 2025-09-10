import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Signature {
  documentId: string;
  signerId: string;
  signerName: string;
  signerEmail: string;
  signedAt: string;
  signatureData: string;
  status?: 'pending' | 'signed';
}

interface Document {
  id: string;
  name: string;
  content: string;
  templateId: string;
  createdAt: string;
  fields: {
    dealName: string;
    company: string;
    amount: number;
    description: string;
  };
}

interface DealData {
  name?: string;
  company?: string;
  amount?: number;
  description?: string;
  agentName?: string;
  closingDate?: string;
  documents?: Document[];
  signatures?: Signature[];
}

interface ESignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSignature: (signature: Signature) => void;
  documentId: string | null;
  dealData?: DealData;
  setDocumentId: (id: string) => void;
}

export const ESignatureModal: React.FC<ESignatureModalProps> = ({
  isOpen,
  onClose,
  onAddSignature,
  documentId,
  dealData = {},
  setDocumentId
}) => {
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSignerName('');
      setSignerEmail('');
      setSignatureData('');
      clearSignature();
    }
  }, [isOpen]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw existing signature if available
    if (signatureData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = signatureData;
    }
  }, [signatureData, isOpen]);

  // Canvas drawing handlers
  const startDrawing = (x: number, y: number) => {
    setIsDrawing(true);
    setLastX(x);
    setLastY(y);
  };

  const draw = (x: number, y: number) => {
    if (!isDrawing || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    setLastX(x);
    setLastY(y);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    saveSignature();
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    startDrawing(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    draw(x, y);
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    startDrawing(x, y);
    e.preventDefault();
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    draw(x, y);
    e.preventDefault();
  };

  // Canvas utilities
  const saveSignature = () => {
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  };

  // Form submission
  const handleRequestSignature = () => {
    if (!signerName.trim()) {
      toast.error('Please enter signer name');
      return;
    }

    if (!signerEmail.trim()) {
      toast.error('Please enter signer email');
      return;
    }

    if (!signatureData) {
      toast.error('Please provide a signature');
      return;
    }

    if (!documentId && dealData.documents?.length) {
      toast.error('Please select a document');
      return;
    }

    const newSignature: Signature = {
      documentId: documentId || 'none',
      signerId: `signer-${Date.now()}`,
      signerName,
      signerEmail,
      signedAt: new Date().toISOString(),
      signatureData,
      status: 'pending'
    };

    onAddSignature(newSignature);
    onClose();
    toast.success('Signature request sent');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Request E-Signature</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 overflow-y-auto pr-4">
          <div className="space-y-4 py-2 pb-4">
            <div className="space-y-2">
              <Label htmlFor="signerName">Signer Name *</Label>
              <Input
                id="signerName"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Enter signer's full name"
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="signerEmail">Signer Email *</Label>
              <Input
                id="signerEmail"
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="Enter signer's email address"
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Signature *</Label>
              <div className="border rounded-md p-4 bg-white">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={200}
                  className="border rounded bg-white cursor-crosshair w-full h-[200px]"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={stopDrawing}
                />
                <div className="mt-2 flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearSignature}
                    type="button"
                  >
                    Clear Signature
                  </Button>
                </div>
              </div>
            </div>
            
            {dealData.documents?.length ? (
              <div className="space-y-2">
                <Label>Document to Sign</Label>
                <Select 
                  value={documentId || ''} 
                  onValueChange={(val) => setDocumentId(val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select document" />
                  </SelectTrigger>
                  <SelectContent>
                    {dealData.documents.map((doc: Document) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        </ScrollArea>
        
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button 
            onClick={handleRequestSignature} 
            disabled={isSigning}
            type="button"
          >
            {isSigning ? 'Sending...' : 'Request Signature'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};