import React, { useState, useEffect } from 'react';
import { format, startOfToday, eachDayOfInterval, endOfMonth, startOfMonth, isToday, isSameMonth, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '@/context/AuthContext';

// Encryption key - should match the one used in your encryption process
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8'; // 32 chars for AES-256

interface Meeting {
  id: string;
  startDate: string;
  startTime?: string;
  duration?: string;
  title: string;
  description?: string;
  status?: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  location?: string;
  participants?: string[];
}

interface Agent {
  id: string;
  name: string;
  // lastName: string;
  email: string;
  phone?: string;
  status: string;
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

// Function to decrypt an entire meeting object
async function decryptMeeting(encryptedMeeting: any): Promise<Meeting> {
  const decryptedMeeting: Meeting = {
    id: encryptedMeeting.id,
    startDate: await decryptData(encryptedMeeting.startDate),
    title: await decryptData(encryptedMeeting.title),
  };

  // Decrypt optional fields if they exist
  if (encryptedMeeting.startTime) {
    decryptedMeeting.startTime = await decryptData(encryptedMeeting.startTime);
  }
  if (encryptedMeeting.duration) {
    decryptedMeeting.duration = await decryptData(encryptedMeeting.duration);
  }
  if (encryptedMeeting.description) {
    decryptedMeeting.description = await decryptData(encryptedMeeting.description);
  }
  if (encryptedMeeting.status) {
    decryptedMeeting.status = await decryptData(encryptedMeeting.status) as Meeting['status'];
  }
  if (encryptedMeeting.location) {
    decryptedMeeting.location = await decryptData(encryptedMeeting.location);
  }
  if (encryptedMeeting.participants) {
    decryptedMeeting.participants = await Promise.all(
      encryptedMeeting.participants.map((p: string) => decryptData(p))
    );
  }

  return decryptedMeeting;
}

// Function to decrypt an agent object
async function decryptAgent(encryptedAgent: any): Promise<Agent> {
  const decryptedAgent: Agent = {
    id: encryptedAgent.id,
    name: await decryptData(encryptedAgent.name),
    // lastName: await decryptData(encryptedAgent.lastName),
    email: await decryptData(encryptedAgent.email),
    status: await decryptData(encryptedAgent.status),
  };

  if (encryptedAgent.phone) {
    decryptedAgent.phone = await decryptData(encryptedAgent.phone);
  }

  return decryptedAgent;
}

export const EnhancedCalendar: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey') || user?.uid;
  
  const today = startOfToday();
  const [currentMonth, setCurrentMonth] = useState(today);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showMeetings, setShowMeetings] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [agents, setAgents] = useState<Record<string, Agent>>({});
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(false);

  useEffect(() => {
    if (!adminId) return;

    // Fetch agents first
    const fetchAgents = async () => {
      const agentsRef = ref(database, `users/${adminId}/agents`);
      const unsubscribe = onValue(agentsRef, async (snapshot) => {
        setDecrypting(true);
        try {
          const agentsData = snapshot.val();
          const agentsMap: Record<string, Agent> = {};

          if (agentsData) {
            // Process all agents in parallel
            const decryptedAgents = await Promise.all(
              Object.entries(agentsData).map(async ([id, encryptedAgent]: [string, any]) => {
                try {
                  const decrypted = await decryptAgent({
                    id,
                    ...encryptedAgent
                  });
                  return decrypted;
                } catch (error) {
                  console.error(`Error decrypting agent ${id}:`, error);
                  return null;
                }
              })
            );

            // Add to map
            decryptedAgents.forEach(agent => {
              if (agent) {
                agentsMap[agent.id] = agent;
              }
            });
          }

          setAgents(agentsMap);
        } catch (error) {
          console.error('Error processing agents:', error);
        } finally {
          setDecrypting(false);
        }
      }, (error) => {
        console.error('Error fetching agents:', error);
        setDecrypting(false);
      });

      return () => unsubscribe();
    };

    // Then fetch meetings
    const fetchMeetings = async () => {
      let meetingsRef;
      if (isAdmin) {
        meetingsRef = ref(database, `users/${adminId}/meetingdetails`);
      } else if (agentId) {
        meetingsRef = ref(database, `users/${adminId}/agents/${agentId}/meetingdetails`);
      } else {
        return;
      }

      const unsubscribe = onValue(meetingsRef, async (snapshot) => {
        setLoading(true);
        setDecrypting(true);
        
        try {
          const meetingsData = snapshot.val();
          const meetingsList: Meeting[] = [];

          if (meetingsData) {
            // Process all meetings in parallel
            const decryptedMeetings = await Promise.all(
              Object.entries(meetingsData).map(async ([id, encryptedMeeting]: [string, any]) => {
                try {
                  const decrypted = await decryptMeeting({
                    id,
                    ...encryptedMeeting
                  });
                  return decrypted;
                } catch (error) {
                  console.error(`Error decrypting meeting ${id}:`, error);
                  return null;
                }
              })
            );

            // Filter out any failed decryptions and add to list
            decryptedMeetings.forEach(meeting => {
              if (meeting && meeting.startDate) {
                meetingsList.push(meeting);
              }
            });
          }

          setMeetings(meetingsList);
        } catch (error) {
          console.error('Error processing meetings:', error);
        } finally {
          setLoading(false);
          setDecrypting(false);
        }
      }, (error) => {
        console.error('Error fetching meetings:', error);
        setLoading(false);
        setDecrypting(false);
      });

      return () => unsubscribe();
    };

    fetchAgents();
    fetchMeetings();
  }, [adminId, agentId, isAdmin]);

  const firstDayOfMonth = startOfMonth(currentMonth);
  const lastDayOfMonth = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const getMeetingsForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return meetings.filter(meeting => meeting.startDate === dateString);
  };

  const handleDayClick = (date: Date) => {
    const meetings = getMeetingsForDate(date);
    if (meetings.length > 0) {
      setSelectedDate(date);
      setShowMeetings(true);
    }
  };

  const getParticipantNames = (participantIds: string[] = []) => {
    return participantIds
      .map(id => {
        const agent = agents[id];
        return agent ? `${agent.name} ` : 'Unknown';
      })
      .filter(name => name !== 'Unknown');
  };

  const selectedDateMeetings = selectedDate ? getMeetingsForDate(selectedDate) : [];

  if (loading || decrypting) {
    return (
      <div className="flex justify-center items-center h-64">
        <p>{decrypting ? 'Decrypting data...' : 'Loading calendar...'}</p>
      </div>
    );
  }

  return (
    <>
      <div className="neuro p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Calendar</h2>
          <div className="flex space-x-1">
            <Button 
              onClick={previousMonth}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
            >
              <ChevronLeft size={16} />
            </Button>
            <div className="text-sm font-medium">
              {format(currentMonth, 'MMMM yyyy')}
            </div>
            <Button 
              onClick={nextMonth}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-xs font-medium text-center mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const meetings = getMeetingsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const hasMeetings = meetings.length > 0;
            
            return (
              <div
                key={day.toString()}
                className={cn(
                  "aspect-square p-1 relative",
                  !isCurrentMonth && "opacity-30",
                )}
              >
                <div
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "h-full w-full flex flex-col items-center justify-start p-1 text-xs rounded-md cursor-pointer transition-all duration-200 hover:bg-muted/50",
                    isToday(day) && "bg-pulse/10 font-bold",
                    hasMeetings && "ring-1 ring-pulse"
                  )}
                >
                  <span className="mb-1">{format(day, 'd')}</span>
                  {hasMeetings && (
                    <div className="w-full mt-auto">
                      <div className="bg-pulse text-white text-[10px] rounded px-1 py-0.5 truncate">
                        {meetings.length} {meetings.length === 1 ? 'meeting' : 'meetings'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={showMeetings} onOpenChange={setShowMeetings}>
        <DialogContent className="sm:max-w-[500px] neuro border-none">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && `Meetings on ${format(selectedDate, 'MMMM d, yyyy')}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {selectedDateMeetings.length > 0 ? (
              selectedDateMeetings.map((meeting) => (
                <div key={meeting.id} className="neuro p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium text-lg">{meeting.title}</h3>
                    {meeting.status && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        meeting.status === 'scheduled' 
                          ? 'bg-blue-100 text-blue-800' 
                          : meeting.status === 'ongoing'
                          ? 'bg-yellow-100 text-yellow-800'
                          : meeting.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {meeting.status}
                      </span>
                    )}
                  </div>
                  
                  {meeting.description && (
                    <p className="text-sm text-muted-foreground">
                      {meeting.description}
                    </p>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {meeting.startTime && (
                      <div>
                        <span className="font-medium">Time:</span> {meeting.startTime}
                        {meeting.duration && ` (${meeting.duration} mins)`}
                      </div>
                    )}
                    {meeting.location && (
                      <div>
                        <span className="font-medium">Location:</span> {meeting.location}
                      </div>
                    )}
                  </div>
                  
                  {meeting.participants && meeting.participants.length > 0 && (
                    <div className="text-sm">
                      <span className="font-medium">Participants:</span> {getParticipantNames(meeting.participants).join(', ')}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground">No meetings scheduled for this day</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};