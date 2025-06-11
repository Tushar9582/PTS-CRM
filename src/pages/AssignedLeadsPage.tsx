import { DashboardLayout } from '@/components/DashboardLayout';
import { AssignLeads } from '../components/AssignLeads';

const AssignedLeadsPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6 w-full max-w-full overflow-x-hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Lead Assignment</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage and assign lead ranges to your team members
          </p>
        </div>
        <AssignLeads />
      </div>
    </DashboardLayout>
  );
};

export default AssignedLeadsPage;