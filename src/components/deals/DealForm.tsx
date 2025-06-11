import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { database } from '../../firebase';
import { ref, set, push, onValue, off } from 'firebase/database';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { decryptObject } from '@/lib/utils';

// Extending the Deal interface to allow for arbitrary string keys for custom fields
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
  company: string; // Ensure company is always a string
  description?: string;
  [key: string]: any; // Allow arbitrary string keys for custom fields
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
  onSubmit: (deal: Deal) => void;
  deal?: Deal | null;
  isLoading?: boolean;
}

// Define all available core fields for the form
const allCoreFormFields: { key: keyof Deal; label: string; type: 'text' | 'number' | 'date' | 'select' | 'textarea'; required: boolean; }[] = [
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
  onSubmit,
  deal,
  isLoading = false
}) => {
  const { user } = useAuth();
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const isAgent = !!agentId;

  const [formData, setFormData] = useState<Partial<Deal>>({});

  const [isFieldSelectionOpen, setIsFieldSelectionOpen] = useState(false);
  const [selectedFormFields, setSelectedFormFields] = useState<string[]>([]);
  const [customFieldName, setCustomFieldName] = useState('');
  const [dynamicCustomFields, setDynamicCustomFields] = useState<{ key: string; label: string; type: 'text'; required: boolean }[]>([]);

  // Effect to initialize formData, selectedFormFields, and dynamicCustomFields
  useEffect(() => {
    if (isOpen) {
      const initialFormData: Partial<Deal> = deal ? { ...deal } : {
        name: '',
        leadId: '',
        leadName: '',
        agentId: isAgent ? agentId : '',
        agentName: isAgent ? user?.displayName || '' : '',
        amount: 0,
        status: 'proposal',
        closingDate: '',
        company: '', // Initialize company as an empty string
        description: ''
      };

      setFormData(initialFormData);
      setSearchTerm('');
      setIsFieldSelectionOpen(false); // Always start on the main form view

      if (deal) {
        const coreFieldKeys = allCoreFormFields.map(f => f.key);

        const existingCustomFields = Object.keys(deal).filter(key =>
          !coreFieldKeys.includes(key as keyof Deal) &&
          !['id', 'createdAt'].includes(key)
        ).map(key => ({
          key: key,
          label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          type: 'text',
          required: false
        }));

        setDynamicCustomFields(existingCustomFields);
        // Ensure all existing deal fields (core + custom) are selected when editing
        setSelectedFormFields([...coreFieldKeys, ...existingCustomFields.map(f => f.key)]);

      } else {
        // When adding a new deal, default to all core fields selected
        setSelectedFormFields(allCoreFormFields.map(f => f.key));
        setDynamicCustomFields([]); // Clear custom fields when adding new
      }
    }
  }, [isOpen, deal, isAgent, agentId, user]);

  const allAvailableFormFields = [...allCoreFormFields, ...dynamicCustomFields];

  // Fetch leads from Firebase
  useEffect(() => {
    if (!isOpen) return; // Only fetch when dialog is open

    const currentUserId = adminId || agentId;
    if (!currentUserId) {
        // console.warn("No adminId or agentId found for fetching leads.");
        return;
    }

    const leadsRef = ref(database, `users/${currentUserId}/leads`);

    const fetchLeads = () => {
      onValue(leadsRef, async (snapshot) => {
        const leadsData: Lead[] = [];
        snapshot.forEach((childSnapshot) => {
          leadsData.push({
            id: childSnapshot.key || '',
            ...childSnapshot.val()
          });
        });
        try {
          const decryptedLeads = await Promise.all(
            leadsData.map(async (lead) => await decryptObject(lead))
          );
          setLeads(decryptedLeads);
        } catch (e) {
          console.error("Error decrypting leads:", e);
          toast.error("Failed to load leads due to decryption error.");
          setLeads([]); // Clear leads on error
        }
      }, (error) => {
        console.error("Firebase onValue error for leads:", error);
        toast.error("Failed to fetch leads from database.");
      });
    };

    fetchLeads();
    return () => { off(leadsRef); };
  }, [adminId, agentId, isOpen]);


  // Fetch agents from Firebase
  useEffect(() => {
    if (!adminId || !isOpen) return;

    const agentsRef = ref(database, `users/${adminId}/agents`);

    const fetchAgents = () => {
      onValue(agentsRef, (snapshot) => {
        const agentsData: Agent[] = [];
        snapshot.forEach((childSnapshot) => {
          agentsData.push({
            id: childSnapshot.key || '',
            ...childSnapshot.val()
          });
        });
        setAgents(agentsData);

        if (isAgent && !deal) {
          const currentAgent = agentsData.find(a => a.id === agentId);
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
    };

    fetchAgents();
    return () => { off(agentsRef); };
  }, [adminId, isOpen, isAgent, agentId, deal]);


  const filteredLeads = leads.filter(lead => {
    return (
      lead?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead?.Company?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // For number inputs, ensure it's a number, default to 0 if invalid
    const processedValue = (name === 'amount' && e.target.type === 'number') ? parseFloat(value) || 0 : value;

    setFormData(prevData => ({
      ...prevData,
      [name]: processedValue,
    }));
  }, []);

  const handleSelectChange = useCallback((field: string, value: string) => {
    let updatedData: Partial<Deal> = { ...formData, [field]: value };

    if (field === 'leadId') {
      const selectedLead = leads.find(lead => lead.id === value);
      if (selectedLead) {
        // Ensure Company is always a string, default to empty if null/undefined
        updatedData = {
          ...updatedData,
          company: selectedLead.Company || '',
          leadName: `${selectedLead.first_name} ${selectedLead.last_name}`
        };
      } else {
        // If selected lead is not found (e.g., deleted), clear related fields
        updatedData = {
          ...updatedData,
          company: '',
          leadName: ''
        };
        toast.error("Selected lead not found in list. Please re-select.");
      }
    }

    if (field === 'agentId') {
      const selectedAgent = agents.find(agent => agent.id === value);
      if (selectedAgent) {
        updatedData = {
          ...updatedData,
          agentName: selectedAgent.name
        };
      } else {
        // If selected agent is not found, clear related field
        updatedData = {
          ...updatedData,
          agentName: ''
        };
        toast.error("Selected agent not found in list. Please re-select.");
      }
    }
    setFormData(updatedData);
  }, [formData, leads, agents]);

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
      key: sanitizedKey as keyof Deal,
      label: customFieldName.trim(),
      type: 'text' as 'text',
      required: false
    };

    setDynamicCustomFields(prev => [...prev, newCustomField]);
    setSelectedFormFields(prev => [...prev, newCustomField.key]);
    setFormData(prev => ({ ...prev, [newCustomField.key]: '' })); // Initialize its value in formData
    setCustomFieldName('');
    toast.success(`Custom field "${newCustomField.label}" added.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetUserId = adminId;
    if (!targetUserId) {
      toast.error("Admin ID not found. Cannot save deal. Please ensure you are logged in as an admin.");
      return;
    }

    // --- Validation for selected and required fields ---
    const currentFormFieldsToValidate = allAvailableFormFields.filter(field =>
      selectedFormFields.includes(field.key) && field.required
    );

    for (const field of currentFormFieldsToValidate) {
      // Check for empty string, null, undefined. Allow 0 for number fields.
      if (field.type === 'number' ? (formData[field.key] === null || formData[field.key] === undefined) : (formData[field.key] === undefined || formData[field.key] === null || String(formData[field.key]).trim() === '')) {
        toast.error(`Please fill the required field: ${field.label}`);
        return;
      }
    }

    let dealDataToSave: Deal;

    if (deal) {
      // --- EDITING EXISTING DEAL ---
      const currentDealData: Deal = { ...deal }; // Start with existing deal to preserve all fields

      // Apply updates for selected core and custom fields
      allAvailableFormFields.forEach(field => {
        if (selectedFormFields.includes(field.key)) {
          // If the field is selected and exists in formData, update it
          if (Object.prototype.hasOwnProperty.call(formData, field.key)) {
            // Ensure values are not undefined; convert to null or empty string if necessary
            (currentDealData as any)[field.key] = formData[field.key] === undefined ? null : formData[field.key];
          }
        } else {
          // If a field was deselected, and it's not required, remove it from currentDealData
          const fieldDef = allAvailableFormFields.find(f => f.key === field.key);
          if (fieldDef && !fieldDef.required) {
            delete (currentDealData as any)[field.key];
          }
        }
      });

      dealDataToSave = currentDealData;

      // Ensure leadName, company, and agentName are up-to-date based on selected IDs
      const selectedLead = leads.find(l => l.id === dealDataToSave.leadId);
      if (selectedLead) {
        dealDataToSave.leadName = `${selectedLead.first_name} ${selectedLead.last_name}`;
        dealDataToSave.company = selectedLead.Company || ''; // Ensure company is string, not undefined/null
      } else {
        // Fallback or error if selected lead isn't found
        dealDataToSave.leadName = deal?.leadName || '';
        dealDataToSave.company = deal?.company || '';
        if (dealDataToSave.leadId && dealDataToSave.leadName === '') { // If an ID is set but no name resolved
            toast.warn("Could not find selected lead details. Using previous lead name/company.");
        }
      }

      const selectedAgent = agents.find(a => a.id === dealDataToSave.agentId);
      if (selectedAgent) {
        dealDataToSave.agentName = selectedAgent.name;
      } else {
        // Fallback or error if selected agent isn't found
        dealDataToSave.agentName = deal?.agentName || '';
        if (dealDataToSave.agentId && dealDataToSave.agentName === '') { // If an ID is set but no name resolved
            toast.warn("Could not find selected agent details. Using previous agent name.");
        }
      }

    } else {
      // --- CREATING NEW DEAL ---
      // Initialize with default/placeholder values, then fill from formData
      dealDataToSave = {
        id: '', // Will be assigned by Firebase push()
        name: formData.name || '',
        leadId: formData.leadId || '',
        leadName: '',
        agentId: formData.agentId || '',
        agentName: '',
        amount: formData.amount || 0,
        status: (formData.status as Deal['status']) || 'proposal',
        createdAt: format(new Date(), 'yyyy-MM-dd'),
        closingDate: formData.closingDate || '',
        company: '', // Initialize as empty string
        description: formData.description || '', // Default to empty string if undefined
      };

      // Crucially, resolve leadName, company, and agentName for new deals BEFORE adding other fields
      const selectedLead = leads.find(lead => lead.id === dealDataToSave.leadId);
      if (selectedLead) {
        dealDataToSave.leadName = `${selectedLead.first_name} ${selectedLead.last_name}`;
        dealDataToSave.company = selectedLead.Company || ''; // *** FIX: Ensure company is always a string ***
      } else {
        toast.error("Please select a valid Lead for the deal.");
        return;
      }

      const selectedAgent = agents.find(agent => agent.id === dealDataToSave.agentId);
      if (selectedAgent) {
        dealDataToSave.agentName = selectedAgent.name;
      } else {
        toast.error("Please select a valid Agent for the deal.");
        return;
      }

      // Add values for all currently selected custom fields
      // and ensure core fields (like company, description) are taken from formData if they were selected and filled
      allAvailableFormFields.forEach(field => {
          // Only apply if the field is selected and it's not one of the pre-handled critical fields
          if (selectedFormFields.includes(field.key)) {
              // Ensure value is not undefined; default to empty string or null if undefined
              const value = formData[field.key];
              (dealDataToSave as any)[field.key] = value === undefined ? null : value;

              // Special handling for company, description if they were defined at the top
              if (field.key === 'company' && formData.company !== undefined) {
                  dealDataToSave.company = formData.company || '';
              }
              if (field.key === 'description' && formData.description !== undefined) {
                  dealDataToSave.description = formData.description || '';
              }
          }
      });
    }

    console.log("Attempting to save deal. Final data:", dealDataToSave); // For debugging
    try {
      if (deal) {
        // Update existing deal
        const adminDealRef = ref(database, `users/${targetUserId}/deals/${deal.id}`);
        await set(adminDealRef, dealDataToSave); // Overwrite with the prepared dealDataToSave

        // Update in the assigned agent's deals list if agentId exists
        if (dealDataToSave.agentId) {
          const agentDealRef = ref(database, `users/${targetUserId}/agents/${dealDataToSave.agentId}/deals/${deal.id}`);
          await set(agentDealRef, dealDataToSave);
        }
        // If agentId was changed from a previous one, remove from old agent's list
        if (deal?.agentId && deal.agentId !== dealDataToSave.agentId) {
          const oldAgentDealRef = ref(database, `users/${targetUserId}/agents/${deal.agentId}/deals/${deal.id}`);
          await set(oldAgentDealRef, null); // Remove from old agent's list
        }

        toast.success('Deal updated successfully');
      } else {
        // Create new deal
        const adminDealsRef = ref(database, `users/${targetUserId}/deals`);
        const newDealRef = push(adminDealsRef); // This generates a unique ID
        const newDealId = newDealRef.key;

        if (!newDealId) {
            toast.error("Failed to generate new deal ID for admin.");
            return;
        }

        dealDataToSave.id = newDealId; // Assign the generated ID to the object

        await set(newDealRef, dealDataToSave); // Save the complete deal object with its new ID

        // Create in the assigned agent's deals list using the same ID
        if (dealDataToSave.agentId) {
          const agentDealsPath = `users/${targetUserId}/agents/${dealDataToSave.agentId}/deals`;
          const agentDealRef = ref(database, `${agentDealsPath}/${newDealId}`); // Use the SAME newDealId
          await set(agentDealRef, dealDataToSave); // Save the complete deal object under the agent's path
        }

        toast.success('Deal created successfully');
      }

      onSubmit(dealDataToSave);
      onClose();
    } catch (error: any) { // Catch as 'any' to access error.message
      console.error('Error saving deal:', error);
      toast.error(`Failed to save deal: ${error.message || 'Unknown error'}. Please check console for details.`);
    }
  };

  const renderField = (field: typeof allCoreFormFields[number] | typeof dynamicCustomFields[number]) => {
    if (!selectedFormFields.includes(field.key)) {
      return null;
    }

    const isCoreField = allCoreFormFields.some(f => f.key === field.key);

    if (!isCoreField) {
      // Render dynamic custom field
      return (
        <div className="space-y-2" key={field.key}>
          <Label htmlFor={field.key}>{field.label} {field.required ? '*' : ''}</Label>
          <Input
            id={field.key}
            name={field.key}
            type="text"
            className="neuro-inset focus:shadow-none"
            value={formData[field.key] || ''} // Ensure value is a string, default to ''
            onChange={handleChange}
            required={field.required}
          />
        </div>
      );
    }

    // Render core fields
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
              // For 'textarea' type in allCoreFormFields, map it to a 'text' input or use <textarea> if desired
              type={field.type === 'textarea' ? 'text' : field.type}
              className="neuro-inset focus:shadow-none"
              // Ensure amount renders '0' correctly, otherwise empty string for falsy values
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
                className="mb-2 neuro-inset focus:shadow-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Select
                value={formData.leadId || ''} // Ensure value is a string, default to ''
                onValueChange={(value) => handleSelectChange('leadId', value)}
                required
              >
                <SelectTrigger className="neuro-inset focus:shadow-none">
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
              value={formData.agentId || ''} // Ensure value is a string, default to ''
              onValueChange={(value) => handleSelectChange('agentId', value)}
              required
              disabled={isAgent && !deal}
            >
              <SelectTrigger className="neuro-inset focus:shadow-none">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.filter(a => a.status === 'active').length > 0 ? (
                  agents.filter(a => a.status === 'active').map(agent => (
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
              value={formData.status || 'proposal'} // Default to 'proposal' if not set
              onValueChange={(value) => handleSelectChange('status', value)}
              required
            >
              <SelectTrigger className="neuro-inset focus:shadow-none">
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden neuro border-none">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
          <DialogTitle>{deal ? 'Edit Deal' : 'Add New Deal'}</DialogTitle>
        </DialogHeader>

        {isFieldSelectionOpen ? (
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
                    // Disable core required fields if they are currently empty and it's a new deal
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
                  className="neuro-inset focus:shadow-none flex-grow"
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
                  className="neuro hover:shadow-none"
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
          {!isFieldSelectionOpen && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFieldSelectionOpen(true)}
              className="neuro hover:shadow-none transition-all duration-300"
            >
              {deal ? 'Customize Edit Fields' : 'Customize New Deal Form'}
            </Button>
          )}

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
            className="neuro hover:shadow-none transition-all duration-300"
            disabled={isLoading}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="deal-form"
            className="neuro hover:shadow-none transition-all duration-300"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};