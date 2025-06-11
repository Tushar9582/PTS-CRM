import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { database } from '../../firebase';
import { ref, push, set, update } from 'firebase/database';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface LeadDetails {
  id?: string;
  RA?: string;
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
  Requirement?: string;
  createdAt?: string;
}

interface LeadDetailsFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lead: LeadDetails) => void;
  lead?: LeadDetails;
}

export const LeadForm: React.FC<LeadDetailsFormProps> = ({ isOpen, onClose, onSubmit, lead }) => {
  const currentUser = localStorage.getItem('adminkey');
  const [formData, setFormData] = useState<LeadDetails>({
    RA: '',
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
    Requirement: '',
    createdAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Initialize form with lead data when editing
  useEffect(() => {
    if (lead) {
      setFormData({
        ...lead,
      });
    } else {
      // Reset form when adding new lead
      setFormData({
        RA: '',
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
        Requirement: '',
        createdAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      });
    }
  }, [lead]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
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
  
    setIsSubmitting(true);
    setError('');
  
    try {
      // Prepare the data to be saved
      const leadData = {
        ...formData,
        // If it's a new lead, set createdAt
        ...(!lead?.id && { createdAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss') })
      };
  
      // Reference to the admin's leads in Firebase
      const adminLeadsRef = ref(database, `users/${currentUser}/leads`);
      
      if (lead?.id) {
        // Update existing lead
        const leadRef = ref(database, `users/${currentUser}/leads/${lead.id}`);
        await update(leadRef, leadData);
        toast.success('Lead updated successfully!');
      } else {
        // Create new lead with push key
        const newLeadRef = push(adminLeadsRef);
        await set(newLeadRef, leadData);
        toast.success('Lead created successfully!');
      }
  
      // Call the onSubmit prop with the form data
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
                <Label htmlFor="RA">RA</Label>
                <Input
                  id="RA"
                  name="RA"
                  className="neuro-inset focus:shadow-none"
                  value={formData.RA}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
            
            <div className="space-y-2">
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
            </div>
            
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
                />
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
                />
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
              />
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
            
            <div className="space-y-2">
              <Label htmlFor="Website">Website</Label>
              <Input
                id="Website"
                name="Website"
                type="url"
                className="neuro-inset focus:shadow-none"
                value={formData.Website}
                onChange={handleChange}
                disabled={isSubmitting}
              />
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
            
            <div className="space-y-2">
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
            </div>
            
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