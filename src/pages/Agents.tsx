
import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { AgentCards } from '@/components/agents/AgentCards';
import { AuthLayout } from '@/components/AuthLayout';

const Agents: React.FC = () => {
  return (
    <AuthLayout requiredRole="admin">
      <DashboardLayout>
        <div className="space-y-6 w-full max-w-full overflow-hidden">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Agent Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Add, remove, and manage your team of agents.
            </p>
          </div>
          
          <AgentCards />
        </div>
      </DashboardLayout>
    </AuthLayout>
  );
};

export default Agents;
