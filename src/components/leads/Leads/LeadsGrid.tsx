import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Mail, MessageSquare, Edit, Trash2, RotateCw, CalendarIcon, ChevronRight } from 'lucide-react';
import { Lead } from './LeadsTable';

interface LeadsGridProps {
  currentLeads: Lead[];
  selectedLeads: string[];
  showBackupLeads: boolean;
  onSelectLead: (leadId: string) => void;
  onAction: (type: string, lead: Lead) => void;
  onViewLead: (lead: Lead) => void;
}

export const LeadsGrid: React.FC<LeadsGridProps> = ({
  currentLeads,
  selectedLeads,
  showBackupLeads,
  onSelectLead,
  onAction,
  onViewLead,
}) => {
  return (
    <div className="overflow-auto neuro">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left p-3 text-sm font-medium text-muted-foreground w-10">
              <Checkbox 
                checked={selectedLeads.length === currentLeads.length && currentLeads.length > 0}
                onCheckedChange={() => {
                  if (selectedLeads.length === currentLeads.length) {
                    onSelectLead(''); // Clear all
                  } else {
                    currentLeads.forEach(lead => onSelectLead(lead.id));
                  }
                }}
              />
            </th>
            <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
            <th className="text-left p-3 text-sm font-medium text-muted-foreground">Phone</th>
            <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
            <th className="text-left p-3 text-sm font-medium text-muted-foreground">Source</th>
            <th className="text-left p-3 text-sm font-medium text-muted-foreground">
              {showBackupLeads ? 'Deleted At' : 'Created'}
            </th>
            <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {currentLeads.map((lead) => (
            <tr 
              key={lead.id} 
              className="hover:bg-muted/20 cursor-pointer"
              onClick={() => onViewLead(lead)}
            >
              <td className="p-3" onClick={(e) => e.stopPropagation()}>
                <Checkbox 
                  checked={selectedLeads.includes(lead.id)}
                  onCheckedChange={() => onSelectLead(lead.id)}
                />
              </td>
              <td className="p-3">
                <div className="flex items-center">
                  <div>
                    <p className="font-medium">{lead.firstName} {lead.lastName}</p>
                    <p className="text-sm text-muted-foreground">{lead.email}</p>
                    {lead.scheduledCall && !showBackupLeads && (
                      <div className="flex items-center mt-1 text-xs text-blue-600">
                        <Clock className="h-3 w-3 mr-1" />
                        {"Call Scheduled "+format(new Date(lead.scheduledCall), 'MMM dd, h:mm a')}
                      </div>
                    )}
                    {showBackupLeads && lead.deletedAt && (
                      <div className="flex items-center mt-1 text-xs text-red-600">
                        <Trash2 className="h-3 w-3 mr-1" />
                        {"Deleted "+format(new Date(lead.deletedAt), 'MMM dd, yyyy')}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="ml-2 h-4 w-4 text-muted-foreground" />
                </div>
              </td>
              <td className="p-3">{lead.phone}</td>
              <td className="p-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  lead.status === 'new' ? 'bg-blue-100 text-blue-800' :
                  lead.status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                  lead.status === 'qualified' ? 'bg-green-100 text-green-800' :
                  lead.status === 'proposal' ? 'bg-indigo-100 text-indigo-800' :
                  lead.status === 'negotiation' ? 'bg-purple-100 text-purple-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {lead.status}
                </span>
              </td>
              <td className="p-3 capitalize">{lead.source}</td>
              <td className="p-3">
                {showBackupLeads && lead.deletedAt 
                  ? new Date(lead.deletedAt).toLocaleDateString()
                  : new Date(lead.createdAt).toLocaleDateString()}
              </td>
              <td className="p-3">
                <div className="flex space-x-1">
                  {!showBackupLeads && (
                    <>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAction('call', lead);
                        }}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAction('email', lead);
                        }}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAction('whatsapp', lead);
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAction('schedule', lead);
                        }}
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction('edit', lead);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {showBackupLeads ? (
                    <>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-green-600 hover:text-green-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAction('restore', lead);
                        }}
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAction('delete', lead);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction('delete', lead);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};