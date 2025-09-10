import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isToday, isAfter, parseISO } from 'date-fns';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '@/context/AuthContext';

// Encryption key - should match the one used in your encryption process
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8'; // 32 chars for AES-256

interface Meeting {
  id: string;
  startDate: string;
  startTime?: string;
  title: string;
  description?: string;
  reminder?: string;
  location?: string;
  participants?: string[];
  agentId?: string;
  agentName?: string;
}

interface Agent {
  id: string;
  name: string;
  email: string;
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

// Function to decrypt an agent object
async function decryptAgent(encryptedAgent: any): Promise<Agent> {
  return {
    id: encryptedAgent.id,
    name: await decryptData(encryptedAgent.name),
    email: await decryptData(encryptedAgent.email),
    status: await decryptData(encryptedAgent.status),
  };
}

// Function to decrypt a meeting object
async function decryptMeeting(encryptedMeeting: any, agentsMap: Record<string, Agent>): Promise<Meeting> {
  const decryptedMeeting: Meeting = {
    id: encryptedMeeting.id,
    startDate: await decryptData(encryptedMeeting.startDate),
    title: await decryptData(encryptedMeeting.title),
  };

  // Decrypt optional fields if they exist
  if (encryptedMeeting.startTime) {
    decryptedMeeting.startTime = await decryptData(encryptedMeeting.startTime);
  }
  if (encryptedMeeting.description) {
    decryptedMeeting.description = await decryptData(encryptedMeeting.description);
  }
  if (encryptedMeeting.reminder) {
    decryptedMeeting.reminder = await decryptData(encryptedMeeting.reminder);
  }
  if (encryptedMeeting.location) {
    decryptedMeeting.location = await decryptData(encryptedMeeting.location);
  }
  if (encryptedMeeting.participants) {
    decryptedMeeting.participants = await Promise.all(
      encryptedMeeting.participants.map((p: string) => decryptData(p))
    );
  }
  if (encryptedMeeting.agentId) {
    decryptedMeeting.agentId = encryptedMeeting.agentId;
    decryptedMeeting.agentName = agentsMap[encryptedMeeting.agentId]?.name || 'Unknown Agent';
  }

  return decryptedMeeting;
}

export const NotificationDropdown: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey') || user?.uid;
  
  const [isOpen, setIsOpen] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [agents, setAgents] = useState<Record<string, Agent>>({});
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(false);

  // Fetch and decrypt agents
  useEffect(() => {
    if (!adminId) return;

    const agentsRef = ref(database, `users/${adminId}/agents`);
    
    const fetchAndDecryptAgents = async () => {
      const unsubscribe = onValue(agentsRef, async (snapshot) => {
        try {
          const agentsData = snapshot.val();
          const agentsMap: Record<string, Agent> = {};

          if (agentsData) {
            await Promise.all(
              Object.entries(agentsData).map(async ([id, encryptedAgent]: [string, any]) => {
                try {
                  const decryptedAgent = await decryptAgent({
                    id,
                    ...encryptedAgent
                  });
                  agentsMap[id] = decryptedAgent;
                } catch (error) {
                  console.error(`Error decrypting agent ${id}:`, error);
                }
              })
            );
          }

          setAgents(agentsMap);
        } catch (error) {
          console.error('Error processing agents:', error);
        }
      }, (error) => {
        console.error('Error fetching agents:', error);
      });

      return () => unsubscribe();
    };

    fetchAndDecryptAgents();
  }, [adminId]);

  // Fetch and decrypt meetings
  useEffect(() => {
    if (!adminId || Object.keys(agents).length === 0) return;

    let meetingsRef;
    if (isAdmin) {
      meetingsRef = ref(database, `users/${adminId}/meetingdetails`);
    } else if (agentId) {
      meetingsRef = ref(database, `users/${adminId}/agents/${agentId}/meetingdetails`);
    } else {
      return;
    }

    const fetchAndDecryptMeetings = async () => {
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
                  }, agents);
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

    fetchAndDecryptMeetings();
  }, [adminId, agentId, isAdmin, agents]);

  // Filter upcoming meetings for notifications
  const upcomingMeetings = meetings
    .filter(meeting => {
      try {
        const meetingDate = parseISO(meeting.startDate);
        const meetingDateTime = meeting.startTime
          ? parseISO(`${meeting.startDate}T${meeting.startTime}`)
          : meetingDate;
  
        return isAfter(meetingDateTime, new Date());
      } catch (error) {
        console.error("Error parsing meeting date:", meeting.startDate, error);
        return false;
      }
    })
    .sort((a, b) => {
      try {
        const dateA = a.startTime
          ? parseISO(`${a.startDate}T${a.startTime}`)
          : parseISO(a.startDate);
        const dateB = b.startTime
          ? parseISO(`${b.startDate}T${b.startTime}`)
          : parseISO(b.startDate);
        return dateA.getTime() - dateB.getTime();
      } catch {
        return 0;
      }
    })
    .slice(0, 5);

  const hasNotifications = upcomingMeetings.length > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="text-muted-foreground hover:text-foreground relative"
        >
          <Bell size={20} />
          {hasNotifications && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="bg-background rounded-md shadow-md">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium">Upcoming Meetings</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {loading || decrypting ? 'Loading...' : `Showing ${upcomingMeetings.length} upcoming meetings`}
            </p>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {loading || decrypting ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                {decrypting ? 'Decrypting data...' : 'Loading notifications...'}
              </div>
            ) : upcomingMeetings.length > 0 ? (
              <div className="divide-y divide-border">
                {upcomingMeetings.map((meeting) => {
                  let meetingDateTime;
                  try {
                    meetingDateTime = meeting.startTime 
                      ? parseISO(`${meeting.startDate}T${meeting.startTime}`)
                      : parseISO(meeting.startDate);
                  } catch (error) {
                    console.error("Error parsing date for display:", meeting.startDate, error);
                    return null;
                  }
                  
                  const isTodayMeeting = isToday(meetingDateTime);
                  const formattedTime = meeting.startTime || '--:--';
                  
                  return (
                    <div key={meeting.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start">
                        <div className="h-8 w-8 rounded-full bg-pulse text-white flex items-center justify-center mr-3">
                          <span className="text-xs font-bold">
                            {meeting.title.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{meeting.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {isTodayMeeting
                              ? `Today at ${formattedTime}`
                              : `${format(meetingDateTime, 'MMM d')} at ${formattedTime}`
                            }
                          </p>
                          {meeting.agentName && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Agent: {meeting.agentName}
                            </p>
                          )}
                          {meeting.location && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Location: {meeting.location}
                            </p>
                          )}
                          {meeting.reminder && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Reminder: {meeting.reminder} before
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No upcoming meetings
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-border">
            <Button 
              variant="ghost" 
              className="w-full text-sm h-9" 
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};