import React, { useState, useEffect } from 'react';
import { 
  Phone, Mail, MessageSquare, Edit, Trash2, Plus,
  User, Briefcase, Calendar, Smartphone,
  CheckCircle, XCircle, ChevronLeft, ChevronRight,
  Activity, EyeOff, Eye, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { AgentForm } from './AgentForm';
import { database } from '../../firebase';
import { ref, onValue, remove, update, push, set, get } from 'firebase/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import ActivityFeed from './AgentActivity';

const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8';

interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  status: 'active' | 'inactive' | 'on_leave';
  avatar?: string;
  birthDate?: string;
  password?: string;
  assignedLeads?: {
    from: number;
    to: number;
  };
  createdAt?: string;
  lastUpdated?: string;
  lastLogin?: string;
  logoutTime?: string;
  authUid?: string;
}

interface Lead {
  id?: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  source: string;
  assignedTo?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AgentActivity {
  id?: string;
  action: string;
  leadId?: string;
  leadDetails?: {
    name: string;
    company: string;
    email: string;
    phone: string;
  };
  agentDetails: {
    id: string;
    email: string;
    name: string;
    ipAddress: string;
  };
  changes?: Record<string, {
    old: any;
    new: any;
    fieldName: string;
    changedAt: string;
  }>;
  timestamp: string;
  environment?: {
    device: string;
    location: string;
  };
}

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
    return encryptedData;
  }
}

async function decryptAgent(agent: Agent): Promise<Agent> {
  const decryptedAgent = { ...agent };
  
  decryptedAgent.name = await decryptData(agent.name);
  decryptedAgent.email = await decryptData(agent.email);
  decryptedAgent.phone = await decryptData(agent.phone);
  decryptedAgent.designation = await decryptData(agent.designation);
  if (agent.password) {
    decryptedAgent.password = await decryptData(agent.password);
  }
  if (agent.birthDate) {
    decryptedAgent.birthDate = await decryptData(agent.birthDate);
  }
  
  return decryptedAgent;
}

async function decryptLead(lead: Lead): Promise<Lead> {
  const decryptedLead = { ...lead };
  
  decryptedLead.name = await decryptData(lead.name);
  decryptedLead.company = await decryptData(lead.company);
  decryptedLead.email = await decryptData(lead.email);
  decryptedLead.phone = await decryptData(lead.phone);
  if (lead.notes) {
    decryptedLead.notes = await decryptData(lead.notes);
  }
  if (lead.status) {
    decryptedLead.status = await decryptData(lead.status);
  }
  if (lead.source) {
    decryptedLead.source = await decryptData(lead.source);
  }
  
  return decryptedLead;
}

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
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function encryptAgent(agent: Agent): Promise<Agent> {
  const encryptedAgent = { ...agent };
  
  encryptedAgent.name = await encryptData(agent.name);
  encryptedAgent.email = await encryptData(agent.email);
  encryptedAgent.phone = await encryptData(agent.phone);
  encryptedAgent.designation = await encryptData(agent.designation);
  if (agent.password) {
    encryptedAgent.password = await encryptData(agent.password);
  }
  if (agent.birthDate) {
    encryptedAgent.birthDate = await encryptData(agent.birthDate);
  }
  
  return encryptedAgent;
}

