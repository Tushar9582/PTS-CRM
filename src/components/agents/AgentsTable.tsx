import React, { useState, useEffect } from 'react';
import { Phone, Mail, MessageSquare, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Agent } from '@/lib/mockData';
import { AgentForm } from './AgentForm';
import { ref, onValue, update, remove } from 'firebase/database';
import { database } from '../../firebase';

export const AgxtsTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [isEditingAgent, setIsEditingAgent] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adminUid, setAdminUid] = useState<string | null>(null);

  // Get admin UID from localStorage
  useEffect(() => {
    const uid = localStorage.getItem('adminkey');
    setAdminUid(uid);
  }, []);

  // Fetch agents from Firebase
  useEffect(() => {
    if (!adminUid) return;

    const agentsRef = ref(database, `admins/${adminUid}/agents`);
    const unsubscribe = onValue(agentsRef, (snapshot) => {
      const agentsData = snapshot.val();
      if (agentsData) {
        const agentsArray = Object.keys(agentsData).map(key => ({
          id: key,
          ...agentsData[key]
        }));
        setAgents(agentsArray);
      } else {
        setAgents([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [adminUid]);

  const filteredAgents = agents.filter(agent => {
    return agent?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           agent?.email?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleDelete = async (id: string) => {
    if (!adminUid) {
      toast.error('Admin not authenticated');
      return;
    }

    try {
      const agentRef = ref(database, `admins/${adminUid}/agents/${id}`);
      await remove(agentRef);
      toast.success('Agent deleted successfully');
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete agent');
    }
  };

  const handleAddAgent = (newAgent: Agent) => {
    setAgents(prev => [newAgent, ...prev]);
    setIsAddingAgent(false);
  };

  const handleEditAgent = (agent: Agent) => {
    setCurrentAgent(agent);
    setIsEditingAgent(true);
  };

  const handleUpdateAgent = async (updatedAgent: Agent) => {
    if (!adminUid) {
      toast.error('Admin not authenticated');
      return;
    }

    try {
      const agentRef = ref(database, `admins/${adminUid}/agents/${updatedAgent.id}`);
      await update(agentRef, updatedAgent);
      toast.success('Agent updated successfully');
      setIsEditingAgent(false);
      setCurrentAgent(null);
    } catch (error) {
      console.error('Error updating agent:', error);
      toast.error('Failed to update agent');
    }
  };

  const handleAction = (type: string, agent: Agent) => {
    switch (type) {
      case 'call':
        window.open(`tel:${agent.phone}`, '_blank');
        break;
      case 'email':
        window.open(`mailto:${agent.email}`, '_blank');
        break;
      case 'whatsapp':
        window.open(`https://wa.me/${agent.phone}`, '_blank');
        break;
      default:
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions and Search */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <Button 
          onClick={() => setIsAddingAgent(true)}
          className="neuro hover:shadow-none transition-all duration-300"
        >
          Add Agent
        </Button>
        
        <Input
          placeholder="Search agents..."
          className="neuro-inset focus:shadow-none w-full sm:w-[300px]"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Agents Table */}
      <div className="overflow-auto neuro">
        {filteredAgents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {searchTerm ? 'No agents match your search' : 'No agents found'}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Role</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Leads</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Joined</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAgents.map((agent) => (
                <tr key={agent.id} className="hover:bg-muted/20">
                  <td className="p-3">
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">{agent.email}</p>
                    </div>
                  </td>
                  <td className="p-3 capitalize">{agent.designation}</td>
                  <td className="p-3">{agent.assignedLeads}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      agent.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                    }`}>
                      {agent.status}
                    </span>
                  </td>
                  <td className="p-3">{agent.createdAt}</td>
                  <td className="p-3">
                    <div className="flex space-x-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleAction('call', agent)}
                        title="Call"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleAction('email', agent)}
                        title="Email"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleAction('whatsapp', agent)}
                        title="WhatsApp"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleEditAgent(agent)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(agent.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Agent Form Dialogs */}
      <AgentForm 
        isOpen={isAddingAgent} 
        onClose={() => setIsAddingAgent(false)} 
        onSubmit={handleAddAgent} 
      />
      
      <AgentForm 
        isOpen={isEditingAgent} 
        onClose={() => {
          setIsEditingAgent(false);
          setCurrentAgent(null);
        }} 
        onSubmit={handleUpdateAgent}
        agent={currentAgent}
      />
    </div>
  );
};