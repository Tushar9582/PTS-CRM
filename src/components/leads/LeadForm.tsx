import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { database } from '../../firebase';
import { ref, push, set, update, get } from 'firebase/database';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

// Encryption key - in a real app, this should be securely managed
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8'; // 32 chars for AES-256

interface LeadDetails {
  id?: string;
  Name?: string;
  Date?: string;
  Meeting_Date?: string;
  Meeting_Time?: string;
  Meeting_Status?: string;
  linkedin_url?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  Industry?: string;
  Employee_Size?: string;
  job_title?: string;
  Email_ID?: string;
  Mobile_Number?: string;
  Linkedin_R?: string;
  Email_R?: string;
  Mobile_R?: string;
  Whatsapp_R?: string;
  Comment?: string;
  RPC_link?: string;
  Meeting_Takeaway?: string;
  Website?: string;
  Website_Exists?: string;
  Requirement?: string;
  createdAt?: string;
  updatedAt?: string;
  score?: number;
}

interface LeadDetailsFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lead: LeadDetails) => void;
  lead?: LeadDetails;
}

interface AgentDetails {
  id: string;
  email: string;
  name: string;
  ipAddress: string;
}

interface ChangeLog {
  field: string;
  oldValue: any;
  newValue: any;
  changedAt: string;
}

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

// Function to encrypt lead values
async function encryptLead(lead: LeadDetails): Promise<LeadDetails> {
  const encryptedLead = { ...lead };
  
  // Encrypt each field that needs encryption
  encryptedLead.Name = await encryptData(lead.Name || '');
  encryptedLead.linkedin_url = await encryptData(lead.linkedin_url || '');
  encryptedLead.first_name = await encryptData(lead.first_name || '');
  encryptedLead.last_name = await encryptData(lead.last_name || '');
  encryptedLead.company = await encryptData(lead.company || '');
  encryptedLead.Industry = await encryptData(lead.Industry || '');
  encryptedLead.job_title = await encryptData(lead.job_title || '');
  encryptedLead.Email_ID = await encryptData(lead.Email_ID || '');
  encryptedLead.Mobile_Number = await encryptData(lead.Mobile_Number || '');
  encryptedLead.Website = await encryptData(lead.Website || '');
  encryptedLead.RPC_link = await encryptData(lead.RPC_link || '');
  encryptedLead.Requirement = await encryptData(lead.Requirement || '');
  encryptedLead.Meeting_Takeaway = await encryptData(lead.Meeting_Takeaway || '');
  encryptedLead.Comment = await encryptData(lead.Comment || '');
  
  return encryptedLead;
}

// Function to decrypt lead values
async function decryptLead(lead: LeadDetails): Promise<LeadDetails> {
  const decryptedLead = { ...lead };
  
  // Decrypt each encrypted field
  decryptedLead.Name = await decryptData(lead.Name || '');
  decryptedLead.linkedin_url = await decryptData(lead.linkedin_url || '');
  decryptedLead.first_name = await decryptData(lead.first_name || '');
  decryptedLead.last_name = await decryptData(lead.last_name || '');
  decryptedLead.company = await decryptData(lead.company || '');
  decryptedLead.Industry = await decryptData(lead.Industry || '');
  decryptedLead.job_title = await decryptData(lead.job_title || '');
  decryptedLead.Email_ID = await decryptData(lead.Email_ID || '');
  decryptedLead.Mobile_Number = await decryptData(lead.Mobile_Number || '');
  decryptedLead.Website = await decryptData(lead.Website || '');
  decryptedLead.RPC_link = await decryptData(lead.RPC_link || '');
  decryptedLead.Requirement = await decryptData(lead.Requirement || '');
  decryptedLead.Meeting_Takeaway = await decryptData(lead.Meeting_Takeaway || '');
  decryptedLead.Comment = await decryptData(lead.Comment || '');
  
  return decryptedLead;
}

const LEAD_SCORING_CONFIG = {
  // Base scores
  baseScores: {
    email: 5,
    phone: 10,
    meeting: 20,
    linkedin: 15,
    website: 5,
  },
  
  // Engagement multipliers
  engagement: {
    emailOpened: 2,
    linkClicked: 3,
    meetingAttended: 5,
    responseReceived: 4,
  },
  
  // Status weights
  statusWeights: {
    new: 1,
    contacted: 1.2,
    qualified: 1.5,
    proposal: 1.8,
    negotiation: 2,
    closed: 0.5,
  },
  
  // Industry weights
  industryWeights: {
    'Technology': 1.5,
    'Finance': 1.3,
    'Healthcare': 1.2,
    'Manufacturing': 1.1,
    'Retail': 1.0,
    'Education': 0.9,
  },
  
  // Company size weights
  companySizeWeights: {
    '1-10': 1,
    '11-50': 1.2,
    '51-200': 1.5,
    '201-500': 1.8,
    '501-1000': 2,
    '1001-5000': 2.2,
    '5001-10000': 2.5,
    '10000+': 3,
  }
};

