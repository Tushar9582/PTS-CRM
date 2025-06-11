import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isToday, isAfter, parseISO } from 'date-fns';
import { getDatabase, ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '@/context/AuthContext';
import { decryptObject } from '@/lib/utils';

interface Meeting {
  id: string;
  startDate: string;
  startTime?: string;
  title: string;
  reminder?: string;
}

export const NotificationDropdown: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey') || user?.uid;
  
  const [isOpen, setIsOpen] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeetings = () => {
      if (!adminId) return;
  
      let meetingsRef;
  
      if (isAdmin) {
        meetingsRef = ref(database, `users/${adminId}/meetingdetails`);
      } else {
        if (!agentId) return;
        meetingsRef = ref(database, `users/${adminId}/agents/${agentId}/meetingdetails`);
      }
  
      const unsubscribe = onValue(
        meetingsRef,
        (snapshot) => {
          const meetingsData = snapshot.val();
  
          const processMeetings = async () => {
            const meetingsList: Meeting[] = [];
  
            if (meetingsData) {
              const decryptedMeetings = await Promise.all(
                Object.entries(meetingsData).map(async ([meetingId, encryptedMeeting]: any) => {
                  try {
                    const decrypted = await decryptObject(encryptedMeeting);
                    return {
                      id: meetingId,
                      ...decrypted,
                    };
                  } catch (err) {
                    console.error("Decryption failed for meeting:", meetingId, err);
                    return null;
                  }
                })
              );
  
              decryptedMeetings.forEach((meeting) => {
                if (meeting && meeting.startDate) {
                  meetingsList.push(meeting);
                }
              });
            }
  
            setMeetings(meetingsList);
            setLoading(false);
          };
  
          processMeetings();
        },
        (error) => {
          console.error("Error fetching meetings:", error);
          setLoading(false);
        }
      );
  
      return () => unsubscribe();
    };
  
    fetchMeetings();
  }, [adminId, agentId, isAdmin]);
  
  // Filter upcoming meetings for notifications (only future meetings)
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
              Showing future meetings only
            </p>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Loading notifications...
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
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(meetingDateTime, 'EEEE, MMMM d, yyyy')}
                          </p>
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