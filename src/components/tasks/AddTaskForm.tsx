import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Agent, Task } from '@/lib/mockData';

// Encryption key - in a real app, this should be securely managed
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8'; // 32 chars for AES-256

interface AddTaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Task) => void;
  task?: Task | null;
  agents: Agent[];
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

// Function to encrypt task values (except id and agentId)
async function encryptTask(task: Task): Promise<Task> {
  const encryptedTask = { ...task };
  
  // Encrypt each field that needs encryption
  encryptedTask.title = await encryptData(task.title);
  encryptedTask.description = await encryptData(task.description);
  encryptedTask.agentName = await encryptData(task.agentName);
  encryptedTask.startDate = await encryptData(task.startDate);
  encryptedTask.endDate = await encryptData(task.endDate);
  encryptedTask.priority = await encryptData(task.priority);
  encryptedTask.status = await encryptData(task.status);
  
  return encryptedTask;
}

// Function to decrypt task values
async function decryptTask(task: Task): Promise<Task> {
  const decryptedTask = { ...task };
  
  // Decrypt each encrypted field
  decryptedTask.title = await decryptData(task.title);
  decryptedTask.description = await decryptData(task.description);
  decryptedTask.agentName = await decryptData(task.agentName);
  decryptedTask.startDate = await decryptData(task.startDate);
  decryptedTask.endDate = await decryptData(task.endDate);
  decryptedTask.priority = await decryptData(task.priority);
  decryptedTask.status = await decryptData(task.status);
  
  return decryptedTask;
}

// Function to decrypt agent data
async function decryptAgent(agent: Agent): Promise<Agent> {
  const decryptedAgent = { ...agent };
  
  // Decrypt each encrypted field
  decryptedAgent.name = await decryptData(agent.name);
  decryptedAgent.email = await decryptData(agent.email);
  decryptedAgent.phone = await decryptData(agent.phone);
  decryptedAgent.designation = await decryptData(agent.designation);
  
  return decryptedAgent;
}

export const AddTaskForm: React.FC<AddTaskFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  task = null,
  agents
}) => {
  const [formData, setFormData] = useState<Task>({
    id: '',
    title: '',
    description: '',
    agentName: '',
    agentId: '',
    startDate: '',
    endDate: '',
    priority: 'medium',
    status: 'pending'
  });
  const [decryptedAgents, setDecryptedAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const initializeForm = async () => {
      setIsLoading(true);
      try {
        // Decrypt all agents first
        const decryptedAgents = await Promise.all(
          agents.map(async agent => await decryptAgent(agent))
        );
        setDecryptedAgents(decryptedAgents);

        if (task) {
          // If we're editing, decrypt and populate the form with the task data
          const decryptedTask = await decryptTask(task);
          setFormData(decryptedTask);
        } else {
          // If we're creating new, reset the form
          setFormData({
            id: '',
            title: '',
            description: '',
            agentName: '',
            agentId: '',
            startDate: '',
            endDate: '',
            priority: 'medium',
            status: 'pending'
          });
        }
      } catch (error) {
        console.error('Decryption failed:', error);
        setDecryptedAgents(agents); // Fallback to original agents if decryption fails
        if (task) {
          setFormData(task); // Fallback to original task if decryption fails
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeForm();
  }, [task, agents]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAgentChange = (agentId: string) => {
    const selectedAgent = decryptedAgents.find(agent => agent.id === agentId);
    if (selectedAgent) {
      setFormData(prev => ({
        ...prev,
        agentId,
        agentName: selectedAgent.name
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Encrypt the form data before submission
      const encryptedTask = await encryptTask(formData);
      
      // Generate ID if it's a new task
      const taskToSubmit = task 
        ? encryptedTask 
        : { ...encryptedTask, id: Date.now().toString() };
      
      onSubmit(taskToSubmit);
    } catch (error) {
      console.error('Encryption failed:', error);
      // Fallback to submitting unencrypted data if encryption fails
      const taskToSubmit = task 
        ? formData 
        : { ...formData, id: Date.now().toString() };
      onSubmit(taskToSubmit);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{task ? 'Edit Task' : 'Add New Task'}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center py-8">
            <p>Loading task data...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Add New Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
            />
          </div>
          
          <div>
            <Label htmlFor="agent">Assign To</Label>
            <Select
              value={formData.agentId}
              onValueChange={handleAgentChange}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {decryptedAgents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                value={formData.endDate}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                name="priority"
                value={formData.priority}
                onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                name="status"
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
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
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Processing...' : task ? 'Update Task' : 'Add Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};