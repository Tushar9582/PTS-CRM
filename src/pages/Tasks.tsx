
import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { TasksTable } from '@/components/tasks/TasksTable';
import { useIsMobile } from '@/hooks/use-mobile';

const Tasks: React.FC = () => {
  const isMobile = useIsMobile();
  
  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Task Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Assign and track tasks for your team.
          </p>
        </div>
        
        <TasksTable />
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