const calculateLeadScore = (lead: LeadDetails): number => {
  let score = 0;
  
  // Base scores for contact methods
  if (lead.Email_ID) score += LEAD_SCORING_CONFIG.baseScores.email;
  if (lead.Mobile_Number) score += LEAD_SCORING_CONFIG.baseScores.phone;
  if (lead.linkedin_url) score += LEAD_SCORING_CONFIG.baseScores.linkedin;
  if (lead.Website) score += LEAD_SCORING_CONFIG.baseScores.website;
  
  // Meeting status weights
  if (lead.Meeting_Status) {
    const statusWeight = LEAD_SCORING_CONFIG.statusWeights[lead.Meeting_Status as keyof typeof LEAD_SCORING_CONFIG.statusWeights] || 1;
    score *= statusWeight;
  }
  
  // Industry weights
  if (lead.Industry) {
    const industryWeight = LEAD_SCORING_CONFIG.industryWeights[lead.Industry as keyof typeof LEAD_SCORING_CONFIG.industryWeights] || 1;
    score *= industryWeight;
  }
  
  // Company size weights
  if (lead.Employee_Size) {
    const sizeWeight = LEAD_SCORING_CONFIG.companySizeWeights[lead.Employee_Size as keyof typeof LEAD_SCORING_CONFIG.companySizeWeights] || 1;
    score *= sizeWeight;
  }
  
  return Math.round(score);
};

