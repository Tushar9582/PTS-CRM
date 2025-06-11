
import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { MeetingsTable } from '@/components/meetings/MeetingsTable';
import { useIsMobile } from '@/hooks/use-mobile';

const Meetings: React.FC = () => {
  const isMobile = useIsMobile();
  
  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Meeting Scheduler</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Schedule and manage meetings with participants.
          </p>
        </div>
        
        <MeetingsTable />
      </div>
    </DashboardLayout>
  );
};

export default Meetings;
