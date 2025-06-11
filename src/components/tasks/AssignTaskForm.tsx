import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { database } from '../../firebase';
import { ref, onValue, set,get } from 'firebase/database';

interface Agent {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
}

interface AssignTaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  task?: any;
  lead?: any;
  isLeadAssignment?: boolean;
}

export const AssignTaskForm: React.FC<AssignTaskFormProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  task, 
  lead,
  isLeadAssignment = false 
}) => {
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    leadRangeStart: '',
    leadRangeEnd: '',
    agentId: '',
    agentName: '',
    assignedDate: new Date().toISOString().split('T')[0],
    status: 'active',
    completion: '0%',
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    priority: 'medium',
  });

  // Fetch agents from Firebase
  useEffect(() => {
    if (!adminId) return;

    const agentsRef = ref(database, `users/${adminId}/agents`);
    
    const unsubscribe = onValue(agentsRef, (snapshot) => {
      const agentsData = snapshot.val();
      if (agentsData) {
        const agentsList = Object.keys(agentsData).map(key => ({
          id: key,
          ...agentsData[key]
        })).filter(agent => agent.status === 'active');
        setAgents(agentsList);
      }
    });

    return () => unsubscribe();
  }, [adminId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSelectChange = (field: string, value: string) => {
    if (field === 'agentId') {
      const selectedAgent = agents.find(agent => agent.id === value);
      setFormData({
        ...formData,
        agentId: value,
        agentName: selectedAgent?.name || '',
      });
    } else {
      setFormData({
        ...formData,
        [field]: value,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.agentId) {
        alert('Please select an agent');
        return;
      }

      if (isLeadAssignment) {
        // Prepare lead range data to merge with agent data
        const agentUpdates = {
          from: formData.leadRangeStart,
          to: formData.leadRangeEnd,
          assignedDate: formData.assignedDate,
          leadStatus: formData.status,
          completion: formData.completion,
          assignedBy: adminId || agentId,
          assignedAt: new Date().toISOString()
        };

        // Update the agent's node directly with lead range data
        const agentRef = ref(database, `users/${adminId}/agents/${formData.agentId}`);
        
        // Get current agent data first
        const agentSnapshot = await get(agentRef);
        const currentAgentData = agentSnapshot.val() || {};
        
        // Merge new lead range data with existing agent data
        const updatedAgentData = {
          ...currentAgentData,
          ...agentUpdates
        };

        // Update the agent node
        await set(agentRef, updatedAgentData);

        // Call the onSubmit callback with the lead data
        onSubmit({
          ...agentUpdates,
          agentId: formData.agentId,
          agentName: formData.agentName
        });
      } else {
        // Task assignment logic remains the same
        const newTask = {
          id: task?.id || `task-${Date.now()}`,
          title: formData.title,
          description: formData.description,
          agentId: formData.agentId,
          agentName: formData.agentName,
          startDate: formData.startDate,
          endDate: formData.endDate,
          status: formData.status,
          priority: formData.priority,
          createdBy: adminId || agentId,
          createdAt: new Date().toISOString()
        };

        // Store task under the agent
        const agentTaskRef = ref(database, `users/${adminId}/agents/${formData.agentId}/tasks/${newTask.id}`);
        await set(agentTaskRef, newTask);

        onSubmit(newTask);
      }
    } catch (error) {
      console.error('Error assigning:', error);
      alert('Failed to assign. Please try again.');
    } finally {
      setLoading(false);
      onClose();
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] neuro border-none">
        <DialogHeader>
          <DialogTitle>
            {isLeadAssignment 
              ? (lead ? 'Reassign Lead Range' : 'Assign New Lead Range') 
              : (task ? 'Edit Task Assignment' : 'Assign New Task')}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {isLeadAssignment ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leadRangeStart">Lead Range Start</Label>
                  <Input
                    id="leadRangeStart"
                    name="leadRangeStart"
                    type="number"
                    className="neuro-inset focus:shadow-none"
                    value={formData.leadRangeStart}
                    onChange={handleChange}
                    required
                    placeholder="e.g. 001"
                    min="1"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="leadRangeEnd">Lead Range End</Label>
                  <Input
                    id="leadRangeEnd"
                    name="leadRangeEnd"
                    type="number"
                    className="neuro-inset focus:shadow-none"
                    value={formData.leadRangeEnd}
                    onChange={handleChange}
                    required
                    placeholder="e.g. 050"
                    min={formData.leadRangeStart || 1}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="agent">Assign To</Label>
                <Select 
                  value={formData.agentId}
                  onValueChange={(value) => handleSelectChange('agentId', value)}
                  required
                >
                  <SelectTrigger className="neuro-inset focus:shadow-none">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="assignedDate">Assigned Date</Label>
                <Input
                  id="assignedDate"
                  name="assignedDate"
                  type="date"
                  className="neuro-inset focus:shadow-none"
                  value={formData.assignedDate}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={formData.status}
                  onValueChange={(value) => handleSelectChange('status', value)}
                >
                  <SelectTrigger className="neuro-inset focus:shadow-none">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Task Title</Label>
                <Input
                  id="title"
                  name="title"
                  className="neuro-inset focus:shadow-none"
                  value={formData.title}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Task Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  className="neuro-inset focus:shadow-none"
                  value={formData.description}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="agent">Assign To</Label>
                <Select 
                  defaultValue={formData.agentId}
                  onValueChange={(value) => handleSelectChange('agentId', value)}
                >
                  <SelectTrigger className="neuro-inset focus:shadow-none">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockAgents.filter(a => a.status === 'active').map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    className="neuro-inset focus:shadow-none"
                    value={formData.startDate}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    name="endDate"
                    type="date"
                    className="neuro-inset focus:shadow-none"
                    value={formData.endDate}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select 
                    defaultValue={formData.priority}
                    onValueChange={(value) => handleSelectChange('priority', value)}
                  >
                    <SelectTrigger className="neuro-inset focus:shadow-none">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    defaultValue={formData.status}
                    onValueChange={(value) => handleSelectChange('status', value)}
                  >
                    <SelectTrigger className="neuro-inset focus:shadow-none">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
          
          <DialogFooter>
            <Button 
              type="button"
              variant="outline"
              onClick={onClose}
              className="neuro hover:shadow-none transition-all duration-300"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="neuro hover:shadow-none transition-all duration-300"
            >
              {isLeadAssignment 
                ? (lead ? 'Update Lead Assignment' : 'Assign Lead Range') 
                : (task ? 'Update Task' : 'Assign Task')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};