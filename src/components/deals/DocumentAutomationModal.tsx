import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  signatures?: any[];
}

interface DocumentAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDocument: (document: Document) => void;
  dealData?: DealData;
}

export const DocumentAutomationModal: React.FC<DocumentAutomationModalProps> = ({
  isOpen,
  onClose,
  onAddDocument,
  dealData = {}
}) => {
  const [documentName, setDocumentName] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [templateType, setTemplateType] = useState('proposal');
  const [isGenerating, setIsGenerating] = useState(false);

  // Safely access dealData properties with defaults
  const {
    name = '',
    company = '',
    amount = 0,
    description = '',
    agentName = '',
    closingDate = ''
  } = dealData;

  const documentTemplates = {
    proposal: `Proposal for ${name}
    
Client: ${company}
Amount: $${amount.toLocaleString()}
    
Scope of Work:
${description}
    
Terms and Conditions:
1. Payment due upon signing
2. 50% deposit required
3. Final payment due upon completion`,

    contract: `Service Agreement
    
This Agreement is made between ${company} (Client) and ${agentName} (Service Provider).
    
Services to be provided: ${description}
    
Total Amount: $${amount.toLocaleString()}
    
Payment Terms: Net 30
    
This Agreement is effective as of ${closingDate || new Date().toISOString().split('T')[0]}.
    
Signed:
__________________________
Client Representative
__________________________
Service Provider`,

    invoice: `Invoice #INV-${Math.floor(Math.random() * 10000)}
    
Date: ${new Date().toISOString().split('T')[0]}
Due Date: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
    
Bill To: ${company}
    
Description: ${description}
Amount: $${amount.toLocaleString()}
    
Total Due: $${amount.toLocaleString()}
    
Payment Instructions:
Please make payment to [Bank Details]`
  };

  const handleGenerateDocument = () => {
    if (!documentName.trim()) {
      toast.error('Please enter a document name');
      return;
    }

    setIsGenerating(true);
    
    try {
      const template = documentTemplates[templateType as keyof typeof documentTemplates] || '';
      setDocumentContent(template);
      toast.success('Document generated successfully');
    } catch (error) {
      console.error('Error generating document:', error);
      toast.error('Failed to generate document');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddDocument = () => {
    if (!documentName.trim()) {
      toast.error('Please enter a document name');
      return;
    }

    if (!documentContent.trim()) {
      toast.error('Please generate or enter document content');
      return;
    }

    const newDocument: Document = {
      id: `doc-${Date.now()}`,
      name: documentName,
      content: documentContent,
      templateId: templateType,
      createdAt: new Date().toISOString(),
      fields: {
        dealName: name,
        company,
        amount,
        description
      }
    };

    onAddDocument(newDocument);
    onClose();
    setDocumentName('');
    setDocumentContent('');
    toast.success('Document added to deal');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Generate Document</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="documentName">Document Name *</Label>
            <Input
              id="documentName"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="e.g., Proposal, Contract, Invoice"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="templateType">Template Type</Label>
            <Select value={templateType} onValueChange={setTemplateType}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="documentContent">Document Content *</Label>
              {templateType !== 'custom' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateDocument}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Generating...' : 'Generate from Template'}
                </Button>
              )}
            </div>
            <Textarea
              id="documentContent"
              value={documentContent}
              onChange={(e) => setDocumentContent(e.target.value)}
              rows={10}
              placeholder="Document content will appear here..."
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAddDocument}>
            Add to Deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};