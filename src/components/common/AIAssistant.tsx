import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Mic, Send, X, UploadCloud, Trash2, Edit, Plus, Mail, Phone, MessageSquare, ChevronDown, Download,Bot } from 'lucide-react';
import { toast } from 'sonner';
import { LeadForm } from '../leads/LeadForm';
import { FileManager } from '@/components/common/FileManager';
import { database } from '../../firebase';
import { ref, push, set, update, remove, onValue, off } from 'firebase/database';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@radix-ui/react-label';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  type?: 'suggestion' | 'action' | 'dropdown' | 'preview' | 'contact' | 'command';
  action?: () => void;
  dropdown?: {
    options: { label: string; value: string }[];
    onSelect: (value: string) => void;
    placeholder: string;
  };
  preview?: {
    data: any[];
    columns: string[];
  };
  contact?: {
    lead: Lead;
  };
  command?: string;
}


interface Lead {
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
  createdAt: string;
  // updatedAt: string;
  leadNumber?: number;
  scheduledCall?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  score?: number;
  scoreFactors?: {
    emailOpened?: boolean;
    linkClicked?: boolean;
    meetingAttended?: boolean;
    responseReceived?: boolean;
  };
}

interface Agent {
  id: string;
  name: string;
  email: string;
  status: string;
  from?: string;
  to?: string;
}

const COMMAND_SUGGESTIONS = [
  'create lead',
  'edit lead',
  'delete lead',
  'import leads',
  'list all leads',
  'show lead statuses',
  'contact lead',
  'export leads',
  'assign leads',
  'show assignments'
];

