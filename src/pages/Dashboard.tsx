import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { ChartSelector } from '@/components/dashboard/ChartSelector';
import { ActionCards } from '@/components/dashboard/ActionCards';
import { FileText, Users, Phone, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { EnhancedCalendar } from '@/components/dashboard/EnhancedCalendar';
import { getDatabase, ref, onValue, update, get } from 'firebase/database';
import { isToday, isAfter, parseISO, startOfToday } from 'date-fns';
import { database, auth } from '../firebase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PlanModal from '@/pages/PlanModel';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

// Encryption key - should match your encryption key
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8'; // 32 chars for AES-256

interface Meeting {
  id: string;
  startDate: string;
  title: string;
  time?: string;
  leadName?: string;
  status?: string;
}

// Helper function to decrypt data using Web Crypto API
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

// Function to decrypt a meeting object
async function decryptMeeting(encryptedMeeting: any): Promise<Meeting> {
  const decryptedMeeting: Meeting = {
    id: encryptedMeeting.id,
    startDate: await decryptData(encryptedMeeting.startDate),
    title: await decryptData(encryptedMeeting.title),
  };

  // Decrypt optional fields if they exist
  if (encryptedMeeting.time) {
    decryptedMeeting.time = await decryptData(encryptedMeeting.time);
  }
  if (encryptedMeeting.leadName) {
    decryptedMeeting.leadName = await decryptData(encryptedMeeting.leadName);
  }
  if (encryptedMeeting.status) {
    decryptedMeeting.status = await decryptData(encryptedMeeting.status);
  }
  
  return decryptedMeeting;
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
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [trialEndTime, setTrialEndTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey') || user?.uid;
  const userId = isAdmin ? adminId : agentId;
  const navigate = useNavigate();

  useEffect(() => {
    const agentId = localStorage.getItem('agentKey');
    const adminId = localStorage.getItem('adminKey');
  
    const handleLogoutTime = async () => {
      if (!agentId || !adminId) return;
  
      const logoutRef = ref(database, `users/${adminId}/agents/${agentId}`);
      const now = new Date().toLocaleString();
      try {
        await update(logoutRef, {
          logoutTime: now
        });
      } catch (error) {
        console.error('Failed to update logout time:', error);
      }
    };
  
    window.addEventListener('beforeunload', handleLogoutTime);
  
    return () => {
      window.removeEventListener('beforeunload', handleLogoutTime);
    };
  }, []);

  // Check trial status on component mount
  useEffect(() => {
    const checkTrialStatus = async () => {
      if (!adminId) return;
      
      try {
        const userRef = ref(database, `users/${adminId}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          const userData = snapshot.val();
          const trialEnd = userData.trialEnd;
          
          if (trialEnd) {
            setTrialEndTime(trialEnd);
            
            // Calculate time remaining for trial
            const calculateTimeRemaining = () => {
              const now = Date.now();
              const remaining = trialEnd - now;
              
              if (remaining <= 0) {
                setTimeRemaining('Trial expired');
                setShowPlanModal(true);
                return;
              }
              
              const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
              const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              
              setTimeRemaining(`${days}d ${hours}h remaining`);
              
              // Check if trial has ended
              if (remaining <= 0) {
                setShowPlanModal(true);
              }
            };
            
            // Calculate immediately
            calculateTimeRemaining();
            
            // Set up interval to check every hour
            const interval = setInterval(calculateTimeRemaining, 60 * 60 * 1000);
            
            return () => clearInterval(interval);
          }
        }
      } catch (error) {
        console.error('Error checking trial status:', error);
      }
    };
    
    checkTrialStatus();
  }, [adminId]);

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
        // Decrypt all meetings in parallel
        const decryptedMeetings = await Promise.all(
          Object.entries(meetingsData).map(async ([meetingId, encryptedMeeting]: any) => {
            try {
              const decrypted = await decryptMeeting({
                id: meetingId,
                ...encryptedMeeting
              });
              return decrypted;
            } catch (error) {
              console.error(`Error decrypting meeting ${meetingId}:`, error);
              return null;
            }
          })
        );
  
        // Process decrypted meetings
        decryptedMeetings.forEach((meeting) => {
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

      allLeads.sort((a, b) => {
        const aDate = leadsData[a.id]?.createdAt ? new Date(leadsData[a.id].createdAt).getTime() : 0;
        const bDate = leadsData[b.id]?.createdAt ? new Date(leadsData[b.id].createdAt).getTime() : 0;
        return aDate - bDate;
      });

      if (isAdmin) {
        setStats(prev => ({ ...prev, totalLeads: allLeads.length }));
      } else {
        if (!agentId) return;

        const agentRef = ref(database, `users/${adminId}/agents/${agentId}`);
        onValue(agentRef, (agentSnapshot) => {
          const agentData = agentSnapshot.val();
          const fromPosition = parseInt(agentData?.from || '0');
          const toPosition = parseInt(agentData?.to || '0');
          const safeFrom = Math.max(1, fromPosition);
          const safeTo = Math.min(allLeads.length, toPosition);
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
        // Decrypt leads in parallel
        const decryptedLeads = await Promise.all(
          Object.values(leadsData).map(async (lead: any) => {
            try {
              const decryptedLead = {
                ...lead,
                scheduledCall: lead.scheduledCall ? await decryptData(lead.scheduledCall) : null
              };
              return decryptedLead;
            } catch (error) {
              console.error('Error decrypting lead:', error);
              return lead;
            }
          })
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

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Overview</h1>
            {timeRemaining && (
              <p className="text-sm text-blue-600 mt-1">
                Free trial: {timeRemaining}
              </p>
            )}
          </div>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
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

      {/* Plan Modal - Blocks all interaction when trial expires */}
      <PlanModal 
        isOpen={showPlanModal}
        onClose={() => {
          handleSignOut();
        }}
        trialEndTime={trialEndTime || 0}
        isBlocking={true} // This prop should prevent closing the modal
      />
    </DashboardLayout>
  );
};

export default Dashboard;