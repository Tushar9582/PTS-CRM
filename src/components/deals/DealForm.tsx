import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { database } from '../../firebase';
import { ref, set, push, onValue, off, remove } from 'firebase/database';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { DocumentAutomationModal } from './DocumentAutomationModal';
import { ESignatureModal } from './ESignatureModal';

// Encryption key - should be stored securely in production
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8'; // 32 chars for AES-256

// Helper function to encrypt data
async function encryptData(data: string): Promise<string> {
  if (!data) return data;
  
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(data);
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ENCRYPTION_KEY),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encodedData
  );
  
  // Combine iv and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// Helper function to decrypt data
async function decryptData(encryptedData: string): Promise<string> {
  if (!encryptedData) return encryptedData;
  
  try {
    const decoder = new TextDecoder();
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(ENCRYPTION_KEY),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedData; // Return original if decryption fails
  }
}

// Function to encrypt deal object
async function encryptDeal(deal: any): Promise<any> {
  const encryptedDeal = { ...deal };
  
  // Encrypt each field that needs encryption
  encryptedDeal.name = await encryptData(deal.name);
  encryptedDeal.leadName = await encryptData(deal.leadName);
  encryptedDeal.agentName = await encryptData(deal.agentName);
  encryptedDeal.company = await encryptData(deal.company);
  encryptedDeal.description = await encryptData(deal.description);
  
  // Encrypt custom fields
  for (const key in deal) {
    if (![
      'id', 'leadId', 'agentId', 'amount', 'status', 
      'createdAt', 'closingDate', 'documents', 'signatures'
    ].includes(key)) {
      encryptedDeal[key] = await encryptData(deal[key]);
    }
  }
  
  return encryptedDeal;
}

// Function to decrypt deal object
async function decryptDeal(deal: any): Promise<any> {
  const decryptedDeal = { ...deal };
  
  // Decrypt each encrypted field
  decryptedDeal.name = await decryptData(deal.name);
  decryptedDeal.leadName = await decryptData(deal.leadName);
  decryptedDeal.agentName = await decryptData(deal.agentName);
  decryptedDeal.company = await decryptData(deal.company);
  decryptedDeal.description = await decryptData(deal.description);
  
  // Decrypt custom fields
  for (const key in deal) {
    if (![
      'id', 'leadId', 'agentId', 'amount', 'status', 
      'createdAt', 'closingDate', 'documents', 'signatures'
    ].includes(key)) {
      decryptedDeal[key] = await decryptData(deal[key]);
    }
  }
  
  return decryptedDeal;
}

// Function to decrypt agent object
async function decryptAgent(agent: any): Promise<any> {
  const decryptedAgent = { ...agent };
  
  // Decrypt each encrypted field
  decryptedAgent.name = await decryptData(agent.name);
  decryptedAgent.email = await decryptData(agent.email);
  decryptedAgent.status = await decryptData(agent.status);
  
  return decryptedAgent;
}

// Function to decrypt lead object
async function decryptLead(lead: any): Promise<any> {
  const decryptedLead = { ...lead };
  
  // Decrypt each encrypted field
  decryptedLead.first_name = await decryptData(lead.first_name);
  decryptedLead.last_name = await decryptData(lead.last_name);
  decryptedLead.Email_ID = await decryptData(lead.Email_ID);
  decryptedLead.Company = await decryptData(lead.Company);
  decryptedLead.Mobile_Number = await decryptData(lead.Mobile_Number);
  decryptedLead.Meeting_Status = await decryptData(lead.Meeting_Status);
  
  return decryptedLead;
}

interface Deal {
  id: string;
  name: string;
  leadId: string;
  leadName: string;
  agentId: string;
  agentName: string;
  amount: number;
  status: 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  createdAt: string;
  closingDate: string;
  company: string;
  description?: string;
  documents?: Array<{
    id: string;
    name: string;
    url: string;
    createdAt: string;
    templateId?: string;
    fields?: Record<string, string>;
  }>;
  signatures?: Array<{
    documentId: string;
    signerId: string;
    signerName: string;
    signerEmail: string;
    signedAt: string;
    signatureData: string;
  }>;
  [key: string]: any;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  Email_ID: string;
  Company: string;
  Mobile_Number: string;
  Meeting_Status: string;
}

