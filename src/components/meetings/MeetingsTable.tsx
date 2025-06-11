import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Users, Phone, Mail, MessageSquare, ChevronLeft, ChevronRight, Calendar, RotateCcw, X, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { MeetingForm } from './MeetingForm';
import { useIsMobile } from '@/hooks/use-mobile';
import { database } from '../../firebase';
import { ref, onValue, off, remove, get, update } from 'firebase/database';
import { useAuth } from '@/context/AuthContext';

interface Meeting {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  startTime: string;
  endTime?: string;
  duration: number;
  location?: string;
  participants: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    avatar?: string;
  }[];
  agendaItems?: {
    id: string;
    title: string;
    description?: string;
    duration: number;
  }[];
  reminder: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdBy: string;
  agentId?: string;
  isAgentMeeting?: boolean;
  originalMeetingId?: string;
}

interface Agent {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface Backup {
  meetings: Meeting[];
  timestamp: string;
  deletedMeetings?: Meeting[];
}

export const MeetingsTable: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isAddingMeeting, setIsAddingMeeting] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [meetingsPerPage] = useState(10);
  const isMobile = useIsMobile();
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey');
  const [showBackup, setShowBackup] = useState(false);
  const [dailyBackups, setDailyBackups] = useState<Record<string, Backup>>({});
  const [showDeleted, setShowDeleted] = useState(false);
  const [activeMeetingNotification, setActiveMeetingNotification] = useState<Meeting | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [shownNotifications, setShownNotifications] = useState<Set<string>>(new Set());

  const createDailyBackup = (currentMeetings: Meeting[]) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const existingBackup = dailyBackups[today] || { 
        meetings: [], 
        deletedMeetings: [], 
        timestamp: new Date().toISOString() 
      };
      
      const newDeletedMeetings = existingBackup.meetings
        .filter(prevMeeting => !currentMeetings.some(m => m.id === prevMeeting.id))
        .filter(meeting => !existingBackup.deletedMeetings?.some(m => m.id === meeting.id));

      const updatedBackup: Backup = {
        meetings: JSON.parse(JSON.stringify(currentMeetings)),
        deletedMeetings: [...(existingBackup.deletedMeetings || []), ...newDeletedMeetings],
        timestamp: new Date().toISOString()
      };

      const updatedBackups = { ...dailyBackups, [today]: updatedBackup };
      localStorage.setItem('dailyMeetingsBackups', JSON.stringify(updatedBackups));
      setDailyBackups(updatedBackups);

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const cleanedBackups: Record<string, Backup> = {};
      Object.keys(updatedBackups).forEach(date => {
        if (new Date(date) >= oneWeekAgo) {
          cleanedBackups[date] = updatedBackups[date];
        }
      });
      localStorage.setItem('dailyMeetingsBackups', JSON.stringify(cleanedBackups));
    } catch (error) {
      console.error('Backup failed:', error);
    }
  };

  const loadDailyBackups = () => {
    try {
      const backups = JSON.parse(localStorage.getItem('dailyMeetingsBackups') || '{}');
      setDailyBackups(backups);
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  };

  const removeMeetingFromAllBackups = (meetingId: string) => {
    const updatedBackups = { ...dailyBackups };
    let backupModified = false;

    Object.keys(updatedBackups).forEach(date => {
      const backup = updatedBackups[date];
      const updatedBackup = { ...backup };

      const meetingIndex = backup.meetings.findIndex(m => m.id === meetingId);
      if (meetingIndex !== -1) {
        updatedBackup.meetings = backup.meetings.filter(m => m.id !== meetingId);
        backupModified = true;
      }

      const deletedIndex = backup.deletedMeetings?.findIndex(m => m.id === meetingId) ?? -1;
      if (deletedIndex !== -1) {
        updatedBackup.deletedMeetings = backup.deletedMeetings?.filter(m => m.id !== meetingId) || [];
        backupModified = true;
      }

      if (backupModified) {
        updatedBackups[date] = updatedBackup;
      }
    });

    if (backupModified) {
      localStorage.setItem('dailyMeetingsBackups', JSON.stringify(updatedBackups));
      setDailyBackups(updatedBackups);
    }
  };

  const restoreMeeting = async (meeting: Meeting) => {
    try {
      if (isAdmin && adminId) {
        await update(ref(database, `users/${adminId}/meetingdetails/${meeting.id}`), meeting);
        if (meeting.participants?.length > 0) {
          const updates: Record<string, any> = {};
          meeting.participants.forEach(agentId => {
            updates[`users/${adminId}/agents/${agentId}/meetingdetails/${meeting.id}`] = meeting;
          });
          await update(ref(database), updates);
        }
      } else if (agentId && adminId) {
        await update(ref(database, `users/${adminId}/agents/${agentId}/meetingdetails/${meeting.id}`), meeting);
        await update(ref(database, `users/${adminId}/meetingdetails/${meeting.id}`), meeting);
      }
      
      removeMeetingFromAllBackups(meeting.id);
      toast.success('Meeting restored successfully');
    } catch (error) {
      console.error('Restore failed:', error);
      toast.error('Failed to restore meeting');
    }
  };

  const permanentlyDeleteFromBackup = (date: string, meetingId: string) => {
    const backup = dailyBackups[date];
    if (!backup) return;

    const updatedBackup = {
      ...backup,
      deletedMeetings: backup.deletedMeetings?.filter(m => m.id !== meetingId) || []
    };

    const updatedBackups = { ...dailyBackups, [date]: updatedBackup };
    localStorage.setItem('dailyMeetingsBackups', JSON.stringify(updatedBackups));
    setDailyBackups(updatedBackups);
    toast.success('Meeting permanently deleted from backup');
  };

  const checkUpcomingMeetings = () => {
    const now = new Date();
    meetings.forEach(meeting => {
      if (shownNotifications.has(meeting.id)) return;
      
      const meetingTime = new Date(`${meeting.startDate}T${meeting.startTime}`);
      const timeDiff = meetingTime.getTime() - now.getTime();
      
      const reminderTime = getReminderTimeInMs(meeting.reminder);
      
      if (timeDiff > 0 && timeDiff <= reminderTime) {
        setShownNotifications(prev => new Set(prev).add(meeting.id));
        setActiveMeetingNotification(meeting);
      }
    });
  };

  const getReminderTimeInMs = (reminder: string): number => {
    switch (reminder) {
      case '5 minutes before': return 5 * 60 * 1000;
      case '15 minutes before': return 15 * 60 * 1000;
      case '30 minutes before': return 30 * 60 * 1000;
      case '1 hour before': return 60 * 60 * 1000;
      case '1 day before': return 24 * 60 * 60 * 1000;
      default: return 0;
    }
  };

  const handleDismissNotification = () => {
    setActiveMeetingNotification(null);
  };

  const handleJoinMeeting = () => {
    if (activeMeetingNotification) {
      console.log('Joining meeting:', activeMeetingNotification.id);
      setActiveMeetingNotification(null);
    }
  };

  const handleViewDetails = () => {
    if (activeMeetingNotification) {
      setSelectedMeeting(activeMeetingNotification);
      setIsAddingMeeting(true);
      setActiveMeetingNotification(null);
    }
  };

  useEffect(() => {
    const interval = setInterval(checkUpcomingMeetings, 60000);
    checkUpcomingMeetings();

    return () => clearInterval(interval);
  }, [meetings, shownNotifications]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchMeetings = () => {
      let meetingsRef;
      
      if (isAdmin && adminId) {
        meetingsRef = ref(database, `users/${adminId}/meetingdetails`);
      } else if (agentId && adminId) {
        meetingsRef = ref(database, `users/${adminId}/agents/${agentId}/meetingdetails`);
      } else {
        return;
      }

      onValue(meetingsRef, (snapshot) => {
        const meetingsData: Meeting[] = [];
        snapshot.forEach((childSnapshot) => {
          const meeting = {
            id: childSnapshot.key!,
            ...childSnapshot.val()
          };
          meetingsData.push(meeting);
        });
        setMeetings(meetingsData);
      });

      return () => off(meetingsRef);
    };

    const fetchAgents = () => {
      if (!adminId) return;
      
      const agentsRef = isAdmin 
        ? ref(database, `users/${adminId}/agents`)
        : ref(database, `users/${adminId}/agents/${agentId}`);
      
      onValue(agentsRef, (snapshot) => {
        if (isAdmin) {
          const agentsData: Agent[] = [];
          snapshot.forEach((childSnapshot) => {
            agentsData.push({
              id: childSnapshot.key!,
              ...childSnapshot.val()
            });
          });
          setAgents(agentsData);
        } else {
          if (snapshot.exists()) {
            setAgents([{
              id: snapshot.key!,
              ...snapshot.val()
            }]);
          }
        }
      });

      return () => off(agentsRef);
    };

    fetchMeetings();
    fetchAgents();
  }, [isAdmin, adminId, agentId]);

  useEffect(() => {
    if (meetings.length > 0) {
      const timer = setTimeout(() => {
        createDailyBackup(meetings);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [meetings]);

  useEffect(() => {
    loadDailyBackups();
  }, []);

  const filteredMeetings = meetings.filter(meeting => {
    return meeting.title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const indexOfLastMeeting = currentPage * meetingsPerPage;
  const indexOfFirstMeeting = indexOfLastMeeting - meetingsPerPage;
  const currentMeetings = filteredMeetings.slice(indexOfFirstMeeting, indexOfLastMeeting);
  const totalPages = Math.ceil(filteredMeetings.length / meetingsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleDelete = async (id: string) => {
    try {
      const meetingToDelete = meetings.find(m => m.id === id);
      if (!meetingToDelete) return;

      if (isAdmin && adminId) {
        await remove(ref(database, `users/${adminId}/meetingdetails/${id}`));

        if (meetingToDelete.participants?.length > 0) {
          const updates: Record<string, null> = {};
          meetingToDelete.participants.forEach(agentId => {
            updates[`users/${adminId}/agents/${agentId}/meetingdetails/${id}`] = null;
          });
          await update(ref(database), updates);
        }
      } else if (agentId && adminId) {
        await remove(ref(database, `users/${adminId}/agents/${agentId}/meetingdetails/${id}`));

        const adminMeetingRef = ref(database, `users/${adminId}/meetingdetails`);
        const snapshot = await get(adminMeetingRef);
        if (snapshot.exists()) {
          snapshot.forEach(child => {
            if (child.val().agentId === agentId && child.val().id === id) {
              remove(ref(database, `users/${adminId}/meetingdetails/${child.key}`));
            }
          });
        }
      }

      toast.success('Meeting deleted successfully');
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast.error('Failed to delete meeting');
    }
  };

  const handleEdit = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setIsAddingMeeting(true);
  };

  const handleCall = (participantId: string) => {
    const participant = agents.find(a => a.id === participantId);
    if (participant?.phone) {
      window.open(`tel:${participant.phone}`, '_blank');
    } else {
      toast.warning('No phone number available for this participant');
    }
  };

  const handleEmail = (participantId: string) => {
    const participant = agents.find(a => a.id === participantId);
    if (participant?.email) {
      window.open(`mailto:${participant.email}?subject=Regarding our meeting`, '_blank');
    } else {
      toast.warning('No email available for this participant');
    }
  };

  const handleWhatsApp = (participantId: string) => {
    const participant = agents.find(a => a.id === participantId);
    if (participant?.phone) {
      const phone = participant.phone.startsWith('+') ? participant.phone : `+${participant.phone}`;
      window.open(`https://wa.me/${phone}`, '_blank');
    } else {
      toast.warning('No phone number available for WhatsApp');
    }
  };

  const getParticipantNames = (participantIds: string[]): {id: string, name: string, phone?: string, email?: string}[] => {
    if (!agents || agents.length === 0) return [{id: 'loading', name: 'Loading...'}];
    
    return participantIds.map(id => {
      const agent = agents.find(a => a.id === id);
      if (!agent) return {id, name: 'Unknown'};
      
      const firstName = agent.firstName || '';
      const lastName = agent.lastName || '';
      return {
        id,
        name: `${firstName} ${lastName}`.trim() || agent.email || 'Unnamed Participant',
        phone: agent.phone,
        email: agent.email
      };
    });
  };

  const getStatusClassName = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center mb-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            onClick={() => {
              setSelectedMeeting(null);
              setIsAddingMeeting(true);
            }}
            className="neuro hover:shadow-none transition-all duration-300 flex-1"
            disabled={!user}
          >
            Schedule Meeting
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowBackup(!showBackup)}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            {isMobile ? '' : 'Backups'}
          </Button>
        </div>
        
        <Input
          placeholder="Search meetings..."
          className="neuro-inset focus:shadow-none w-full sm:w-[300px]"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {showBackup && (
        <div className="neuro p-4 rounded-lg space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Meeting Backups</h3>
            <div className="flex gap-2">
              <Button 
                variant={showDeleted ? "default" : "outline"} 
                size="sm"
                onClick={() => setShowDeleted(!showDeleted)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowBackup(false)}>
                Close
              </Button>
            </div>
          </div>

          {Object.keys(dailyBackups).length > 0 ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {Object.keys(dailyBackups)
                .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                .map(date => {
                  const backup = dailyBackups[date];
                  const filteredMeetings = backup.meetings.filter(
                    backupMeeting => !meetings.some(currentMeeting => currentMeeting.id === backupMeeting.id)
                  );
                  const filteredDeletedMeetings = backup.deletedMeetings?.filter(
                    deletedMeeting => !meetings.some(currentMeeting => currentMeeting.id === deletedMeeting.id)
                  );

                  return (
                    <div key={date} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">{date}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(backup.timestamp).toLocaleString()}
                        </p>
                      </div>

                      {filteredMeetings.length > 0 && (
                        <div className="space-y-2">
                          {filteredMeetings.map(meeting => (
                            <div key={meeting.id} className="flex justify-between items-center p-2 border rounded">
                              <div className="truncate">
                                <p className="font-medium truncate">{meeting.title}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {meeting.startDate} @ {meeting.startTime}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => restoreMeeting(meeting)}
                              >
                                Restore
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {showDeleted && filteredDeletedMeetings && filteredDeletedMeetings.length > 0 && (
                        <div className="space-y-2 mt-4">
                          <h5 className="text-sm font-medium text-red-500">Deleted Meetings</h5>
                          {filteredDeletedMeetings.map(meeting => (
                            <div key={meeting.id} className="flex justify-between items-center p-2 border rounded border-red-200 bg-red-50">
                              <div className="truncate">
                                <p className="font-medium text-red-800 truncate">{meeting.title}</p>
                                <p className="text-xs text-red-600 truncate">
                                  {meeting.startDate} @ {meeting.startTime}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => restoreMeeting(meeting)}
                                  className="text-green-600"
                                >
                                  Restore
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => permanentlyDeleteFromBackup(date, meeting.id)}
                                  className="text-red-600"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No backups available yet
            </p>
          )}
        </div>
      )}

      {filteredMeetings.length > 0 ? (
        <>
          <div className="overflow-auto neuro hidden sm:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Title</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date & Time</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Duration</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Participants</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Reminder</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentMeetings.map((meeting) => (
                  <tr key={meeting.id} className="hover:bg-muted/20">
                    <td className="p-3">
                      <p className="font-medium">{meeting.title}</p>
                    </td>
                    <td className="p-3">{meeting.startDate} @ {meeting.startTime}</td>
                    <td className="p-3">{meeting.duration} mins</td>
                    <td className="p-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8">
                            <Users className="h-4 w-4 mr-1" />
                            {meeting.participants?.length || 0} participants
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-60 p-0">
                          <div className="p-4">
                            <h4 className="font-medium mb-2">Participants</h4>
                            <ul className="space-y-2">
                              {getParticipantNames(meeting.participants || []).map((participant) => (
                                <li key={participant.id} className="text-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <div className="w-2 h-2 rounded-full bg-pulse mr-2"></div>
                                      {participant.name}
                                    </div>
                                    <div className="flex space-x-1">
                                      {participant.phone && (
                                        <>
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 text-blue-500 hover:text-blue-600"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleCall(participant.id);
                                            }}
                                            title="Call"
                                          >
                                            <Phone className="h-3 w-3" />
                                          </Button>
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 text-green-600 hover:text-green-700"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleWhatsApp(participant.id);
                                            }}
                                            title="WhatsApp"
                                          >
                                            <MessageSquare className="h-3 w-3" />
                                          </Button>
                                        </>
                                      )}
                                      {participant.email && (
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-6 w-6 text-green-500 hover:text-green-600"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEmail(participant.id);
                                          }}
                                          title="Email"
                                        >
                                          <Mail className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td className="p-3">{meeting.reminder}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        getStatusClassName(meeting.status)
                      }`}>
                        {meeting.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex space-x-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEdit(meeting)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(meeting.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-4">
            {currentMeetings.map((meeting) => (
              <div key={meeting.id} className="neuro p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <h3 className="font-medium">{meeting.title}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    getStatusClassName(meeting.status)
                  }`}>
                    {meeting.status}
                  </span>
                </div>
                
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <div>Date & Time:</div>
                    <div className="font-medium">{meeting.startDate} @ {meeting.startTime}</div>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <div>Duration:</div>
                    <div className="font-medium">{meeting.duration} mins</div>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <div>Reminder:</div>
                    <div className="font-medium">{meeting.reminder}</div>
                  </div>
                </div>
                
                <div className="mt-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs w-full justify-start">
                        <Users className="h-3 w-3 mr-1" />
                        {meeting.participants?.length || 0} participants
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 p-0">
                      <div className="p-4">
                        <h4 className="font-medium mb-2">Participants</h4>
                        <ul className="space-y-2">
                          {getParticipantNames(meeting.participants || []).map((participant) => (
                            <li key={participant.id} className="text-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="w-2 h-2 rounded-full bg-pulse mr-2"></div>
                                  {participant.name}
                                </div>
                                <div className="flex space-x-1">
                                  {participant.phone && (
                                    <>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 text-blue-500 hover:text-blue-600"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCall(participant.id);
                                        }}
                                        title="Call"
                                      >
                                        <Phone className="h-3 w-3" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 text-green-600 hover:text-green-700"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleWhatsApp(participant.id);
                                        }}
                                        title="WhatsApp"
                                      >
                                        <MessageSquare className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                  {participant.email && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 text-green-500 hover:text-green-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEmail(participant.id);
                                      }}
                                      title="Email"
                                    >
                                      <Mail className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="mt-3 pt-3 border-t flex justify-end space-x-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleEdit(meeting)}
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(meeting.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {indexOfFirstMeeting + 1}-{Math.min(indexOfLastMeeting, filteredMeetings.length)} of {filteredMeetings.length} meetings
            </div>
            
            {totalPages > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={currentPage === 1 || totalPages <= 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                  <Button
                    key={number}
                    variant={currentPage === number ? "default" : "outline"}
                    size="sm"
                    onClick={() => paginate(number)}
                    className="h-8 w-8 p-0"
                    disabled={totalPages <= 1}
                  >
                    {number}
                  </Button>
                ))}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={currentPage === totalPages || totalPages <= 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="neuro p-8 text-center rounded-lg">
          <p className="text-muted-foreground">No meetings found. Schedule your first meeting!</p>
        </div>
      )}

      <MeetingForm 
        isOpen={isAddingMeeting} 
        onClose={() => {
          setIsAddingMeeting(false);
          setSelectedMeeting(null);
        }} 
        onSubmit={() => {
          setIsAddingMeeting(false);
          setSelectedMeeting(null);
          toast.success(selectedMeeting ? 'Meeting updated successfully' : 'Meeting scheduled successfully');
        }}
        meeting={selectedMeeting}
      />

      {/* Meeting Notification Popup */}
      {activeMeetingNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold dark:text-white">
                Upcoming Meeting: {activeMeetingNotification.title}
              </h3>
              <button 
                onClick={handleDismissNotification}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 mt-0.5 text-blue-500 dark:text-blue-400" />
                <div>
                  <p className="font-medium dark:text-white">Date & Time</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {activeMeetingNotification.startDate} at {activeMeetingNotification.startTime}
                  </p>
                </div>
              </div>
              
              {activeMeetingNotification.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 mt-0.5 text-blue-500 dark:text-blue-400" />
                  <div>
                    <p className="font-medium dark:text-white">Location</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {activeMeetingNotification.location}
                    </p>
                  </div>
                </div>
              )}
              
              {activeMeetingNotification.description && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 mt-0.5 text-blue-500 dark:text-blue-400" />
                  <div>
                    <p className="font-medium dark:text-white">Description</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {activeMeetingNotification.description}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 mt-0.5 text-blue-500 dark:text-blue-400" />
                <div>
                  <p className="font-medium dark:text-white">Participants</p>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {getParticipantNames(activeMeetingNotification.participants || []).map(p => p.name).join(', ')}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex gap-3 justify-end">
              <Button 
                variant="outline" 
                onClick={handleDismissNotification}
              >
                Dismiss
              </Button>
              <Button 
                onClick={handleViewDetails}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                View Details
              </Button>
              {activeMeetingNotification.location?.includes('http') && (
                <Button 
                  onClick={handleJoinMeeting}
                  className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                >
                  Join Meeting
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};