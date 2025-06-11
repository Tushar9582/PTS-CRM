
import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { useIsMobile } from '@/hooks/use-mobile';

const Leads: React.FC = () => {
  const isMobile = useIsMobile();
  
  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Lead Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            View, manage, and track all your leads in one place.
          </p>
        </div>
        
        <LeadsTable />
      </div>
    </DashboardLayout>
  );
};

export default Leads;
