import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, Mail, MessageSquare, Edit, Trash2, X, CalendarIcon, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface LeadDetailsProps {
  lead: {
    id: string;
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
    updatedAt?: string;
  };
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSchedule?: () => void;
  isMobile?: boolean;
}

export const LeadDetails: React.FC<LeadDetailsProps> = ({ 
  lead, 
  onClose, 
  onEdit, 
  onDelete,
  onSchedule,
  isMobile = false 
}) => {
  const handleAction = (type: string) => {
    switch (type) {
      case 'call':
        if (lead.Mobile_Number) {
          window.open(`tel:${lead.Mobile_Number}`, '_blank');
        } else {
          toast.warning('No phone number available');
        }
        break;
      case 'email':
        if (lead.Email_ID) {
          window.open(`mailto:${lead.Email_ID}`, '_blank');
        } else {
          toast.warning('No email address available');
        }
        break;
      case 'whatsapp':
        if (lead.Mobile_Number) {
          window.open(`https://wa.me/${lead.Mobile_Number.replace(/\D/g, '')}`, '_blank');
        } else {
          toast.warning('No phone number available for WhatsApp');
        }
        break;
      case 'linkedin':
        if (lead.linkedin_url) {
          window.open(lead.linkedin_url, '_blank');
        } else {
          toast.warning('No LinkedIn URL available');
        }
        break;
      case 'website':
        if (lead.Website) {
          window.open(lead.Website.startsWith('http') ? lead.Website : `https://${lead.Website}`, '_blank');
        } else {
          toast.warning('No website available');
        }
        break;
      default:
        break;
    }
  };

  const formatField = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    return value;
  };

  const formatLabel = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
  };

  const getLeadProperty = (key: string) => {
    if (lead.hasOwnProperty(key)) {
      return lead[key as keyof typeof lead];
    }
    
    const underscoredKey = key.replace(/ /g, '_');
    if (lead.hasOwnProperty(underscoredKey)) {
      return lead[underscoredKey as keyof typeof lead];
    }
    
    const spacedKey = key.replace(/_/g, ' ');
    if (lead.hasOwnProperty(spacedKey)) {
      return lead[spacedKey as keyof typeof lead];
    }
    
    return undefined;
  };

  const renderField = (label: string, key: string, fullWidth = false) => {
    const value = getLeadProperty(key);
    return (
      <div className={fullWidth ? 'col-span-2' : ''}>
        <p className="text-sm font-medium text-muted-foreground mb-1">{formatLabel(label)}</p>
        <p className={`text-sm ${key.includes('link') || key.includes('url') || key.includes('ID') ? 'break-all' : ''}`}>
          {formatField(value)}
        </p>
      </div>
    );
  };

  return (
    <Dialog open={!!lead} onOpenChange={onClose}>
      <DialogContent className={`neuro border-none ${isMobile ? 'h-[90vh] w-[95vw]' : 'w-[85vw] h-[85vh] max-w-6xl'}`}>
        <DialogHeader className="relative">
          <DialogTitle className="text-lg md:text-xl font-semibold">
            Lead Details
          </DialogTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-2 top-2"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'flex flex-col gap-4' : 'flex gap-6'}`}>
          {/* Personal Info - Always first on mobile */}
          <div className={`${isMobile ? 'w-full' : 'w-1/3'}`}>
            <div className="bg-muted/20 p-3 rounded-lg mb-3">
              <h3 className="text-base font-bold">{formatField(lead.first_name)} {formatField(lead.last_name)}</h3>
              {lead.company && <p className="text-muted-foreground text-sm">{formatField(lead.company)}</p>}
              {lead.job_title && <p className="text-muted-foreground text-xs">{formatField(lead.job_title)}</p>}
            </div>
            
            {/* Quick Actions - Moved up on mobile */}
            {isMobile && (
              <div className="bg-muted/10 p-3 rounded-lg mb-3">
                <h4 className="font-medium text-sm mb-2">Quick Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleAction('call')}
                    disabled={!lead.Mobile_Number}
                    className="h-8 text-xs"
                  >
                    <Phone className="h-3 w-3 mr-1" /> Call
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleAction('email')}
                    disabled={!lead.Email_ID}
                    className="h-8 text-xs"
                  >
                    <Mail className="h-3 w-3 mr-1" /> Email
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleAction('whatsapp')}
                    disabled={!lead.Mobile_Number}
                    className="h-8 text-xs"
                  >
                    <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleAction('linkedin')}
                    disabled={!lead.linkedin_url}
                    className="h-8 text-xs"
                  >
                    <Link2 className="h-3 w-3 mr-1" /> LinkedIn
                  </Button>
                  {lead.Website && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('website')}
                      className="h-8 col-span-2 text-xs"
                    >
                      <Link2 className="h-3 w-3 mr-1" /> Visit Website
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            <div className="bg-muted/10 p-3 rounded-lg mb-3">
              <h4 className="font-medium text-sm mb-2">Contact Info</h4>
              {renderField('Email', 'Email_ID')}
              {renderField('Phone', 'Mobile_Number')}
              {renderField('LinkedIn', 'linkedin_url')}
              {renderField('Website', 'Website')}
            </div>
            
            {!isMobile && (
              <div className="bg-muted/10 p-3 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Response Status</h4>
                <div className="grid grid-cols-2 gap-3">
                  {renderField('Email', 'Email_R')}
                  {renderField('Phone', 'Mobile_R')}
                  {renderField('WhatsApp', 'Whatsapp_R')}
                  {renderField('LinkedIn', 'Linkedin_R')}
                </div>
              </div>
            )}
          </div>
          
          {/* Professional Details - Second on mobile */}
          <div className={`${isMobile ? 'w-full' : 'w-1/3'}`}>
            <div className="bg-muted/10 p-3 rounded-lg mb-3">
              <h4 className="font-medium text-sm mb-2">Professional Info</h4>
              <div className="grid grid-cols-2 gap-3">
                {renderField('Industry', 'Industry')}
                {renderField('Company Size', 'Employee_Size')}
                {renderField('RA', 'RA')}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    lead.Meeting_Status === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                    lead.Meeting_Status === 'Completed' ? 'bg-green-100 text-green-800' :
                    lead.Meeting_Status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {formatField(lead.Meeting_Status)}
                  </span>
                </div>
              </div>
            </div>
            
            {lead.Meeting_Date && (
              <div className="bg-muted/10 p-3 rounded-lg mb-3">
                <h4 className="font-medium text-sm mb-2">Meeting</h4>
                <div className="grid grid-cols-2 gap-3">
                  {renderField('Date', 'Meeting_Date')}
                  {renderField('Time', 'Meeting_Time')}
                </div>
              </div>
            )}