export const AgentCards: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [decryptedAgents, setDecryptedAgents] = useState<Agent[]>([]);
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [viewingAgent, setViewingAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [agentsPerPage] = useState(8);
  const [agentActivities, setAgentActivities] = useState<AgentActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [decryptedLeads, setDecryptedLeads] = useState<Lead[]>([]);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  useEffect(() => {
    const fetchAndDecryptAgents = async () => {
      try {
        const adminKey = localStorage.getItem('adminkey');
        if (!adminKey) {
          toast.error('User not authenticated');
          setLoading(false);
          return;
        }

        const agentsRef = ref(database, `users/${adminKey}/agents`);
        
        const unsubscribe = onValue(agentsRef, async (snapshot) => {
          const agentsData = snapshot.val();
          if (agentsData) {
            setIsDecrypting(true);
            const agentsArray = Object.entries(agentsData).map(([id, agent]: [string, any]) => ({
              id,
              ...agent,
              assignedLeads: agent.assignedLeads ? {
                from: agent.assignedLeads.from || 0,
                to: agent.assignedLeads.to || 0
              } : undefined
            }));

            const decryptedAgentsArray = await Promise.all(
              agentsArray.map(async (agent) => {
                try {
                  return await decryptAgent(agent);
                } catch (error) {
                  console.error('Error decrypting agent:', error);
                  return agent;
                }
              })
            );

            setAgents(agentsArray);
            setDecryptedAgents(decryptedAgentsArray);
          } else {
            setAgents([]);
            setDecryptedAgents([]);
          }
          setLoading(false);
          setIsDecrypting(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching agents:', error);
        toast.error('Failed to fetch agents');
        setLoading(false);
        setIsDecrypting(false);
      }
    };

    fetchAndDecryptAgents();
  }, []);

  useEffect(() => {
    const fetchAndDecryptLeads = async () => {
      try {
        const adminKey = localStorage.getItem('adminkey');
        if (!adminKey) return;

        const leadsRef = ref(database, `users/${adminKey}/leads`);
        
        const unsubscribe = onValue(leadsRef, async (snapshot) => {
          const leadsData = snapshot.val();
          if (leadsData) {
            setIsDecrypting(true);
            const leadsArray = Object.entries(leadsData).map(([id, lead]: [string, any]) => ({
              id,
              ...lead
            }));

            const decryptedLeadsArray = await Promise.all(
              leadsArray.map(async (lead) => {
                try {
                  return await decryptLead(lead);
                } catch (error) {
                  console.error('Error decrypting lead:', error);
                  return lead;
                }
              })
            );

            setLeads(leadsArray);
            setDecryptedLeads(decryptedLeadsArray);
          } else {
            setLeads([]);
            setDecryptedLeads([]);
          }
          setIsDecrypting(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching leads:', error);
        setIsDecrypting(false);
      }
    };

    fetchAndDecryptLeads();
  }, []);

  useEffect(() => {
    if (!viewingAgent) return;

    const fetchActivities = async () => {
      try {
        setLoadingActivities(true);
        const adminKey = localStorage.getItem('adminkey');
        if (!adminKey) return;

        const activitiesRef = ref(database, `users/${adminKey}/agentactivity`);
        
        const unsubscribe = onValue(activitiesRef, async (snapshot) => {
          const activitiesData = snapshot.val();
          if (!activitiesData) {
            setAgentActivities([]);
            setLoadingActivities(false);
            return;
          }

          const activitiesArray: AgentActivity[] = Object.entries(activitiesData).map(([id, activity]: [string, any]) => ({
            id,
            ...activity
          }));

          const decryptedActivities = await Promise.all(
            activitiesArray.map(async (activity) => {
              if (activity.leadDetails) {
                const decryptedLeadDetails = {
                  name: await decryptData(activity.leadDetails.name),
                  company: await decryptData(activity.leadDetails.company),
                  email: await decryptData(activity.leadDetails.email),
                  phone: await decryptData(activity.leadDetails.phone)
                };
                return { ...activity, leadDetails: decryptedLeadDetails };
              }
              return activity;
            })
          );

          const fullyDecryptedActivities = await Promise.all(
            decryptedActivities.map(async (activity) => {
              if (activity.changes) {
                const decryptedChanges: Record<string, any> = {};
                for (const [field, change] of Object.entries(activity.changes)) {
                  decryptedChanges[field] = {
                    ...change,
                    old: typeof change.old === 'string' ? await decryptData(change.old) : change.old,
                    new: typeof change.new === 'string' ? await decryptData(change.new) : change.new,
                    fieldName: await decryptData(change.fieldName)
                  };
                }
                return { ...activity, changes: decryptedChanges };
              }
              return activity;
            })
          );

          const filteredActivities = fullyDecryptedActivities
            .filter(activity => activity.agentDetails?.id === viewingAgent.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          setAgentActivities(filteredActivities);
          setLoadingActivities(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching activities:', error);
        setLoadingActivities(false);
      }
    };

    fetchActivities();
  }, [viewingAgent]);

  const logAgentActivity = async (
    activity: Omit<AgentActivity, 'id' | 'timestamp'>
  ) => {
    try {
      const adminKey = localStorage.getItem('adminkey');
      if (!adminKey || !activity.agentDetails?.id) return;

      let encryptedLeadDetails = activity.leadDetails;
      if (encryptedLeadDetails) {
        encryptedLeadDetails = {
          name: activity.leadDetails.name
            ? await encryptData(activity.leadDetails.name)
            : null,
          company: activity.leadDetails.company
            ? await encryptData(activity.leadDetails.company)
            : null,
          email: activity.leadDetails.email
            ? await encryptData(activity.leadDetails.email)
            : null,
          phone: activity.leadDetails.phone
            ? await encryptData(activity.leadDetails.phone)
            : null
        };
      }

      let encryptedChanges = activity.changes;
      if (encryptedChanges) {
        const changes: Record<string, any> = {};
        for (const [field, change] of Object.entries(activity.changes)) {
          changes[field] = {
            ...change,
            old:
              typeof change.old === 'string'
                ? await encryptData(change.old)
                : change.old,
            new:
              typeof change.new === 'string'
                ? await encryptData(change.new)
                : change.new,
            fieldName: change.fieldName
              ? await encryptData(change.fieldName)
              : null
          };
        }
        encryptedChanges = changes;
      }

      const activityData = {
        ...activity,
        leadDetails: encryptedLeadDetails,
        changes: encryptedChanges,
        timestamp: new Date().toISOString()
      };

      const activitiesRef = ref(database, `users/${adminKey}/agentActivities`);
      await push(activitiesRef, activityData);
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const filteredAgents = decryptedAgents.filter(agent => {
    return agent?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           agent?.email?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const indexOfLastAgent = currentPage * agentsPerPage;
  const indexOfFirstAgent = indexOfLastAgent - agentsPerPage;
  const currentAgents = filteredAgents.slice(indexOfFirstAgent, indexOfLastAgent);
  const totalPages = Math.ceil(filteredAgents.length / agentsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleDeleteClick = (agent: Agent) => {
    setAgentToDelete(agent);
    setDeleteConfirmationOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!agentToDelete) return;
    
    try {
      const adminKey = localStorage.getItem('adminkey');
      if (!adminKey) {
        toast.error('User not authenticated');
        return;
      }

      const agentsRef = ref(database, `users/${adminKey}/agents`);
      const snapshot = await get(agentsRef);

      if (!snapshot.exists()) {
        toast.error('No agents found');
        return;
      }

      const agentsData = snapshot.val();

      const agentEntry = Object.entries(agentsData).find(
        ([_, value]: [string, any]) => value.id === agentToDelete.id
      );

      if (!agentEntry) {
        toast.error('Agent not found in database');
        return;
      }

      const [firebaseKey, agentData] = agentEntry;

      const agentRef = ref(database, `users/${adminKey}/agents/${firebaseKey}`);
      await remove(agentRef);

      await logAgentActivity({
        action: 'agent_deleted',
        agentDetails: {
          id: agentToDelete.id,
          email: agentData.email || '',
          name: agentData.name || '',
          ipAddress: ''
        },
        changes: {
          status: {
            old: agentData.status || '',
            new: 'deleted',
            fieldName: 'Status',
            changedAt: new Date().toISOString()
          }
        }
      });

      toast.success('Agent removed successfully');
      setViewingAgent(null);
      setDeleteConfirmationOpen(false);
      setAgentToDelete(null);
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to remove agent');
      setDeleteConfirmationOpen(false);
      setAgentToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmationOpen(false);
    setAgentToDelete(null);
  };

  const handleContactAction = async (type: string, agent: Agent) => {
    try {
      await logAgentActivity({
        action: `agent_contacted_${type}`,
        agentDetails: {
          id: agent.id,
          email: agent.email,
          name: agent.name,
          ipAddress: ''
        },
        environment: {
          device: navigator.userAgent,
          location: 'Unknown'
        }
      });

      switch (type) {
        case 'call':
          window.open(`tel:${agent.phone}`, '_blank');
          break;
        case 'email':
          window.open(`mailto:${agent.email}`, '_blank');
          break;
        case 'whatsapp':
          const phoneNumber = agent.phone;
          window.open(`https://wa.me/${phoneNumber}`, '_blank');
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error logging contact activity:', error);
    }
  };

  const handleEdit = (agent: Agent) => {
    const originalAgent = agents.find(a => a.id === agent.id) || agent;
    setEditingAgent(originalAgent);
    setViewingAgent(null);
  };

  const handleAddAgent = async (newAgent: Agent) => {
    try {
      const adminKey = localStorage.getItem('adminkey');
      if (!adminKey) {
        toast.error('User not authenticated');
        return false;
      }

      const encryptedAgent = await encryptAgent({
        ...newAgent,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });

      const agentRef = ref(database, `users/${adminKey}/agents/${newAgent.id}`);
      await set(agentRef, encryptedAgent);

      await logAgentActivity({
        action: 'agent_created',
        agentDetails: {
          id: newAgent.id,
          email: newAgent.email,
          name: newAgent.name,
          ipAddress: ''
        }
      });

      toast.success('Agent added successfully');
      setIsAddingAgent(false);
      return true;
    } catch (error) {
      console.error('Error adding agent:', error);
      toast.error('Failed to add agent');
      return false;
    }
  };

  const handleUpdateAgent = async (updatedAgent: Agent) => {
    try {
      const adminKey = localStorage.getItem('adminkey');
      if (!adminKey) {
        toast.error('User not authenticated');
        return false;
      }

      const agentsRef = ref(database, `users/${adminKey}/agents`);
      const snapshot = await get(agentsRef);

      if (!snapshot.exists()) {
        toast.error('No agents found in database');
        return false;
      }

      const agentsData = snapshot.val();

      const agentEntry = Object.entries(agentsData).find(
        ([_, value]: [string, any]) => value.id === updatedAgent.id
      );

      if (!agentEntry) {
        toast.error('Agent not found for update');
        return false;
      }

      const [firebaseKey, existingAgent] = agentEntry;

      const encryptedAgent = await encryptAgent({
        ...updatedAgent,
        lastUpdated: new Date().toISOString()
      });

      const agentRef = ref(database, `users/${adminKey}/agents/${firebaseKey}`);
      await update(agentRef, encryptedAgent);

      await logAgentActivity({
        action: 'agent_updated',
        agentDetails: {
          id: updatedAgent.id,
          email: updatedAgent.email,
          name: updatedAgent.name,
          ipAddress: ''
        },
        changes: Object.keys(updatedAgent).reduce((acc, key) => {
          if (key !== 'id' && key !== 'lastUpdated' && editingAgent) {
            acc[key] = {
              old: editingAgent[key as keyof Agent] || '',
              new: updatedAgent[key as keyof Agent] || '',
              fieldName: key,
              changedAt: new Date().toISOString()
            };
          }
          return acc;
        }, {} as Record<string, any>)
      });

      toast.success('Agent updated successfully');
      setEditingAgent(null);
      return true;
    } catch (error) {
      console.error('Error updating agent:', error);
      toast.error('Failed to update agent');
      return false;
    }
  };

  const handleCardClick = (agent: Agent) => {
    setViewingAgent(agent);
  };

  const navigateAgent = (direction: 'prev' | 'next') => {
    if (!viewingAgent) return;
    
    const currentIndex = filteredAgents.findIndex(a => a.id === viewingAgent.id);
    if (currentIndex === -1) return;

    if (direction === 'prev' && currentIndex > 0) {
      setViewingAgent(filteredAgents[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < filteredAgents.length - 1) {
      setViewingAgent(filteredAgents[currentIndex + 1]);
    }
  };

  // Function to truncate long text with ellipsis
 const truncateText = (text: string | null | undefined, maxLength: number): string => {
  if (typeof text !== 'string' || !text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

  if (loading || isDecrypting) {
    return <div className="flex justify-center items-center h-64">Loading agents...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <Button 
          onClick={() => setIsAddingAgent(true)}
          className="neuro hover:shadow-none transition-all duration-300"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Agent
        </Button>
        
        <Input
          placeholder="Search agents..."
          className="neuro-inset focus:shadow-none w-full sm:w-[300px]"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredAgents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No agents found</p>
          <Button 
            onClick={() => setIsAddingAgent(true)}
            className="mt-4 neuro hover:shadow-none transition-all duration-300"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Agent
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {currentAgents.map((agent) => (
              <div 
                key={agent.id} 
                className="neuro p-4 space-y-4 cursor-pointer hover:shadow-lg transition-all duration-200"
                onClick={() => handleCardClick(agent)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarImage src={agent.avatar} alt={agent.name} />
                      <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium truncate" title={agent.name}>
                        {truncateText(agent.name, 20)}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate" title={agent.designation}>
                        {truncateText(agent.designation, 25)}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                    agent.status === 'active' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                      : agent.status === 'inactive'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                  }`}>
                    {agent.status === 'on_leave' ? 'On Leave' : agent.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground truncate" title={agent.email}>
                    {truncateText(agent.email, 25)}
                  </p>
                  
                  <p className="text-sm text-muted-foreground truncate" title={agent.phone}>
                    {truncateText(agent.phone, 25)}
                  </p>
                  <br/>
                  {agent.lastLogin && (
                    <p className="text-sm text-black dark:text-white truncate">
                      Last Login: <span className='text-red-500'>{agent.lastLogin}</span>
                    </p>
                  )}
                  {agent.logoutTime && (
                    <p className="text-sm text-black dark:text-white truncate">
                      Last Logout: <span className='text-red-500'>{agent.logoutTime}</span>
                    </p>
                  )}
                </div>

                {agent.assignedLeads && (
                  <div className="pt-2">
                    <p className="text-sm text-muted-foreground truncate">
                      Leads: {agent.assignedLeads.from} - {agent.assignedLeads.to}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {indexOfFirstAgent + 1}-{Math.min(indexOfLastAgent, filteredAgents.length)} of {filteredAgents.length} agents
            </div>
            
            {totalPages > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                  <Button
                    key={number}
                    variant={currentPage === number ? "default" : "outline"}
                    size="sm"
                    onClick={() => paginate(number)}
                    className="h-8 w-8 p-0"
                  >
                    {number}
                  </Button>
                ))}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={!!viewingAgent} onOpenChange={(open) => !open && setViewingAgent(null)}>
        <DialogContent className="sm:max-w-[600px] neuro border-none max-h-[90vh] overflow-y-auto">
          {viewingAgent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="mr-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateAgent('prev');
                      }}
                      disabled={filteredAgents.findIndex(a => a.id === viewingAgent.id) === 0}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <span className="truncate max-w-[200px]" title={viewingAgent.name}>
                      Agent Details
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateAgent('next');
                      }}
                      disabled={filteredAgents.findIndex(a => a.id === viewingAgent.id) === filteredAgents.length - 1}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="activities">
                    <Activity className="h-4 w-4 mr-2" />
                    Activities
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="details">
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                      <Avatar className="h-24 w-24 flex-shrink-0">
                        <AvatarImage src={viewingAgent.avatar} alt={viewingAgent.name} />
                        <AvatarFallback>{viewingAgent.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="text-center sm:text-left min-w-0 flex-1">
                        <h2 className="text-2xl font-bold truncate" title={viewingAgent.name}>
                          {viewingAgent.name}
                        </h2>
                        <p className="text-lg text-muted-foreground truncate" title={viewingAgent.designation}>
                          {viewingAgent.designation}
                        </p>
                        <div className="flex items-center justify-center sm:justify-start mt-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            viewingAgent.status === 'active' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                              : viewingAgent.status === 'inactive'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                          }`}>
                            {viewingAgent.status === 'active' ? (
                              <CheckCircle className="h-4 w-4 mr-1" />
                            ) : viewingAgent.status === 'inactive' ? (
                              <XCircle className="h-4 w-4 mr-1" />
                            ) : (
                              <User className="h-4 w-4 mr-1" />
                            )}
                            {viewingAgent.status === 'on_leave' ? 'On Leave' : viewingAgent.status.charAt(0).toUpperCase() + viewingAgent.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Mail className="h-5 w-5 mr-2 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-muted-foreground">Email</p>
                            <p className="truncate" title={viewingAgent.email}>
                              {viewingAgent.email}
                            </p>
                          </div>
                        </div>
                        {viewingAgent.password && (
                          <div className="flex items-center">
                            <Mail className="h-5 w-5 mr-2 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground">Password</p>
                              <div className="flex items-center">
                                <p className="truncate">
                                  {showPassword ? viewingAgent.password : "••••••••"}
                                </p>
                                <button 
                                  onClick={toggleShowPassword} 
                                  className="ml-2 text-muted-foreground hover:text-foreground flex-shrink-0"
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center">
                          <Smartphone className="h-5 w-5 mr-2 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-muted-foreground">Phone</p>
                            <p className="truncate" title={viewingAgent.phone}>
                              {viewingAgent.phone}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Briefcase className="h-5 w-5 mr-2 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-muted-foreground">Designation</p>
                            <p className="truncate" title={viewingAgent.designation}>
                              {viewingAgent.designation}
                            </p>
                          </div>
                        </div>
                        {viewingAgent.birthDate && (
                          <div className="flex items-center">
                            <Calendar className="h-5 w-5 mr-2 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground">Birth Date</p>
                              <p>{new Date(viewingAgent.birthDate).toLocaleDateString()}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {viewingAgent.assignedLeads && (
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h3 className="font-medium mb-2">Performance</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold truncate">
                              {viewingAgent.assignedLeads.from} - {viewingAgent.assignedLeads.to}
                            </p>
                            <p className="text-sm text-muted-foreground">Assigned Leads Range</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold">
                              {viewingAgent.assignedLeads.to - viewingAgent.assignedLeads.from}
                            </p>
                            <p className="text-sm text-muted-foreground">Total Leads</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold">-</p>
                            <p className="text-sm text-muted-foreground">Conversion Rate</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between space-x-2 pt-4">
                      <Button 
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(viewingAgent);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Agent
                      </Button>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(viewingAgent);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Agent
                        </Button>
                        <div className="flex space-x-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleContactAction('call', viewingAgent);
                            }}
                            title="Call"
                          >
                            <Phone className="h-5 w-5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleContactAction('email', viewingAgent);
                            }}
                            title="Email"
                          >
                            <Mail className="h-5 w-5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleContactAction('whatsapp', viewingAgent);
                            }}
                            title="WhatsApp"
                          >
                            <MessageSquare className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="activities">
                  <div className="space-y-4">
                    <DialogDescription>
                      Recent activities for {viewingAgent.name}
                    </DialogDescription>
                    
                    {loadingActivities ? (
                      <div className="flex justify-center items-center h-32">
                        Loading activities...
                      </div>
                    ) : agentActivities.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No activities found</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {agentActivities.map((activity) => (
                          <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                            <div className="flex-shrink-0 mt-1">
                              {activity.action === 'agent_updated' && <Edit className="h-5 w-5 text-orange-500" />}
                              {activity.action === 'agent_created' && <Plus className="h-5 w-5 text-green-500" />}
                              {activity.action.includes('call') && <Phone className="h-5 w-5 text-blue-500" />}
                              {activity.action.includes('email') && <Mail className="h-5 w-5 text-purple-500" />}
                              {activity.action.includes('whatsapp') && <MessageSquare className="h-5 w-5 text-green-600" />}
                              {activity.action === 'agent_deleted' && <Trash2 className="h-5 w-5 text-red-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <p className="font-medium capitalize truncate">
                                  {activity.action.replace(/_/g, ' ')}
                                </p>
                                <p className="text-sm text-muted-foreground flex-shrink-0 ml-2">
                                  {new Date(activity.timestamp).toLocaleString()}
                                </p>
                              </div>
                              
                              {activity.leadDetails && (
                                <div className="mt-1 text-sm">
                                  <p className="truncate" title={activity.leadDetails.name + (activity.leadDetails.company ? ` (${activity.leadDetails.company})` : '')}>
                                    <span className="font-medium">Lead:</span> {activity.leadDetails.name}
                                    {activity.leadDetails.company && ` (${activity.leadDetails.company})`}
                                  </p>
                                  <p className="text-muted-foreground truncate" title={activity.leadDetails.email}>
                                    {activity.leadDetails.email}
                                  </p>
                                  <p className="text-muted-foreground truncate" title={activity.leadDetails.phone}>
                                    {activity.leadDetails.phone}
                                  </p>
                                </div>
                              )}

                              {activity.changes && (
                                <div className="mt-2 space-y-1">
                                  {Object.entries(activity.changes).map(([field, change]) => (
                                    <div key={field} className="text-sm">
                                      <p className="font-medium truncate">{change.fieldName}:</p>
                                      <div className="flex gap-2">
                                        <span className="text-red-500 line-through truncate" title={change.old}>
                                          {truncateText(change.old, 30)}
                                        </span>
                                        <span>→</span>
                                        <span className="text-green-500 truncate" title={change.new}>
                                          {truncateText(change.new, 30)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {activity.environment && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  <p className="truncate">From: {activity.environment.device.split(' ')[0]}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete agent <strong>{agentToDelete?.name}</strong>? This action cannot be undone and all associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AgentForm 
        isOpen={isAddingAgent} 
        onClose={() => setIsAddingAgent(false)} 
        onSubmit={handleAddAgent} 
      />
      
      <AgentForm 
        isOpen={!!editingAgent} 
        onClose={() => setEditingAgent(null)} 
        onSubmit={handleUpdateAgent} 
        agent={editingAgent || undefined}
      />
    </div>
  );
};