export const LeadForm: React.FC<LeadDetailsFormProps> = ({ isOpen, onClose, onSubmit, lead }) => {
  const currentUser = localStorage.getItem('adminkey');
  const [formData, setFormData] = useState<LeadDetails>({
    Name: '',
    Date: format(new Date(), 'yyyy-MM-dd'),
    Meeting_Date: '',
    Meeting_Time: '',
    Meeting_Status: '',
    linkedin_url: '',
    first_name: '',
    last_name: '',
    company: '',
    Industry: '',
    Employee_Size: '',
    job_title: '',
    Email_ID: '',
    Mobile_Number: '',
    Linkedin_R: '',
    Email_R: '',
    Mobile_R: '',
    Whatsapp_R: '',
    Comment: '',
    RPC_link: '',
    Meeting_Takeaway: '',
    Website: '',
    Website_Exists: '',
    Requirement: '',
    createdAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    updatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Initialize form with lead data when editing
  useEffect(() => {
    const initializeForm = async () => {
      if (lead) {
        setIsLoading(true);
        try {
          const decryptedLead = await decryptLead(lead);
          setFormData({
            ...decryptedLead,
            updatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
          });
        } catch (error) {
          console.error('Decryption failed:', error);
          setFormData({
            ...lead,
            updatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
          });
        } finally {
          setIsLoading(false);
        }
      } else {
        // Reset form when adding new lead
        setFormData({
          Name: '',
          Date: format(new Date(), 'yyyy-MM-dd'),
          Meeting_Date: '',
          Meeting_Time: '',
          Meeting_Status: '',
          linkedin_url: '',
          first_name: '',
          last_name: '',
          company: '',
          Industry: '',
          Employee_Size: '',
          job_title: '',
          Email_ID: '',
          Mobile_Number: '',
          Linkedin_R: '',
          Email_R: '',
          Mobile_R: '',
          Whatsapp_R: '',
          Comment: '',
          RPC_link: '',
          Meeting_Takeaway: '',
          Website: '',
          Website_Exists: '',
          Requirement: '',
          createdAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
          updatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        });
      }
    };

    initializeForm();
  }, [lead]);

  // Validation functions
  const validateRA = (value: string) => {
    if (!/^[a-zA-Z0-9]+$/.test(value)) {
      return "RA should contain only letters and numbers";
    }
    return "";
  };

  const validateName = (value: string, fieldName: string) => {
    if (!/^[a-zA-Z]+$/.test(value)) {
      return `${fieldName} should contain only letters and no spaces`;
    }
    return "";
  };

  const validateLinkedInUrl = (value: string) => {
    if (value && !value.includes('linkedin.com/')) {
      return "Please enter a valid LinkedIn URL";
    }
    return "";
  };

  const validateEmployeeSize = (value: string) => {
    if (value && !/^[0-9-]+$/.test(value)) {
      return "Employee size should contain only numbers and hyphens";
    }
    return "";
  };

  const validateMobileNumber = (value: string) => {
    if (value && !/^[0-9]{10}$/.test(value)) {
      return "Mobile number must be exactly 10 digits";
    }
    return "";
  };

  const validateWebsite = (value: string) => {
    if (value && !/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(value)) {
      return "Please enter a valid website URL";
    }
    return "";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Validate input based on field type
    let errorMsg = "";
    
    switch (name) {
      case "Name":
        errorMsg = validateRA(value);
        break;
      case "first_name":
        errorMsg = validateName(value, "First name");
        break;
      case "last_name":
        errorMsg = validateName(value, "Last name");
        break;
      case "linkedin_url":
        errorMsg = validateLinkedInUrl(value);
        break;
      case "Employee_Size":
        errorMsg = validateEmployeeSize(value);
        break;
      case "Mobile_Number":
        errorMsg = validateMobileNumber(value);
        break;
      case "Website":
        errorMsg = validateWebsite(value);
        break;
    }
    
    // Update field errors
    setFieldErrors(prev => ({
      ...prev,
      [name]: errorMsg
    }));
    
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (field: keyof LeadDetails, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('User not authenticated');
      return;
    }

    // Validate all fields before submission
    const errors: Record<string, string> = {};
    
    errors.Name = validateRA(formData.Name || '');
    errors.first_name = validateName(formData.first_name || '', 'First name');
    errors.last_name = validateName(formData.last_name || '', 'Last name');
    errors.linkedin_url = validateLinkedInUrl(formData.linkedin_url || '');
    errors.Employee_Size = validateEmployeeSize(formData.Employee_Size || '');
    errors.Mobile_Number = validateMobileNumber(formData.Mobile_Number || '');
    errors.Website = validateWebsite(formData.Website || '');
    
    setFieldErrors(errors);
    
    // Check if there are any validation errors
    const hasErrors = Object.values(errors).some(error => error !== "");
    if (hasErrors) {
      setError('Please fix the validation errors before submitting');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Get agent details
      const agentDetails: AgentDetails = {
        id: localStorage.getItem('agentId') || 'unknown',
        email: localStorage.getItem('agentEmail') || 'unknown@example.com',
        name: localStorage.getItem('agentName') || 'Unknown Agent',
        ipAddress: localStorage.getItem('ipAddress') || 'unknown'
      };

      // Encrypt the lead data before saving
      const encryptedLead = await encryptLead(formData);
      
      // Calculate lead score
      const score = calculateLeadScore(formData);
      
      // Prepare the data to be saved
      const timestamp = new Date().toISOString();
      const leadData = {
        ...encryptedLead,
        score,
        updatedAt: timestamp,
        // If it's a new lead, set createdAt
        ...(!lead?.id && { createdAt: timestamp })
      };

      // Reference to the admin's leads in Firebase
      const adminLeadsRef = ref(database, `users/${currentUser}/leads`);
      
      if (lead?.id) {
        // For updates - track changes
        const leadRef = ref(database, `users/${currentUser}/leads/${lead.id}`);
        const leadSnapshot = await get(leadRef);
        const existingLead = leadSnapshot.val();

        // Identify changes
        const changes: ChangeLog[] = [];
        Object.keys(leadData).forEach(key => {
          if (JSON.stringify(leadData[key]) !== JSON.stringify(existingLead[key])) {
            changes.push({
              field: key,
              oldValue: existingLead[key] ?? 'empty',
              newValue: leadData[key] ?? 'empty',
              changedAt: timestamp
            });
          }
        });

        // Update lead
        await update(leadRef, leadData);

        // Log activity if changes exist
        if (changes.length > 0) {
          const activityData = {
            action: "lead_update",
            leadId: lead.id,
            leadDetails: {
              name: `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || 'N/A',
              company: formData.company || 'N/A',
              email: formData.Email_ID || 'N/A',
              phone: formData.Mobile_Number || 'N/A'
            },
            agentDetails: agentDetails,
            changes: changes.reduce((acc, change) => ({
              ...acc,
              [change.field]: {
                old: change.oldValue,
                new: change.newValue,
                fieldName: formatFieldName(change.field),
                changedAt: change.changedAt
              }
            }), {}),
            timestamp: timestamp,
            environment: {
              device: navigator.userAgent,
              location: window.location.href
            }
          };

          const activityRef = ref(database, `users/${currentUser}/agentactivity`);
          await push(activityRef, activityData);
        }

        toast.success('Lead updated successfully!');
      } else {
        // For new leads
        const newLeadRef = push(adminLeadsRef);
        const newLeadId = newLeadRef.key;
        await set(newLeadRef, leadData);

        // Log creation activity
        const activityData = {
          action: "lead_creation",
          leadId: newLeadId,
          leadDetails: {
            name: `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || 'N/A',
            company: formData.company || 'N/A',
            email: formData.Email_ID || 'N/A',
            phone: formData.Mobile_Number || 'N/A'
          },
          agentDetails: agentDetails,
          timestamp: timestamp,
          environment: {
            device: navigator.userAgent,
            location: window.location.href
          }
        };

        const activityRef = ref(database, `users/${currentUser}/agentactivity`);
        await push(activityRef, activityData);

        toast.success('Lead created successfully!');
      }

      onSubmit(formData);
      onClose();
    } catch (err) {
      console.error('Error saving lead:', err);
      setError('Failed to save lead. Please try again.');
      toast.error('Failed to save lead. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  function formatFieldName(field: string): string {
    return field.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-4xl h-[90vh] flex flex-col neuro border-none">
          <DialogHeader className="px-6 pt-6 pb-0 flex-none">
            <DialogTitle>{lead ? 'Edit Lead Details' : 'Add New Lead Details'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center">
            <p>Loading lead data...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-4xl h-[90vh] flex flex-col neuro border-none">
        <DialogHeader className="px-6 pt-6 pb-0 flex-none">
          <DialogTitle>{lead ? 'Edit Lead Details' : 'Add New Lead Details'}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-md">
                {error}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="Name">Name</Label>
                <Input
                  id="Name"
                  name="Name"
                  className="neuro-inset focus:shadow-none"
                  value={formData.Name}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {fieldErrors.Name && <p className="text-red-500 text-xs">{fieldErrors.Name}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="Date">Date</Label>
                <Input
                  id="Date"
                  name="Date"
                  type="date"
                  className="neuro-inset focus:shadow-none"
                  value={formData.Date}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
            </div>
            
            {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="Meeting_Date">Meeting Date</Label>
                <Input
                  id="Meeting_Date"
                  name="Meeting_Date"
                  type="date"
                  className="neuro-inset focus:shadow-none"
                  value={formData.Meeting_Date}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="Meeting_Time">Meeting Time</Label>
                <Input
                  id="Meeting_Time"
                  name="Meeting_Time"
                  type="time"
                  className="neuro-inset focus:shadow-none"
                  value={formData.Meeting_Time}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
            </div> */}
            
            {/* <div className="space-y-2">
              <Label htmlFor="Meeting_Status">Meeting Status</Label>
              <Select 
                value={formData.Meeting_Status || ''}
                onValueChange={(value) => handleSelectChange('Meeting_Status', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="neuro-inset focus:shadow-none">
                  <SelectValue placeholder="Select meeting status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                  <SelectItem value="Rescheduled">Rescheduled</SelectItem>
                </SelectContent>
              </Select>
            </div> */}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  className="neuro-inset focus:shadow-none"
                  value={formData.first_name}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {fieldErrors.first_name && <p className="text-red-500 text-xs">{fieldErrors.first_name}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  className="neuro-inset focus:shadow-none"
                  value={formData.last_name}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {fieldErrors.last_name && <p className="text-red-500 text-xs">{fieldErrors.last_name}</p>}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  name="company"
                  className="neuro-inset focus:shadow-none"
                  value={formData.company}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="Industry">Industry</Label>
                <Input
                  id="Industry"
                  name="Industry"
                  className="neuro-inset focus:shadow-none"
                  value={formData.Industry}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title</Label>
                <Input
                  id="job_title"
                  name="job_title"
                  className="neuro-inset focus:shadow-none"
                  value={formData.job_title}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="Employee_Size">Employee Size</Label>
                <Input
                  id="Employee_Size"
                  name="Employee_Size"
                  className="neuro-inset focus:shadow-none"
                  value={formData.Employee_Size}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  placeholder="e.g., 1-10, 11-50, etc."
                />
                {fieldErrors.Employee_Size && <p className="text-red-500 text-xs">{fieldErrors.Employee_Size}</p>}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="Email_ID">Email</Label>
                <Input
                  id="Email_ID"
                  name="Email_ID"
                  type="email"
                  className="neuro-inset focus:shadow-none"
                  value={formData.Email_ID}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="Mobile_Number">Mobile Number</Label>
                <Input
                  id="Mobile_Number"
                  name="Mobile_Number"
                  type="tel"
                  className="neuro-inset focus:shadow-none"
                  value={formData.Mobile_Number}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  maxLength={10}
                  placeholder="10-digit number"
                />
                {fieldErrors.Mobile_Number && <p className="text-red-500 text-xs">{fieldErrors.Mobile_Number}</p>}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                name="linkedin_url"
                type="url"
                className="neuro-inset focus:shadow-none"
                value={formData.linkedin_url}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="https://linkedin.com/in/username"
              />
              {fieldErrors.linkedin_url && <p className="text-red-500 text-xs">{fieldErrors.linkedin_url}</p>}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="Linkedin_R">LinkedIn Response</Label>
                <Select 
                  value={formData.Linkedin_R || ''}
                  onValueChange={(value) => handleSelectChange('Linkedin_R', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="neuro-inset focus:shadow-none">
                    <SelectValue placeholder="Select response" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Positive">Positive</SelectItem>
                    <SelectItem value="Negative">Negative</SelectItem>
                    <SelectItem value="No Response">No Response</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="Email_R">Email Response</Label>
                <Select 
                  value={formData.Email_R || ''}
                  onValueChange={(value) => handleSelectChange('Email_R', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="neuro-inset focus:shadow-none">
                    <SelectValue placeholder="Select response" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Positive">Positive</SelectItem>
                    <SelectItem value="Negative">Negative</SelectItem>
                    <SelectItem value="No Response">No Response</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="Mobile_R">Mobile Response</Label>
                <Select 
                  value={formData.Mobile_R || ''}
                  onValueChange={(value) => handleSelectChange('Mobile_R', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="neuro-inset focus:shadow-none">
                    <SelectValue placeholder="Select response" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Positive">Positive</SelectItem>
                    <SelectItem value="Negative">Negative</SelectItem>
                    <SelectItem value="No Response">No Response</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="Whatsapp_R">WhatsApp Response</Label>
                <Select 
                  value={formData.Whatsapp_R || ''}
                  onValueChange={(value) => handleSelectChange('Whatsapp_R', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="neuro-inset focus:shadow-none">
                    <SelectValue placeholder="Select response" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Positive">Positive</SelectItem>
                    <SelectItem value="Negative">Negative</SelectItem>
                    <SelectItem value="No Response">No Response</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="Website_Exists">Website Exists</Label>
                <Select 
                  value={formData.Website_Exists || ''}
                  onValueChange={(value) => handleSelectChange('Website_Exists', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="neuro-inset focus:shadow-none">
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* <div className="space-y-2">
                <Label htmlFor="Website">Website URL</Label>
                <Input
                  id="Website"
                  name="Website"
                  type="url"
                  className="neuro-inset focus:shadow-none"
                  value={formData.Website}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  placeholder="https://example.com"
                />
                {fieldErrors.Website && <p className="text-red-500 text-xs">{fieldErrors.Website}</p>}
              </div>*/}
            </div> 
            
            <div className="space-y-2">
              <Label htmlFor="RPC_link">RPC Link</Label>
              <Input
                id="RPC_link"
                name="RPC_link"
                type="url"
                className="neuro-inset focus:shadow-none"
                value={formData.RPC_link}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="Requirement">Requirement</Label>
              <Textarea
                id="Requirement"
                name="Requirement"
                className="neuro-inset focus:shadow-none"
                rows={2}
                value={formData.Requirement}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
            
            {/* <div className="space-y-2">
              <Label htmlFor="Meeting_Takeaway">Meeting Takeaway</Label>
              <Textarea
                id="Meeting_Takeaway"
                name="Meeting_Takeaway"
                className="neuro-inset focus:shadow-none"
                rows={2}
                value={formData.Meeting_Takeaway}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div> */}
            
            <div className="space-y-2">
              <Label htmlFor="Comment">Comment</Label>
              <Textarea
                id="Comment"
                name="Comment"
                className="neuro-inset focus:shadow-none"
                rows={3}
                value={formData.Comment}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>
          </form>
        </div>
        
        <DialogFooter className="px-6 pb-6 pt-4 flex-none border-t">
          <Button 
            type="button"
            variant="outline"
            onClick={onClose}
            className="neuro hover:shadow-none transition-all duration-300"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            className="neuro hover:shadow-none transition-all duration-300"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {lead ? 'Updating...' : 'Creating...'}
              </span>
            ) : lead ? 'Update Lead' : 'Add Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};