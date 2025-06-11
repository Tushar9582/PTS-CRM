import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { ChartSelector } from '@/components/dashboard/ChartSelector';
import { ActionCards } from '@/components/dashboard/ActionCards';
import { FileText, Users, Phone, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { EnhancedCalendar } from '@/components/dashboard/EnhancedCalendar';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { isToday, isAfter, parseISO, startOfToday } from 'date-fns';
import { database } from '../firebase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { decryptObject } from '@/lib/utils';

interface Meeting {
  id: string;
  startDate: string;
  title: string;
  time?: string;
  leadName?: string;
  status?: string;
}

const Dashboard: React.FC = () => {
  
  const { isAdmin, user } = useAuth();
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalAgents: 0,
    todaysCalls: 0,
    upcomingCalls: 0,
    todaysMeetings: 0,
    upcomingMeetings: 0,
  });
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey') || user?.uid;
  const userId = isAdmin ? adminId : agentId;
  useEffect(() => {
    const agentId = localStorage.getItem('agentKey');
    const adminId = localStorage.getItem('adminKey');
  
    const handleLogoutTime = async () => {
      if (!agentId || !adminId) return;
  
      const logoutRef = ref(database, `users/${adminId}/agents/${agentId}`);
      const now = new Date().toLocaleString(); // or toISOString()
      try {
        await update(logoutRef, {
          logoutTime: now
        });
      } catch (error) {
        console.error('Failed to update logout time:', error);
      }
    };
  
    // Fires on tab close or browser refresh
    window.addEventListener('beforeunload', handleLogoutTime);
  
    return () => {
      window.removeEventListener('beforeunload', handleLogoutTime);
    };
  }, []);
  

  const fetchMeetings = () => {
    if (!adminId) return;
  
    let meetingsRef;
  
    if (isAdmin) {
      meetingsRef = ref(database, `users/${adminId}/meetingdetails`);
    } else {
      if (!agentId) return;
      meetingsRef = ref(database, `users/${adminId}/agents/${agentId}/meetingdetails`);
    }
  
    onValue(meetingsRef, async (snapshot) => {
      const meetingsData = snapshot.val();
      let todaysCount = 0;
      let upcomingCount = 0;
      const meetingsList: Meeting[] = [];
      const today = startOfToday();
  
      if (meetingsData) {
        const meetingEntries = await Promise.all(
          Object.entries(meetingsData).map(async ([meetingId, encryptedMeeting]: any) => {
            try {
              const decryptedMeeting = await decryptObject(encryptedMeeting);
              return { id: meetingId, ...decryptedMeeting };
            } catch (err) {
              console.error("Decryption failed for meeting:", meetingId, err);
              return null;
            }
          })
        );
  
        meetingEntries.forEach((meeting) => {
          if (meeting && meeting.startDate) {
            try {
              const meetingDate = parseISO(meeting.startDate);
              meetingsList.push(meeting);
  
              if (isToday(meetingDate)) {
                todaysCount++;
              } else if (isAfter(meetingDate, today)) {
                upcomingCount++;
              }
            } catch (error) {
              console.error("Error parsing meeting date:", meeting.startDate, error);
            }
          }
        });
      }
  
      setMeetings(meetingsList);
      setStats(prev => ({
        ...prev,
        todaysMeetings: todaysCount,
        upcomingMeetings: upcomingCount,
      }));
    }, (error) => {
      console.error("Error fetching meetings:", error);
    });
  };

  const fetchLeadsData = () => {
    if (!adminId) return;

    const leadsRef = ref(database, `users/${adminId}/leads`);
    
    onValue(leadsRef, (snapshot) => {
      const leadsData = snapshot.val();
      const allLeads: {id: string}[] = [];
      
      if (leadsData) {
        Object.keys(leadsData).forEach((pushKey) => {
          allLeads.push({ id: pushKey });
        });
      }

      // Sort by creation date (assuming createdAt exists)
      allLeads.sort((a, b) => {
        const aDate = leadsData[a.id]?.createdAt ? new Date(leadsData[a.id].createdAt).getTime() : 0;
        const bDate = leadsData[b.id]?.createdAt ? new Date(leadsData[b.id].createdAt).getTime() : 0;
        return aDate - bDate;
      });

      if (isAdmin) {
        // Admin sees all leads
        setStats(prev => ({ ...prev, totalLeads: allLeads.length }));
      } else {
        // Agent sees sliced leads
        if (!agentId) return;

        const agentRef = ref(database, `users/${adminId}/agents/${agentId}`);
        onValue(agentRef, (agentSnapshot) => {
          const agentData = agentSnapshot.val();
          
          // Get the position range (1-based index)
          const fromPosition = parseInt(agentData?.from || '0');
          const toPosition = parseInt(agentData?.to || '0');
          
          // Validate range
          const safeFrom = Math.max(1, fromPosition);
          const safeTo = Math.min(allLeads.length, toPosition);
          
          // Slice the array (using 0-based index)
          const slicedLeads = allLeads.slice(safeFrom - 1, safeTo);
          
          setStats(prev => ({ ...prev, totalLeads: slicedLeads.length }));
        });
      }
    });
  };

  const fetchAgentsData = () => {
    if (!isAdmin || !adminId) return;

    const agentsRef = ref(database, `users/${adminId}/agents`);
    onValue(agentsRef, (snapshot) => {
      const agentsData = snapshot.val();
      setStats(prev => ({ 
        ...prev, 
        totalAgents: agentsData ? Object.keys(agentsData).length : 0 
      }));
    });
  };
  const fetchCallsData = () => {
    if (!adminId) return;
  
    const leadsRef = ref(database, `users/${adminId}/leads`);
  
    onValue(leadsRef, async (snapshot) => {
      const leadsData = snapshot.val();
      let todaysCalls = 0;
      let upcomingCalls = 0;
      const today = startOfToday();
  
      if (leadsData) {
        const decryptedLeads = await Promise.all(
          Object.values(leadsData).map((lead: any) => decryptObject(lead))
        );
  
        decryptedLeads.forEach((lead: any) => {
          if (lead.scheduledCall) {
            try {
              const callDate = parseISO(lead.scheduledCall);
  
              if (isToday(callDate)) {
                todaysCalls++;
              } else if (isAfter(callDate, today)) {
                upcomingCalls++;
              }
            } catch (error) {
              console.error("Error parsing call date:", lead.scheduledCall, error);
            }
          }
        });
  
        setStats(prev => ({
          ...prev,
          todaysCalls,
          upcomingCalls,
        }));
      }
    });
  };
  const fetchData = () => {
    setLoading(true);
    setRefreshing(true);
    setMeetings([]);

    fetchLeadsData();
    if (isAdmin) fetchAgentsData();
    fetchCallsData();
    fetchMeetings();

    setTimeout(() => {
      setLoading(false);
      setRefreshing(false);
    }, 500);
  };

  useEffect(() => {
    fetchData();

    return () => {
      // Clean up Firebase listeners if needed
    };
  }, [userId, isAdmin, adminId, agentId]);

  const handleRefresh = () => {
    fetchData();
  };

  const handleCalendarEventClick = (meetingId: string) => {
    console.log('Meeting clicked:', meetingId);
    // Implement navigation or modal logic here
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard Overview</h1>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard 
                title="Total Leads" 
                value={stats.totalLeads}
                icon={<FileText className="h-5 w-5" />}
                trend={{ value: 12, positive: true }}
              />
              
              {isAdmin && (
                <StatCard 
                  title="Total Agents" 
                  value={stats.totalAgents}
                  icon={<Users className="h-5 w-5" />}
                />
              )}
              
              <StatCard 
                title="Today's Calls" 
                value={stats.todaysCalls}
                icon={<Phone className="h-5 w-5" />}
              />
              
              <StatCard 
                title="Upcoming Calls" 
                value={stats.upcomingCalls}
                icon={<Phone className="h-5 w-5" />}
              />
              
              <StatCard 
                title="Today's Meetings" 
                value={stats.todaysMeetings}
                icon={<CalendarIcon className="h-5 w-5" />}
              />
              
              <StatCard 
                title="Upcoming Meetings" 
                value={stats.upcomingMeetings}
                icon={<CalendarIcon className="h-5 w-5" />}
                trend={{ value: stats.upcomingMeetings, positive: true }}
              />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ChartSelector 
                className="lg:col-span-2" 
                leadsCount={stats.totalLeads}
                callsCount={stats.todaysCalls + stats.upcomingCalls}
                meetingsCount={stats.todaysMeetings + stats.upcomingMeetings}
              />
              <EnhancedCalendar 
                meetings={meetings}
                onEventClick={handleCalendarEventClick}
              />
            </div>
            
            <ActionCards 
              recentLeadsCount={Math.min(5, stats.totalLeads)}
              upcomingCallsCount={stats.upcomingCalls}
              upcomingMeetingsCount={stats.upcomingMeetings}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;