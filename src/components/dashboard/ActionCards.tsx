
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, FileText, Users } from 'lucide-react';

export const ActionCards: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    {
      title: 'Schedule Meeting',
      description: 'Create a new meeting with agents',
      icon: Calendar,
      onClick: () => navigate('/meetings'),
      color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
    },
    {
      title: 'Add Lead',
      description: 'Register a new potential customer',
      icon: FileText,
      onClick: () => navigate('/leads'),
      color: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
    },
    {
      title: 'Manage Agents',
      description: 'View and manage your team',
      icon: Users,
      onClick: () => navigate('/agents'),
      color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {actions.map((action, index) => (
        <div key={index} className="neuro p-6 flex flex-col">
          <div className={`rounded-full w-12 h-12 flex items-center justify-center mb-4 ${action.color}`}>
            <action.icon className="h-6 w-6" />
          </div>
          
          <h3 className="text-lg font-semibold mb-1">{action.title}</h3>
          <p className="text-muted-foreground text-sm mb-4">{action.description}</p>
          
          <Button 
            onClick={action.onClick}
            variant="outline" 
            className="mt-auto neuro hover:shadow-none transition-all duration-300"
          >
            Get Started
          </Button>
        </div>
      ))}
    </div>
  );
};
