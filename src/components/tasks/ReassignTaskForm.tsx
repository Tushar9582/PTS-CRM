
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Task, mockAgents } from '@/lib/mockData';

interface ReassignTaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Task) => void;
  task: Task | null;
}

export const ReassignTaskForm: React.FC<ReassignTaskFormProps> = ({ isOpen, onClose, onSubmit, task }) => {
  const [formData, setFormData] = useState({
    agentId: '',
    agentName: '',
    leadRangeStart: '1',
    leadRangeEnd: '10',
    title: 'Process Lead Range',
    description: 'Process assigned leads according to sales process',
  });

  const handleSelectChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value,
    });

    if (field === 'agentId') {
      const selectedAgent = mockAgents.find(agent => agent.id === value);
      if (selectedAgent) {
        setFormData(prev => ({
          ...prev,
          agentName: selectedAgent.name,
        }));
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 7); // Default to 1 week later
    
    const newTask: Task = {
      id: task?.id || `task-${Date.now()}`,
      title: `Process Leads ${formData.leadRangeStart}-${formData.leadRangeEnd}`,
      description: `Process leads numbered ${formData.leadRangeStart} through ${formData.leadRangeEnd}`,
      agentId: formData.agentId,
      agentName: formData.agentName,
      startDate: today.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      status: 'pending',
      priority: 'medium',
    };
    
    onSubmit(newTask);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] neuro border-none">
        <DialogHeader>
          <DialogTitle>Assign Lead Range to Agent</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="agent">Select Agent</Label>
            <Select 
              value={formData.agentId}
              onValueChange={(value) => handleSelectChange('agentId', value)}
              required
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
              <Label htmlFor="leadRangeStart">From Lead #</Label>
              <Input
                id="leadRangeStart"
                name="leadRangeStart"
                type="number"
                className="neuro-inset focus:shadow-none"
                value={formData.leadRangeStart}
                onChange={handleChange}
                min="1"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="leadRangeEnd">To Lead #</Label>
              <Input
                id="leadRangeEnd"
                name="leadRangeEnd"
                type="number"
                className="neuro-inset focus:shadow-none"
                value={formData.leadRangeEnd}
                onChange={handleChange}
                min={Number(formData.leadRangeStart) + 1}
                required
              />
            </div>
          </div>
          
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
              disabled={!formData.agentId}
            >
              Assign Lead Range
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