export const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      content: 'Hello! I\'m your Lead Management Assistant. Try commands like "create lead", "list leads", or "import leads".',
      sender: 'ai',
      timestamp: new Date(),
      type: 'suggestion',
      command: 'create lead'
    },
    {
      id: 'welcome2',
      content: 'You can also say "edit lead", "delete lead", or "contact lead".',
      sender: 'ai',
      timestamp: new Date(),
      type: 'suggestion',
      command: 'list all leads'
    }
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [isAssignLeadsOpen, setIsAssignLeadsOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showLeadsTable, setShowLeadsTable] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [leadRanges, setLeadRanges] = useState<Record<string, { from: string; to: string }>>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentUser = localStorage.getItem('adminkey');
  const adminId = localStorage.getItem('adminkey');
  const [leadCount, setLeadCount] = useState<number>(0);
  const [agentCount, setAgentCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // console.log(leadCount,agentCount)
  const agentLimit = parseInt(localStorage.getItem('agentLimit') || 0);
  const leadLimit = parseInt(localStorage.getItem('leadLimit') || 0);
  // console.log(agentCount,leadLimit)

  // For Checking the count and Limit
  useEffect(() => {
    if (!adminId) {
      setError('Admin ID not found');
      setLoading(false);
      return;
    }

    // Reference to leads and agents in Firebase
    const leadsRef = ref(database, `users/${adminId}/leads`);
    const agentsRef = ref(database, `users/${adminId}/agents`);

    // Fetch lead count
    const leadListener = onValue(leadsRef, (snapshot) => {
      try {
        // console.log('[Leads] Snapshot:', snapshot.val());
        const leads = snapshot.val();
        const count = leads ? Object.keys(leads).length : 0;
        setLeadCount(count);
        // console.log(`[Leads] Current count: ${count}`);
      } catch (err) {
        console.error('[Leads] Error:', err);
        setError('Failed to fetch leads');
      }
    }, (error) => {
      console.error('[Leads] Listener error:', error);
      setError('Failed to listen for leads');
    });

    // Fetch agent count
    const agentListener = onValue(agentsRef, (snapshot) => {
      try {
        // console.log('[Agents] Snapshot:', snapshot.val());
        const agents = snapshot.val();
        const count = agents ? Object.keys(agents).length : 0;
        setAgentCount(count);
        // console.log(`[Agents] Current count: ${count}`);
      } catch (err) {
        // console.error('[Agents] Error:', err);
        setError('Failed to fetch agents');
      }
    }, (error) => {
      // console.error('[Agents] Listener error:', error);
      setError('Failed to listen for agents');
    });

    setLoading(false);

    // Cleanup listeners on unmount
    return () => {
      leadListener();
      agentListener();
    };
  }, [adminId]);

  // Log the limits from localStorage
  useEffect(() => {
    const agentLimit = parseInt(localStorage.getItem('agentLimit') || 0);
    const leadLimit = parseInt(localStorage.getItem('leadLimit') || 0);
    console.log(`[Limits] Agent Limit: ${agentLimit}, Lead Limit: ${leadLimit}`);
  }, []);




  useEffect(() => {
    if (!currentUser) return;

    const leadsRef = ref(database, `users/${currentUser}/leads`);
    const agentsRef = ref(database, `users/${currentUser}/agents`);
    
    const leadsUnsubscribe = onValue(leadsRef, (snapshot) => {
      const leadsData = snapshot.val();
      const loadedLeads: Lead[] = [];
      
      if (leadsData) {
        Object.keys(leadsData).forEach((key) => {
          loadedLeads.push({
            id: key,
            ...leadsData[key]
          });
        });
      }
      
      setLeads(loadedLeads);
    });

    const agentsUnsubscribe = onValue(agentsRef, (snapshot) => {
      const agentsData: Agent[] = [];
      const ranges: Record<string, { from: string; to: string }> = {};
      
      snapshot.forEach((childSnapshot) => {
        const agent = childSnapshot.val();
        agentsData.push({
          id: childSnapshot.key || '',
          name: agent.name,
          email: agent.email,
          status: agent.status,
          from: agent.from || '',
          to: agent.to || ''
        });
        
        ranges[childSnapshot.key || ''] = {
          from: agent.from || '',
          to: agent.to || ''
        };
      });
      
      setAgents(agentsData);
      setLeadRanges(ranges);
    });

    return () => {
      off(leadsRef);
      off(agentsRef);
    };
  }, [currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (input.trim()) {
      const filtered = COMMAND_SUGGESTIONS.filter(cmd => 
        cmd.toLowerCase().includes(input.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedSuggestionIndex(-1);
    } else {
      setShowSuggestions(false);
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: input,
      sender: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setShowSuggestions(false);
    processCommand(input.toLowerCase());
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showSuggestions && selectedSuggestionIndex >= 0) {
        handleSuggestionClick(suggestions[selectedSuggestionIndex]);
      } else {
        handleSend();
      }
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : prev
      );
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const processCommand = (command: string) => {
    setTimeout(() => {
      if (command.includes('create') || command.includes('add') || command.includes('new')) {
        showLeadCreationOptions();
      } 
      else if (command.includes('edit') || command.includes('update')) {
        showLeadUpdateOptions();
      }
      else if (command.includes('delete') || command.includes('remove')) {
        showLeadDeletionOptions();
      }
      else if (command.includes('import') || command.includes('upload')) {
        showImportOptions();
      }
      else if (command.includes('list') || command.includes('show') || command.includes('all leads')) {
        if (command.includes('status') || command.includes('statistics')) {
          showLeadStatusStats();
        } else {
          showLeadList();
          setShowLeadsTable(true);
        }
      }
      else if (command.includes('contact') || command.includes('call') || command.includes('email') || command.includes('whatsapp')) {
        showContactOptions();
      }
      else if (command.includes('assign') || command.includes('assignment')) {
        showAssignmentOptions();
      }
      else if (command.includes('show assignment') || command.includes('view assignment')) {
        showAssignmentViewOptions();
      }
      else {
        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          content: "I can help you manage leads. Try saying 'create lead', 'edit lead', 'delete lead', 'import leads', 'list leads', 'show statuses', or 'contact lead'.",
          sender: 'ai',
          timestamp: new Date(),
          type: 'suggestion',
          command: 'list all leads'
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    }, 1000);
  };

  const showLeadCreationOptions = () => {
    const promptMessage: Message = {
      id: `ai-prompt-${Date.now()}`,
      content: 'How would you like to create a lead?',
      sender: 'ai',
      timestamp: new Date(),
    };

    const options: Message[] = [
      {
        id: `option-manual-${Date.now()}`,
        content: 'Create Lead Manually',
        sender: 'ai',
        timestamp: new Date(),
        type: 'suggestion',
        action: () => {
          addMessage("Create Lead Manually", true);
          setIsLeadFormOpen(true);
          setEditingLead(null);
          addMessage("Opening lead creation form...", false);
        }
      },
      {
        id: `option-import-${Date.now()}`,
        content: 'Import Leads from File',
        sender: 'ai',
        timestamp: new Date(),
        type: 'suggestion',
        action: () => {
          addMessage("Import Leads", true);
          setIsFileManagerOpen(true);
          addMessage("Opening file manager to import leads...", false);
        }
      }
    ];

    setMessages(prev => [...prev, promptMessage, ...options]);
  };

  const showLeadUpdateOptions = () => {
    if (leads.length === 0) {
      addMessage("No leads available to edit. Create some leads first.", false);
      return;
    }

    const promptMessage: Message = {
      id: `ai-prompt-${Date.now()}`,
      content: 'Select a lead to edit:',
      sender: 'ai',
      timestamp: new Date(),
      type: 'dropdown',
      dropdown: {
        options: leads.map(lead => ({
          label: `${lead.first_name} ${lead.last_name} (${lead.status})`,
          value: lead.id || ''
        })),
        onSelect: (value) => {
          const selectedLead = leads.find(lead => lead.id === value);
          if (selectedLead) {
            addMessage(`Editing ${selectedLead.first_name} ${selectedLead.last_name}`, true);
            setEditingLead(selectedLead);
            setIsLeadFormOpen(true);
          }
        },
        placeholder: 'Select a lead...'
      }
    };

    setMessages(prev => [...prev, promptMessage]);
  };

  const showLeadDeletionOptions = () => {
    if (leads.length === 0) {
      addMessage("No leads available to delete.", false);
      return;
    }

    const promptMessage: Message = {
      id: `ai-prompt-${Date.now()}`,
      content: 'Select a lead to delete:',
      sender: 'ai',
      timestamp: new Date(),
      type: 'dropdown',
      dropdown: {
        options: leads.map(lead => ({
          label: `${lead.first_name} ${lead.last_name} (${lead.status})`,
          value: lead.id || ''
        })),
        onSelect: (value) => {
          const selectedLead = leads.find(lead => lead.id === value);
          if (selectedLead) {
            addMessage(`Delete ${selectedLead.first_name} ${selectedLead.last_name}?`, false);
            
            const confirmMessage: Message = {
              id: `confirm-${Date.now()}`,
              content: 'Are you sure you want to delete this lead?',
              sender: 'ai',
              timestamp: new Date(),
              type: 'suggestion',
              action: () => {
                addMessage(`Yes, delete ${selectedLead.first_name} ${selectedLead.last_name}`, true);
                handleDeleteLead(selectedLead.id!);
              }
            };

            const cancelMessage: Message = {
              id: `cancel-${Date.now()}`,
              content: 'Cancel deletion',
              sender: 'ai',
              timestamp: new Date(),
              type: 'suggestion',
              action: () => {
                addMessage("Deletion cancelled", true);
              }
            };

            setMessages(prev => [...prev, confirmMessage, cancelMessage]);
          }
        },
        placeholder: 'Select a lead...'
      }
    };

    setMessages(prev => [...prev, promptMessage]);
  };

  const showImportOptions = () => {
    const promptMessage: Message = {
      id: `ai-prompt-${Date.now()}`,
      content: 'How would you like to import leads?',
      sender: 'ai',
      timestamp: new Date(),
    };

    const options: Message[] = [
      {
        id: `option-excel-${Date.now()}`,
        content: 'Import from Excel',
        sender: 'ai',
        timestamp: new Date(),
        type: 'suggestion',
        action: () => {
          addMessage("Import from Excel", true);
          setIsFileManagerOpen(true);
          addMessage("Opening file manager for Excel import...", false);
        }
      },
      {
        id: `option-csv-${Date.now()}`,
        content: 'Import from CSV',
        sender: 'ai',
        timestamp: new Date(),
        type: 'suggestion',
        action: () => {
          addMessage("Import from CSV", true);
          setIsFileManagerOpen(true);
          addMessage("Opening file manager for CSV import...", false);
        }
      }
    ];

    setMessages(prev => [...prev, promptMessage, ...options]);
  };

  const showLeadList = () => {
    if (leads.length === 0) {
      addMessage("No leads available yet.", false);
      return;
    }

    const promptMessage: Message = {
      id: `ai-prompt-${Date.now()}`,
      content: `Here are your ${leads.length} leads:`,
      sender: 'ai',
      timestamp: new Date(),
    };

    const viewAllMessage: Message = {
      id: `view-all-${Date.now()}`,
      content: 'View all leads in table',
      sender: 'ai',
      timestamp: new Date(),
      type: 'suggestion',
      action: () => {
        addMessage("Showing all leads in table", true);
        setShowLeadsTable(true);
      }
    };

    const leadMessages = leads.slice(0, 3).map(lead => ({
      id: `list-${lead.id}`,
      content: `${lead.first_name} ${lead.last_name} - ${lead.email} (${lead.status})`,
      sender: 'ai',
      timestamp: new Date(),
      type: 'contact',
      contact: {
        lead
      }
    }));

    setMessages(prev => [...prev, promptMessage, ...leadMessages, viewAllMessage]);
  };

  const showLeadStatusStats = () => {
    if (leads.length === 0) {
      addMessage("No leads available yet.", false);
      return;
    }

    const statusCounts = leads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusMessage: Message = {
      id: `status-${Date.now()}`,
      content: 'Here are your lead status statistics:',
      sender: 'ai',
      timestamp: new Date(),
      type: 'suggestion',
      action: () => {
        addMessage("Showing detailed status report", true);
        setShowStatusModal(true);
      }
    };

    const statusList = Object.entries(statusCounts).map(([status, count]) => ({
      id: `status-${status}`,
      content: `${status}: ${count} leads`,
      sender: 'ai',
      timestamp: new Date()
    }));

    setMessages(prev => [...prev, statusMessage, ...statusList]);
  };

  const showLeadStatusOptions = () => {
    if (leads.length === 0) {
      addMessage("No leads available yet.", false);
      return;
    }

    const statuses = Array.from(new Set(leads.map(lead => lead.status)));

    const promptMessage: Message = {
      id: `ai-prompt-${Date.now()}`,
      content: 'Select a status to filter leads:',
      sender: 'ai',
      timestamp: new Date(),
      type: 'dropdown',
      dropdown: {
        options: statuses.map(status => ({
          label: status,
          value: status
        })),
        onSelect: (value) => {
          const filteredLeads = leads.filter(lead => lead.status === value);
          showFilteredLeads(filteredLeads, value);
        },
        placeholder: 'Select a status...'
      }
    };

    setMessages(prev => [...prev, promptMessage]);
  };

  const showFilteredLeads = (filteredLeads: Lead[], status: string) => {
    if (filteredLeads.length === 0) {
      addMessage(`No leads with status "${status}" found.`, false);
      return;
    }

    const promptMessage: Message = {
      id: `ai-filtered-${Date.now()}`,
      content: `Showing ${filteredLeads.length} leads with status "${status}":`,
      sender: 'ai',
      timestamp: new Date(),
    };

    const leadMessages = filteredLeads.slice(0, 5).map(lead => ({
      id: `filtered-${lead.id}`,
      content: `${lead.first_name} ${lead.last_name} - ${lead.email}`,
      sender: 'ai',
      timestamp: new Date(),
      type: 'contact',
      contact: {
        lead
      }
    }));

    setMessages(prev => [...prev, promptMessage, ...leadMessages]);
  };

  const showContactOptions = () => {
    if (leads.length === 0) {
      addMessage("No leads available to contact.", false);
      return;
    }

    const promptMessage: Message = {
      id: `ai-prompt-${Date.now()}`,
      content: 'Select a lead to contact:',
      sender: 'ai',
      timestamp: new Date(),
      type: 'dropdown',
      dropdown: {
        options: leads.map(lead => ({
          label: `${lead.first_name} ${lead.last_name} (${lead.phone || lead.email})`,
          value: lead.id || ''
        })),
        onSelect: (value) => {
          const selectedLead = leads.find(lead => lead.id === value);
          if (selectedLead) {
            showContactMethods(selectedLead);
          }
        },
        placeholder: 'Select a lead...'
      }
    };

    setMessages(prev => [...prev, promptMessage]);
  };

  const showContactMethods = (lead: Lead) => {
    const promptMessage: Message = {
      id: `ai-contact-${Date.now()}`,
      content: `How would you like to contact ${lead.first_name} ${lead.last_name}?`,
      sender: 'ai',
      timestamp: new Date(),
    };

    const options: Message[] = [];

    if (lead.phone) {
      options.push({
        id: `call-${lead.id}`,
        content: 'Call',
        sender: 'ai',
        timestamp: new Date(),
        type: 'suggestion',
        action: () => {
          addMessage(`Calling ${lead.first_name} at ${lead.phone}`, true);
          window.open(`tel:${lead.phone}`, '_blank');
        }
      },
      {
        id: `whatsapp-${lead.id}`,
        content: 'WhatsApp',
        sender: 'ai',
        timestamp: new Date(),
        type: 'suggestion',
        action: () => {
          addMessage(`Opening WhatsApp chat with ${lead.first_name}`, true);
          const cleanedPhone = lead.phone.replace(/\D/g, '');
          window.open(`https://wa.me/${cleanedPhone}`, '_blank');
        }
      });
    }

    if (lead.email) {
      options.push({
        id: `email-${lead.id}`,
        content: 'Email',
        sender: 'ai',
        timestamp: new Date(),
        type: 'suggestion',
        action: () => {
          addMessage(`Emailing ${lead.first_name} at ${lead.email}`, true);
          window.open(`mailto:${lead.email}`, '_blank');
        }
      });
    }

    if (options.length === 0) {
      options.push({
        id: `no-contact-${lead.id}`,
        content: 'No contact information available for this lead',
        sender: 'ai',
        timestamp: new Date(),
      });
    }

    setMessages(prev => [...prev, promptMessage, ...options]);
  };

  const showAssignmentOptions = () => {
    const promptMessage: Message = {
      id: `ai-assign-${Date.now()}`,
      content: 'Would you like to assign leads to agents?',
      sender: 'ai',
      timestamp: new Date(),
    };

    const options: Message[] = [
      {
        id: `option-assign-${Date.now()}`,
        content: 'Open Lead Assignment',
        sender: 'ai',
        timestamp: new Date(),
        type: 'suggestion',
        action: () => {
          addMessage("Open Lead Assignment", true);
          setIsAssignLeadsOpen(true);
        }
      }
    ];

    setMessages(prev => [...prev, promptMessage, ...options]);
  };

  const showAssignmentViewOptions = () => {
    if (agents.length === 0) {
      addMessage("No agents available to show assignments.", false);
      return;
    }

    const promptMessage: Message = {
      id: `ai-assignment-view-${Date.now()}`,
      content: 'Select an agent to view their lead assignments:',
      sender: 'ai',
      timestamp: new Date(),
      type: 'dropdown',
      dropdown: {
        options: agents.filter(a => a.status === 'active').map(agent => ({
          label: `${agent.name} (${agent.email})`,
          value: agent.id
        })),
        onSelect: (value) => {
          const selectedAgent = agents.find(agent => agent.id === value);
          if (selectedAgent) {
            showAgentAssignment(selectedAgent);
          }
        },
        placeholder: 'Select an agent...'
      }
    };

    setMessages(prev => [...prev, promptMessage]);
  };

  const showAgentAssignment = (agent: Agent) => {
    const assignmentMessage: Message = {
      id: `assignment-${agent.id}`,
      content: `Lead assignments for ${agent.name}:`,
      sender: 'ai',
      timestamp: new Date(),
    };

    const rangeMessage: Message = {
      id: `range-${agent.id}`,
      content: agent.from && agent.to 
        ? `Current range: ${agent.from} to ${agent.to}`
        : 'No lead range assigned',
      sender: 'ai',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assignmentMessage, rangeMessage]);
  };

  const addMessage = (content: string, isUser: boolean) => {
    const message: Message = {
      id: `${isUser ? 'user' : 'ai'}-${Date.now()}`,
      content,
      sender: isUser ? 'user' : 'ai',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, message]);
  };

  const handleDeleteLead = async (id: string) => {
    if (!currentUser) {
      toast.error('Authentication required');
      return;
    }

    try {
      await remove(ref(database, `users/${currentUser}/leads/${id}`));
      addMessage(`Lead deleted successfully`, false);
      toast.success('Lead deleted');
    } catch (error) {
      addMessage(`Failed to delete lead`, false);
      toast.error('Error deleting lead');
      console.error('Error deleting lead:', error);
    }
  };

  const handleAddLead = async (lead: Lead) => {
    if (!currentUser) {
      toast.error('Authentication required');
      return;
    }

    try {
      const newLead = {
        ...lead,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: lead.status || 'new'
      };

      const leadsRef = ref(database, `users/${currentUser}/leads`);
      const newLeadRef = push(leadsRef);
      await set(newLeadRef, newLead);

      setIsLeadFormOpen(false);
      addMessage(`New lead created: ${lead.first_name} ${lead.last_name}`, false);
      toast.success('Lead created');
    } catch (error) {
      toast.error('Error creating lead');
      console.error('Error creating lead:', error);
    }
  };

  const handleUpdateLead = async (updatedLead: Lead) => {
    if (!currentUser || !updatedLead.id) {
      toast.error('Authentication required');
      return;
    }

    try {
      const leadUpdates = {
        ...updatedLead,
        updatedAt: new Date().toISOString()
      };

      await update(ref(database, `users/${currentUser}/leads/${updatedLead.id}`), leadUpdates);

      setIsLeadFormOpen(false);
      addMessage(`Lead updated: ${updatedLead.first_name} ${updatedLead.last_name}`, false);
      toast.success('Lead updated');
    } catch (error) {
      toast.error('Error updating lead');
      console.error('Error updating lead:', error);
    }
  };

  const handleImportLeads = async (file: File) => {
    if (!currentUser) {
      toast.error('Authentication required');
      return;
    }

    try {
      const data = await readExcelFile(file);
      const leadsToImport = parseExcelData(data);

      if (leadsToImport.length === 0) {
        addMessage("No valid lead data found in the file", false);
        toast.warning('No leads to import');
        return;
      }

      showImportPreview(leadsToImport);
    } catch (error) {
      addMessage("Failed to read file", false);
      toast.error('Error reading file');
      console.error('Error reading file:', error);
    }
  };

  const showImportPreview = (leadsToImport: Lead[]) => {
    setPreviewData(leadsToImport);
    
    const columns = ['first_name', 'last_name', 'email', 'phone', 'status'];
    
    const previewMessage: Message = {
      id: `preview-${Date.now()}`,
      content: 'I found these leads in the file. Would you like to import them?',
      sender: 'ai',
      timestamp: new Date(),
      type: 'preview',
      preview: {
        data: leadsToImport.slice(0, 5),
        columns
      }
    };

    const confirmMessage: Message = {
      id: `confirm-import-${Date.now()}`,
      content: 'Review all data before importing:',
      sender: 'ai',
      timestamp: new Date(),
      type: 'suggestion',
      action: () => {
        addMessage("Showing full import preview", true);
        setShowPreview(true);
      }
    };

    setMessages(prev => [...prev, previewMessage, confirmMessage]);
  };

  const importLeadsToFirebase = async (leadsToImport: Lead[]) => {
    try {
      const leadsRef = ref(database, `users/${currentUser}/leads`);
      const importTime = new Date().toISOString();

      const importPromises = leadsToImport.map(lead => {
        const newLeadRef = push(leadsRef);
        return set(newLeadRef, {
          ...lead,
          createdAt: importTime,
          updatedAt: importTime,
          status: lead.status || 'new'
        });
      });

      await Promise.all(importPromises);

      setIsFileManagerOpen(false);
      addMessage(`${leadsToImport.length} leads imported successfully`, false);
      toast.success('Leads imported');
    } catch (error) {
      addMessage("Failed to import leads", false);
      toast.error('Error importing leads');
      console.error('Error importing leads:', error);
    }
  };

  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        resolve(jsonData);
      };
      
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  const parseExcelData = (data: any[]): Lead[] => {
    return data.map((row, index) => ({
      first_name: row['First Name'] || row['first_name'] || `Imported ${index + 1}`,
      lastName: row['Last Name'] || row['lastName'] || '',
      email: row['Email'] || row['email'] || '',
      phone: row['Phone'] || row['phone'] || '',
      status: row['Status'] || row['status'] || 'new'
    })).filter(lead => lead.first_name && lead.email);
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      toast.success('Voice command processed');
      setInput('create lead');
    } else {
      setIsRecording(true);
      toast.info('Listening... Speak your command');
    }
  };

  const handleRangeChange = (agentId: string, field: 'from' | 'to', value: string) => {
    setLeadRanges(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        [field]: value
      }
    }));
  };

  const assignLeads = async (agentId: string) => {
    try {
      if (!currentUser) throw new Error('Admin ID missing');
      
      const agent = agents.find(a => a.id === agentId);
      if (!agent) throw new Error('Agent not found');
      
      const { from, to } = leadRanges[agentId] || { from: '', to: '' };
      
      if (!from || !to) {
        throw new Error('Both from and to values are required');
      }
      
      const agentRef = ref(database, `users/${currentUser}/agents/${agentId}`);
      await update(agentRef, {
        from,
        to
      });
      
      toast.success(`Lead range ${from} to ${to} assigned to ${agent.name}`);
    } catch (error) {
      console.error('Error assigning leads:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to assign lead range');
    }
  };

  const renderMessageContent = (message: Message) => {
    if (message.type === 'dropdown' && message.dropdown) {
      return (
        <div className="w-full">
          <p className="text-sm mb-2">{message.content}</p>
          <Select onValueChange={message.dropdown.onSelect}>
            <SelectTrigger className="w-full neuro-inset focus:shadow-none">
              <SelectValue placeholder={message.dropdown.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {message.dropdown.options.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    else if (message.type === 'preview' && message.preview) {
      return (
        <div className="w-full">
          <p className="text-sm mb-2">{message.content}</p>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  {message.preview.columns.map(column => (
                    <TableHead key={column} className="px-3 py-2">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {message.preview.data.map((row, index) => (
                  <TableRow key={index}>
                    {message.preview.columns.map(column => (
                      <TableCell key={`${index}-${column}`} className="px-3 py-2">
                        {row[column] || '-'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs mt-2 text-muted-foreground">
            Showing {message.preview.data.length} of {previewData.length} records
          </p>
        </div>
      );
    }
    else if (message.type === 'contact' && message.contact) {
      const lead = message.contact.lead;
      return (
        <div className="flex flex-col">
          <p className="text-sm">{message.content}</p>
          <div className="flex gap-2 mt-2">
            {lead.phone && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  onClick={() => window.open(`tel:${lead.phone}`, '_blank')}
                  title="Call"
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    const cleanedPhone = lead.phone.replace(/\D/g, '');
                    window.open(`https://wa.me/${cleanedPhone}`, '_blank');
                  }}
                  title="WhatsApp"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </>
            )}
            {lead.email && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={() => window.open(`mailto:${lead.email}`, '_blank')}
                title="Email"
              >
                <Mail className="h-4 w-4" />
              </Button>
            )}
            {!lead.phone && !lead.email && (
              <span className="text-xs text-muted-foreground">No contact info</span>
            )}
          </div>
        </div>
      );
    }
    else if (message.type === 'suggestion' && message.command) {
      return (
        <div 
          className="cursor-pointer hover:bg-blue-100 p-2 rounded-lg"
          onClick={message.action}
        >
          <p className="text-sm text-blue-800">{message.content}</p>
        </div>
      );
    }
    return <p className="text-sm">{message.content}</p>;
  };

  return (
    <>
      {/* Floating assistant button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full neuro shadow-lg z-50"
        >
          <Bot className="h-14 w-14" />
        </Button>
      )}

      {/* Assistant dialog */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-[90vw] max-w-md h-[500px] neuro shadow-xl border-none z-50 flex flex-col">
          <CardHeader className="space-y-1 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Lead Management Assistant</CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-3 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] neuro p-3 rounded-lg ${
                    message.sender === 'user'
                      ? 'bg-pulse text-white rounded-tr-none'
                      : message.type === 'suggestion'
                      ? 'bg-blue-100 text-blue-800 rounded-tl-none cursor-pointer hover:bg-blue-200'
                      : 'bg-muted/50 rounded-tl-none'
                  }`}
                  onClick={message.type === 'suggestion' ? message.action : undefined}
                >
                  {renderMessageContent(message)}
                  <p className="text-[10px] text-right mt-1 opacity-70">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </CardContent>
          
          <CardFooter className="border-t p-3 gap-2 flex-col">
            {/* Suggestions dropdown */}
            {showSuggestions && (
              <div className="w-full bg-white border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`p-2 hover:bg-gray-100 cursor-pointer text-sm ${
                      index === selectedSuggestionIndex ? 'bg-gray-100' : ''
                    }`}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex w-full gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                className={`h-8 w-8 rounded-full ${isRecording ? 'bg-red-500 text-white animate-pulse' : ''}`}
                onClick={toggleRecording}
                title="Voice command"
              >
                <Mic className="h-4 w-4" />
              </Button>
              
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type a command (e.g., 'create lead')..."
                className="neuro-inset text-sm min-h-[40px] focus:shadow-none resize-none flex-1"
                onFocus={() => input.trim() && setShowSuggestions(true)}
              />
              
              <Button 
                disabled={!input.trim()}
                onClick={handleSend}
                className="h-8 w-8 rounded-full bg-pulse hover:bg-pulse/90 p-0 flex items-center justify-center"
                title="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Preview Dialog for Excel Import */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Import ({previewData.length} leads)</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((lead, index) => (
                  <TableRow key={index}>
                    <TableCell>{lead.first_name}</TableCell>
                    <TableCell>{lead.last_name}</TableCell>
                    <TableCell>{lead.email || '-'}</TableCell>
                    <TableCell>{lead.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{lead.status || 'new'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                importLeadsToFirebase(previewData);
                setShowPreview(false);
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Import {previewData.length} Leads
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leads Table Dialog */}
      <Dialog open={showLeadsTable} onOpenChange={setShowLeadsTable}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              All Leads ({leads.length})
              <div className="flex gap-2 mt-2">
                <Select 
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Array.from(new Set(leads.map(lead => lead.status))).map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline"
                  onClick={() => setIsLeadFormOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Lead
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads
                  .filter(lead => statusFilter === 'all' || lead.status === statusFilter)
                  .map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>{lead.first_name} {lead.last_name}</TableCell>
                    <TableCell>{lead.email}</TableCell>
                    <TableCell>{lead.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{lead.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setEditingLead(lead);
                            setIsLeadFormOpen(true);
                            setShowLeadsTable(false);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setSelectedLeadId(lead.id!);
                            handleDeleteLead(lead.id!);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setShowLeadsTable(false);
                            showContactMethods(lead);
                          }}
                        >
                          <Phone className="h-4 w-4 mr-2" /> Contact
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {statusFilter === 'all' ? leads.length : leads.filter(lead => lead.status === statusFilter).length} of {leads.length} leads
            </div>
            <Button 
              variant="outline"
              onClick={() => {
                const worksheet = XLSX.utils.json_to_sheet(leads);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
                XLSX.writeFile(workbook, "leads_export.xlsx");
              }}
            >
              <Download className="h-4 w-4 mr-2" /> Export to Excel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lead Status Statistics Dialog */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lead Status Statistics</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Leads</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(
                  leads.reduce((acc, lead) => {
                    acc[lead.status] = (acc[lead.status] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([status, count]) => (
                  <TableRow key={status}>
                    <TableCell>
                      <Badge variant="outline">{status}</Badge>
                    </TableCell>
                    <TableCell>{count}</TableCell>
                    <TableCell>{Math.round((count / leads.length) * 100)}%</TableCell>
                    <TableCell>
                      <Button 
                        variant="link" 
                        size="sm" 
                        onClick={() => {
                          setShowStatusModal(false);
                          const filteredLeads = leads.filter(lead => lead.status === status);
                          showFilteredLeads(filteredLeads, status);
                        }}
                      >
                        View {count} leads
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Status Distribution</h3>
              <div className="h-48">
                <div className="flex flex-col gap-1">
                  {Object.entries(
                    leads.reduce((acc, lead) => {
                      acc[lead.status] = (acc[lead.status] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([status, count]) => (
                    <div key={status} className="flex items-center">
                      <div 
                        className="h-4 bg-blue-500 rounded mr-2" 
                        style={{ width: `${(count / leads.length) * 100}%` }}
                      />
                      <span className="text-sm">
                        {status}: {count} ({(count / leads.length * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Quick Actions</h3>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setShowStatusModal(false);
                    setShowLeadsTable(true);
                  }}
                >
                  View All Leads
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setShowStatusModal(false);
                    setIsLeadFormOpen(true);
                  }}
                >
                  Create New Lead
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Leads Dialog */}
      <Dialog open={isAssignLeadsOpen} onOpenChange={setIsAssignLeadsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Lead Ranges to Agents</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Desktop View */}
            <div className="hidden md:block">
              <div className="overflow-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Agent</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">From Lead</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">To Lead</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Current Range</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {agents.filter(a => a.status === 'active').map((agent) => (
                      <tr key={agent.id} className="hover:bg-muted/20">
                        <td className="p-3">
                          <div className="flex items-center">
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{agent.name}</p>
                              <p className="text-sm text-muted-foreground">{agent.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Input
                            type="text"
                            placeholder="Lead 001"
                            value={leadRanges[agent.id]?.from || ''}
                            onChange={(e) => handleRangeChange(agent.id, 'from', e.target.value)}
                            className="neuro-inset focus:shadow-none w-full"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="text"
                            placeholder="Lead 100"
                            value={leadRanges[agent.id]?.to || ''}
                            onChange={(e) => handleRangeChange(agent.id, 'to', e.target.value)}
                            className="neuro-inset focus:shadow-none w-full"
                          />
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {agent.from && agent.to 
                            ? `${agent.from} - ${agent.to}`
                            : 'Not assigned'}
                        </td>
                        <td className="p-3">
                          <Button
                            onClick={() => assignLeads(agent.id)}
                            className="neuro hover:shadow-none transition-all duration-300"
                            disabled={!leadRanges[agent.id]?.from || !leadRanges[agent.id]?.to}
                          >
                            {agent.from ? 'Update' : 'Assign'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {agents.filter(a => a.status === 'active').map((agent) => (
                <div 
                  key={agent.id} 
                  className="rounded-xl p-4 bg-white dark:bg-gray-800 
                            shadow-[inset_5px_5px_10px_rgba(0,0,0,0.05),inset_-5px_-5px_10px_rgba(255,255,255,0.8)]
                            dark:shadow-[inset_5px_5px_10px_rgba(0,0,0,0.3),inset_-5px_-5px_10px_rgba(75,85,99,0.3)]"
                >
                  <div className="flex items-center mb-4">
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">{agent.name}</h3>
                      <p className="text-sm text-muted-foreground">{agent.email}</p>
                      {agent.from && agent.to && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Current: {agent.from} - {agent.to}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>From Lead</Label>
                      <Input
                        type="text"
                        placeholder="Lead 001"
                        value={leadRanges[agent.id]?.from || ''}
                        onChange={(e) => handleRangeChange(agent.id, 'from', e.target.value)}
                        className="neuro-inset focus:shadow-none w-full"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <Label>To Lead</Label>
                      <Input
                        type="text"
                        placeholder="Lead 100"
                        value={leadRanges[agent.id]?.to || ''}
                        onChange={(e) => handleRangeChange(agent.id, 'to', e.target.value)}
                        className="neuro-inset focus:shadow-none w-full"
                      />
                    </div>
                    
                    <Button
                      onClick={() => assignLeads(agent.id)}
                      className="w-full neuro hover:shadow-none transition-all duration-300 mt-2"
                      disabled={!leadRanges[agent.id]?.from || !leadRanges[agent.id]?.to}
                    >
                      {agent.from ? 'Update Range' : 'Assign Range'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lead Form */}
      <LeadForm 
        isOpen={isLeadFormOpen}
        onClose={() => setIsLeadFormOpen(false)}
        onSubmit={editingLead ? handleUpdateLead : handleAddLead}
        lead={editingLead}
      />

      {/* File Manager for Import */}
      <FileManager 
        isOpen={isFileManagerOpen}
        onClose={() => setIsFileManagerOpen(false)}
        onFilesSelected={(files) => handleImportLeads(files[0])}
        mode="import"
        fileType="excel"
      />
    </>
  );
};