interface Agent {
  id: string;
  name: string;
  email: string;
  status: string;
}

interface DealFormProps {
  isOpen: boolean;
  onClose: () => void;
  deal?: Deal | null;
  isLoading?: boolean;
  onSubmit?: (deal: Deal) => void;
}

const allCoreFormFields = [
  { key: 'name', label: 'Deal Name', type: 'text', required: true },
  { key: 'leadId', label: 'Lead', type: 'select', required: true },
  { key: 'agentId', label: 'Agent', type: 'select', required: true },
  { key: 'amount', label: 'Amount ($)', type: 'number', required: true },
  { key: 'status', label: 'Status', type: 'select', required: true },
  { key: 'company', label: 'Company', type: 'text', required: true },
  { key: 'closingDate', label: 'Expected Closing Date', type: 'date', required: true },
  { key: 'description', label: 'Description', type: 'textarea', required: false },
];

export const DealForm: React.FC<DealFormProps> = ({
  isOpen,
  onClose,
  deal,
  isLoading = false,
  onSubmit
}) => {
  const { user } = useAuth();
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [decryptedLeads, setDecryptedLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [decryptedAgents, setDecryptedAgents] = useState<Agent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const isAgent = !!agentId;
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Deal>>({});
  const [isFieldSelectionOpen, setIsFieldSelectionOpen] = useState(false);
  const [selectedFormFields, setSelectedFormFields] = useState<string[]>([]);
  const [customFieldName, setCustomFieldName] = useState('');
  const [dynamicCustomFields, setDynamicCustomFields] = useState<{ key: string; label: string; type: 'text'; required: boolean }[]>([]);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Effect to initialize formData
  useEffect(() => {
    if (isOpen) {
      const initializeForm = async () => {
        setIsDecrypting(true);
        try {
          let initialFormData: Partial<Deal> = {
            name: '',
            leadId: '',
            leadName: '',
            agentId: isAgent ? agentId : '',
            agentName: isAgent ? user?.displayName || '' : '',
            amount: 0,
            status: 'proposal',
            closingDate: '',
            company: '',
            description: ''
          };

          if (deal) {
            const decryptedDeal = await decryptDeal(deal);
            initialFormData = { ...decryptedDeal };

            const coreFieldKeys = allCoreFormFields.map(f => f.key);
            const existingCustomFields = Object.keys(decryptedDeal).filter(key =>
              !coreFieldKeys.includes(key as keyof Deal) &&
              !['id', 'createdAt', 'documents', 'signatures'].includes(key)
            ).map(key => ({
              key: key,
              label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
              type: 'text',
              required: false
            }));

            setDynamicCustomFields(existingCustomFields);
            setSelectedFormFields([...coreFieldKeys, ...existingCustomFields.map(f => f.key)]);
          } else {
            setSelectedFormFields(allCoreFormFields.map(f => f.key));
            setDynamicCustomFields([]);
          }

          setFormData(initialFormData);
          setSearchTerm('');
          setIsFieldSelectionOpen(false);
        } catch (error) {
          console.error('Error initializing form:', error);
          toast.error('Failed to initialize form data');
        } finally {
          setIsDecrypting(false);
        }
      };

      initializeForm();
    }
  }, [isOpen, deal, isAgent, agentId, user]);

  const allAvailableFormFields = [...allCoreFormFields, ...dynamicCustomFields];

  // Fetch and decrypt leads from Firebase
  useEffect(() => {
    if (!isOpen) return;

    const currentUserId = adminId || agentId;
    if (!currentUserId) return;

    const leadsRef = ref(database, `users/${currentUserId}/leads`);

    const fetchAndDecryptLeads = async () => {
      try {
        onValue(leadsRef, async (snapshot) => {
          const leadsData: Lead[] = [];
          
          // First collect all encrypted leads
          snapshot.forEach((childSnapshot) => {
            leadsData.push({
              id: childSnapshot.key || '',
              ...childSnapshot.val()
            });
          });

          // Then decrypt them all
          const decryptedLeads = await Promise.all(
            leadsData.map(async lead => await decryptLead(lead))
          );
          
          setLeads(leadsData);
          setDecryptedLeads(decryptedLeads);
        }, (error) => {
          console.error("Firebase onValue error for leads:", error);
          toast.error("Failed to fetch leads from database.");
        });
      } catch (error) {
        console.error("Error decrypting leads:", error);
        toast.error("Failed to decrypt lead data.");
      }
    };

    fetchAndDecryptLeads();
    return () => { off(leadsRef); };
  }, [adminId, agentId, isOpen]);

  // Fetch and decrypt agents from Firebase
  useEffect(() => {
    if (!adminId || !isOpen) return;

    const agentsRef = ref(database, `users/${adminId}/agents`);

    const fetchAndDecryptAgents = async () => {
      try {
        onValue(agentsRef, async (snapshot) => {
          const agentsData: Agent[] = [];
          
          // First collect all encrypted agents
          snapshot.forEach((childSnapshot) => {
            agentsData.push({
              id: childSnapshot.key || '',
              ...childSnapshot.val()
            });
          });

          // Then decrypt them all
          const decryptedAgents = await Promise.all(
            agentsData.map(async agent => await decryptAgent(agent))
          );
          
          setAgents(agentsData);
          setDecryptedAgents(decryptedAgents);

          if (isAgent && !deal) {
            const currentAgent = decryptedAgents.find(a => a.id === agentId);
            if (currentAgent) {
              setFormData(prev => ({
                ...prev,
                agentId: agentId,
                agentName: currentAgent.name
              }));
            }
          }
        }, (error) => {
          console.error("Firebase onValue error for agents:", error);
          toast.error("Failed to fetch agents from database.");
        });
      } catch (error) {
        console.error("Error decrypting agents:", error);
        toast.error("Failed to decrypt agent data.");
      }
    };

    fetchAndDecryptAgents();
    return () => { off(agentsRef); };
  }, [adminId, isOpen, isAgent, agentId, deal]);

  const filteredLeads = decryptedLeads.filter(lead => {
    return (
      lead?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead?.Company?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const processedValue = (name === 'amount' && e.target.type === 'number') ? parseFloat(value) || 0 : value;

    setFormData(prevData => ({
      ...prevData,
      [name]: processedValue,
    }));
  }, []);

  const handleSelectChange = useCallback((field: string, value: string) => {
    let updatedData: Partial<Deal> = { ...formData, [field]: value };

    if (field === 'leadId') {
      const selectedLead = decryptedLeads.find(lead => lead.id === value);
      if (selectedLead) {
        updatedData = {
          ...updatedData,
          company: selectedLead.Company || '',
          leadName: `${selectedLead.first_name} ${selectedLead.last_name}`
        };
      } else {
        updatedData = {
          ...updatedData,
          company: '',
          leadName: ''
        };
        toast.error("Selected lead not found in list. Please re-select.");
      }
    }

    if (field === 'agentId') {
      const selectedAgent = decryptedAgents.find(agent => agent.id === value);
      if (selectedAgent) {
        updatedData = {
          ...updatedData,
          agentName: selectedAgent.name
        };
      } else {
        updatedData = {
          ...updatedData,
          agentName: ''
        };
        toast.error("Selected agent not found in list. Please re-select.");
      }
    }
    setFormData(updatedData);
  }, [formData, decryptedLeads, decryptedAgents]);

  const handleFieldCheckboxChange = (fieldKey: string, checked: boolean) => {
    setSelectedFormFields(prev =>
      checked ? [...prev, fieldKey] : prev.filter(f => f !== fieldKey)
    );
  };

  const handleAddCustomField = () => {
    if (!customFieldName.trim()) {
      toast.error('Custom field name cannot be empty.');
      return;
    }
    const sanitizedKey = customFieldName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

    if (allAvailableFormFields.some(f => f.key === sanitizedKey)) {
      toast.error(`Field "${customFieldName}" already exists.`);
      return;
    }

    const newCustomField = {
      key: sanitizedKey,
      label: customFieldName.trim(),
      type: 'text' as 'text',
      required: false
    };

    setDynamicCustomFields(prev => [...prev, newCustomField]);
    setSelectedFormFields(prev => [...prev, newCustomField.key]);
    setFormData(prev => ({ ...prev, [newCustomField.key]: '' }));
    setCustomFieldName('');
    toast.success(`Custom field "${newCustomField.label}" added.`);
  };

  const handleAddDocument = (document: any) => {
    setFormData(prev => ({
      ...prev,
      documents: [...(prev.documents || []), document]
    }));
  };

  const handleAddSignature = (signature: any) => {
    setFormData(prev => ({
      ...prev,
      signatures: [...(prev.signatures || []), signature]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId) {
      toast.error("Admin ID not found");
      return;
    }

    // Validate required fields
    const missingRequiredField = allAvailableFormFields.find(
      field => selectedFormFields.includes(field.key) && 
             field.required && 
             !formData[field.key]
    );

    if (missingRequiredField) {
      toast.error(`Please fill the required field: ${missingRequiredField.label}`);
      return;
    }

    try {
      // 1. Prepare the deal data (unencrypted)
      const dealData: Deal = {
        id: deal?.id || '', // Will be set for new deals
        createdAt: deal?.createdAt || format(new Date(), 'yyyy-MM-dd'),
        ...formData
      } as Deal;

      // 2. Update relational data if needed
      if (formData.leadId && (!deal || formData.leadId !== deal.leadId)) {
        const selectedLead = decryptedLeads.find(l => l.id === formData.leadId);
        if (selectedLead) {
          dealData.leadName = `${selectedLead.first_name} ${selectedLead.last_name}`;
          dealData.company = selectedLead.Company || '';
        }
      }

      if (formData.agentId && (!deal || formData.agentId !== deal.agentId)) {
        const selectedAgent = decryptedAgents.find(a => a.id === formData.agentId);
        if (selectedAgent) {
          dealData.agentName = selectedAgent.name;
        }
      }

      // 3. Add custom fields
      allAvailableFormFields.forEach(field => {
        if (selectedFormFields.includes(field.key) && !(field.key in dealData)) {
          dealData[field.key] = formData[field.key] ?? null;
        }
      });

      // 4. Encrypt the data
      const encryptedDeal = await encryptDeal(dealData);

      // 5. Call the onSubmit callback with the encrypted deal
      if (onSubmit) {
        onSubmit(encryptedDeal);
      }

    } catch (error) {
      console.error('Error saving deal:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Failed to save deal'}`);
    }
  };

  const renderField = (field: typeof allCoreFormFields[number] | typeof dynamicCustomFields[number]) => {
    if (!selectedFormFields.includes(field.key)) return null;

    const isCoreField = allCoreFormFields.some(f => f.key === field.key);

    if (!isCoreField) {
      return (
        <div className="space-y-2" key={field.key}>
          <Label htmlFor={field.key}>{field.label} {field.required ? '*' : ''}</Label>
          <Input
            id={field.key}
            name={field.key}
            type="text"
            className="focus:shadow-none"
            value={formData[field.key] || ''}
            onChange={handleChange}
            required={field.required}
          />
        </div>
      );
    }

    switch (field.key) {
      case 'name':
      case 'amount':
      case 'closingDate':
      case 'company':
      case 'description':
        return (
          <div className="space-y-2" key={field.key}>
            <Label htmlFor={field.key}>{field.label} {field.required ? '*' : ''}</Label>
            <Input
              id={field.key}
              name={field.key}
              type={field.type === 'textarea' ? 'text' : field.type}
              className="focus:shadow-none"
              value={field.key === 'amount' && formData.amount === 0 ? 0 : formData[field.key] || ''}
              onChange={handleChange}
              required={field.required}
            />
          </div>
        );
      case 'leadId':
        return (
          <div className="space-y-2" key={field.key}>
            <Label htmlFor="leadId">Lead *</Label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Search leads..."
                className="mb-2 focus:shadow-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Select
                value={formData.leadId || ''}
                onValueChange={(value) => handleSelectChange('leadId', value)}
                required
              >
                <SelectTrigger className="focus:shadow-none">
                  <SelectValue placeholder="Select lead" />
                </SelectTrigger>
                <SelectContent>
                  {filteredLeads.length > 0 ? (
                    filteredLeads.map(lead => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.first_name} {lead.last_name} ({lead.Email_ID})
                      </SelectItem>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground px-2 py-1.5">
                      No leads found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 'agentId':
        return (
          <div className="space-y-2" key={field.key}>
            <Label htmlFor="agentId">Agent *</Label>
            <Select
              value={formData.agentId || ''}
              onValueChange={(value) => handleSelectChange('agentId', value)}
              required
              disabled={isAgent && !deal}
            >
              <SelectTrigger className="focus:shadow-none">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {decryptedAgents.filter(a => a.status === 'active').length > 0 ? (
                  decryptedAgents.filter(a => a.status === 'active').map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground px-2 py-1.5">
                    No active agents found
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        );
      case 'status':
        return (
          <div className="space-y-2" key={field.key}>
            <Label htmlFor="status">Status *</Label>
            <Select
              value={formData.status || 'proposal'}
              onValueChange={(value) => handleSelectChange('status', value)}
              required
            >
              <SelectTrigger className="focus:shadow-none">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="closed_won">Closed Won</SelectItem>
                <SelectItem value="closed_lost">Closed Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
            <DialogTitle>{deal ? 'Edit Deal' : 'Add New Deal'}</DialogTitle>
          </DialogHeader>

          {isDecrypting ? (
            <div className="flex justify-center items-center h-32">
              Loading deal data...
            </div>
          ) : isFieldSelectionOpen ? (
            <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-1 py-2 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {deal ? 'Select fields to quickly edit:' : 'Select fields to include in the new deal form:'}
              </p>
              <div className="grid grid-cols-2 gap-y-2">
                {allCoreFormFields.map((field) => (
                  <div key={field.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`field-select-${field.key}`}
                      checked={selectedFormFields.includes(field.key)}
                      onCheckedChange={(checked) => handleFieldCheckboxChange(field.key, checked as boolean)}
                      disabled={!deal && field.required && (formData[field.key] === undefined || formData[field.key] === null || String(formData[field.key]).trim() === '')}
                    />
                    <Label htmlFor={`field-select-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
                  </div>
                ))}
                {dynamicCustomFields.map((field) => (
                  <div key={field.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`field-select-${field.key}`}
                      checked={selectedFormFields.includes(field.key)}
                      onCheckedChange={(checked) => handleFieldCheckboxChange(field.key, checked as boolean)}
                    />
                    <Label htmlFor={`field-select-${field.key}`}>{field.label}</Label>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-4 border-t mt-4">
                <Label htmlFor="custom-field-name">Add Custom Field</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-field-name"
                    type="text"
                    placeholder="e.g., Project Scope, Client Ref"
                    className="flex-grow"
                    value={customFieldName}
                    onChange={(e) => setCustomFieldName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomField();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleAddCustomField}
                    disabled={!customFieldName.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-1 py-2">
              <form onSubmit={handleSubmit} className="space-y-4" id="deal-form">
                {[...allCoreFormFields, ...dynamicCustomFields]
                  .filter(field => selectedFormFields.includes(field.key))
                  .map(field => renderField(field))}
              </form>
            </div>
          )}

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <div className="flex flex-wrap gap-2 w-full justify-between">
              <div className="flex gap-2">
                {!isFieldSelectionOpen && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowDocumentModal(true)}
                    >
                      Add Document
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (formData.documents?.length) {
                          setSelectedDocument(formData.documents[0].id);
                          setShowSignatureModal(true);
                        } else {
                          toast.error('Please add a document first');
                        }
                      }}
                    >
                      Request Signature
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsFieldSelectionOpen(true)}
                    >
                      {deal ? 'Customize Edit Fields' : 'Customize New Deal Form'}
                    </Button>
                  </>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (isFieldSelectionOpen) {
                      setIsFieldSelectionOpen(false);
                    } else {
                      onClose();
                    }
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  form="deal-form"
                  disabled={isLoading || (isFieldSelectionOpen && selectedFormFields.length === 0)}
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {deal ? 'Updating...' : 'Creating...'}
                    </span>
                  ) : (
                    isFieldSelectionOpen ? 'Continue' : (deal ? 'Update Deal' : 'Add Deal')
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentAutomationModal
        isOpen={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
        onAddDocument={handleAddDocument}
        dealData={{
          name: formData.name,
          company: formData.company,
          amount: formData.amount,
          description: formData.description,
          agentName: formData.agentName,
          closingDate: formData.closingDate
        }}
      />

      <ESignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onAddSignature={handleAddSignature}
        documentId={selectedDocument}
        dealData={formData}
      />
    </>
  );
};