{lead.Requirement && (
            <div className="bg-muted/10 p-3 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Requiement</h4>
            <div className="p-2 bg-muted/20 rounded-md text-sm h-20 overflow-y-auto">
              {formatField(lead.Requirement)}
            </div>
          </div>
            )}
            
            
            <div className="bg-muted/10 p-3 rounded-lg">
              <h4 className="font-medium text-sm mb-2">System</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Created</p>
                  <p className="text-xs">{lead.Date}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Updated</p>
                  <p className="text-xs">{lead.updatedAt ? format(new Date(lead.updatedAt), 'MMM d, yyyy') : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Additional Info - Last on mobile */}
          <div className={`${isMobile ? 'w-full' : 'w-1/3'}`}>
            {!isMobile && (
              <div className="bg-muted/10 p-3 rounded-lg mb-3">
                <h4 className="font-medium text-sm mb-2">Quick Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleAction('call')}
                    disabled={!lead.Mobile_Number}
                    className="h-8"
                  >
                    <Phone className="h-3 w-3 mr-1" /> Call
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleAction('email')}
                    disabled={!lead.Email_ID}
                    className="h-8"
                  >
                    <Mail className="h-3 w-3 mr-1" /> Email
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleAction('whatsapp')}
                    disabled={!lead.Mobile_Number}
                    className="h-8"
                  >
                    <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleAction('linkedin')}
                    disabled={!lead.linkedin_url}
                    className="h-8"
                  >
                    <Link2 className="h-3 w-3 mr-1" /> LinkedIn
                  </Button>
                  {lead.Website && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('website')}
                      className="h-8 col-span-2"
                    >
                      <Link2 className="h-3 w-3 mr-1" /> Visit Website
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            <div className="bg-muted/10 p-3 rounded-lg mb-3">
              {renderField('RPC Link', 'RPC_link', true)}
              {renderField('Requirement', 'Requirement', true)}
            </div>
            
            <div className="bg-muted/10 p-3 rounded-lg mb-3">
              <h4 className="font-medium text-sm mb-2">Comments</h4>
              <div className="p-2 bg-muted/20 rounded-md text-sm h-20 overflow-y-auto">
                {formatField(lead.Comment)}
              </div>
            </div>
            
            {lead.Meeting_Takeaway && (
              <div className="bg-muted/10 p-3 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Takeaways</h4>
                <div className="p-2 bg-muted/20 rounded-md text-sm h-20 overflow-y-auto">
                  {formatField(lead.Meeting_Takeaway)}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className={`flex ${isMobile ? 'flex-col gap-2' : 'justify-end gap-2'}`}>
          {onSchedule && (
            <Button 
              variant="outline" 
              onClick={() => {
                onClose();
                onSchedule();
              }}
              size={isMobile ? 'sm' : 'default'}
              className={isMobile ? 'w-full' : ''}
            >
              <CalendarIcon className="h-3 w-3 mr-1" /> Schedule
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => {
              onClose();
              onEdit();
            }}
            size={isMobile ? 'sm' : 'default'}
            className={isMobile ? 'w-full' : ''}
          >
            <Edit className="h-3 w-3 mr-1" /> Edit
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => {
              onDelete();
              onClose();
            }}
            size={isMobile ? 'sm' : 'default'}
            className={isMobile ? 'w-full' : ''}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};