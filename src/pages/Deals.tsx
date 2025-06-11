
import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DealsTable } from '@/components/deals/DealsTable';

const Deals: React.FC = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6 w-full max-w-full overflow-x-hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Deal Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Track and manage your sales pipeline and deals.
          </p>
        </div>
        
        <DealsTable />
      </div>
    </DashboardLayout>
  );
};

export default Deals;
