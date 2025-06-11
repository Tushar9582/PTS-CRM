import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext';
import { database, messaging } from '../../firebase';
import { ref, push, set, get, update } from 'firebase/database';
import { getToken, onMessage } from 'firebase/messaging';
import { toast } from 'sonner';
import { format, parseISO, subMinutes } from 'date-fns';

interface Meeting {
  id: string;
  title: string;
  startDate: string;
  startTime: string;
  duration: number;
  participants: string[];
  reminder: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdBy: string;
  agentId?: string;
  isAgentMeeting?: boolean;
  originalMeetingId?: string;
  notificationId?: string;
}

interface MeetingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  meeting?: Meeting;
}

export const MeetingForm: React.FC<MeetingFormProps> = ({ isOpen, onClose, onSubmit, meeting }) => {
  const { user, isAdmin } = useAuth();
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey');
  
  const [formData, setFormData] = useState<Partial<Meeting>>({
    title: '',
    startDate: '',
    startTime: '',
    duration: 30,
    participants: [],
    reminder: '15min',
    status: 'scheduled',
  });
  
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (meeting) {
      setFormData({
        title: meeting.title,
        startDate: meeting.startDate,
        startTime: meeting.startTime,
        duration: meeting.duration,
        participants: meeting.participants || [],
        reminder: meeting.reminder,
        status: meeting.status,
      });
      setSelectedAgents(meeting.participants || []);
    } else {
      setFormData({
        title: '',
        startDate: new Date().toISOString().split('T')[0],
        startTime: '',
        duration: 30,
        participants: [],
        reminder: '15min',
        status: 'scheduled',
      });
      setSelectedAgents([]);
    }
  }, [meeting, isOpen]);

  useEffect(() => {
    const initializeNotifications = async () => {
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
      }

      // Request notification permission
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted' && messaging) {
        try {
          const currentToken = await getToken(messaging, { 
            vapidKey: 'YOUR_VAPID_KEY' // Replace with your VAPID key
          });
          if (currentToken && user?.id) {
            await update(ref(database, `users/${user.id}/fcmToken`), currentToken);
          }
        } catch (error) {
          console.error('Error getting FCM token:', error);
        }
      }

      // Set up message listener
      if (messaging) {
        onMessage(messaging, (payload) => {
          const { title, body } = payload.notification || {};
          if (title && body) {
            showLocalNotification(title, body);
          }
        });
      }
    };

    if (isOpen) {
      initializeNotifications();
      fetchAgents();
    }
  }, [isOpen, user]);

  const fetchAgents = async () => {
    setIsLoading(true);
    try {
      let agentsRef;
      
      if (isAdmin && adminId) {
        agentsRef = ref(database, `users/${adminId}/agents`);
      } else if (agentId && adminId) {
        agentsRef = ref(database, `users/${adminId}/agents`);
      } else {
        throw new Error('No admin or agent ID found');
      }

      const snapshot = await get(agentsRef);
      
      if (snapshot.exists()) {
        const agentsData: any[] = [];
        snapshot.forEach((childSnapshot) => {
          agentsData.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        setAvailableAgents(agentsData.filter(agent => agent.status === 'active'));
        
        if (!meeting && !isAdmin && agentId) {
          setSelectedAgents([agentId]);
        }
      } else {
        setAvailableAgents([]);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to load agents');
    } finally {
      setIsLoading(false);
    }
  };

  const showLocalNotification = (title: string, body: string) => {
    if (notificationPermission === 'granted') {
      new Notification(title, { 
        body,
        icon: '/notification-icon.png'
      });
    }
  };

  const scheduleNotification = async (meeting: Meeting) => {
    if (!('Notification' in window)) return;

    try {
      const meetingDateTime = parseISO(`${meeting.startDate}T${meeting.startTime}`);
      let reminderMinutes = 15; // default
      
      if (meeting.reminder === '5min') reminderMinutes = 5;
      else if (meeting.reminder === '10min') reminderMinutes = 10;
      
      const notificationTime = subMinutes(meetingDateTime, reminderMinutes);
      const now = new Date();
      
      if (notificationTime > now) {
        const timeUntilNotification = notificationTime.getTime() - now.getTime();
        
        // Schedule local notification
        setTimeout(() => {
          if (notificationPermission === 'granted') {
            new Notification(`Meeting Reminder: ${meeting.title}`, {
              body: `Your meeting starts in ${reminderMinutes} minutes`,
              icon: '/notification-icon.png',
            });
          }
        }, timeUntilNotification);
        
        // Schedule push notification via FCM
        const notificationId = `notification-${Date.now()}`;
        const notificationRef = ref(database, `notifications/${notificationId}`);
        
        await set(notificationRef, {
          meetingId: meeting.id,
          title: `Meeting Reminder: ${meeting.title}`,
          body: `Your meeting starts in ${reminderMinutes} minutes`,
          recipientIds: meeting.participants,
          scheduledTime: notificationTime.toISOString(),
          status: 'scheduled',
          createdAt: new Date().toISOString(),
        });
        
        // Store notification ID in meeting
        await update(ref(database, `users/${adminId}/meetingdetails/${meeting.id}`), {
          notificationId
        });
      }
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const handleAgentToggle = (agentId: string) => {
    setSelectedAgents(prevSelected => {
      if (prevSelected.includes(agentId)) {
        return prevSelected.filter(id => id !== agentId);
      } else {
        return [...prevSelected, agentId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !adminId) {
      toast.error('Authentication error');
      return;
    }
  
    setIsLoading(true);
    try {
      const meetingId = meeting?.id || `meeting-${Date.now()}`;
      const newMeeting: Meeting = {
        id: meetingId,
        title: formData.title || '',
        startDate: formData.startDate || '',
        startTime: formData.startTime || '',
        duration: formData.duration || 30,
        participants: selectedAgents,
        reminder: formData.reminder || '15min',
        status: formData.status || 'scheduled',
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        ...(meeting?.isAgentMeeting && { isAgentMeeting: true }),
        ...(meeting?.originalMeetingId && { originalMeetingId: meeting.originalMeetingId }),
        ...(!isAdmin && { agentId: agentId }),
      };

      const updates: Record<string, any> = {};

      if (isAdmin) {
        updates[`users/${adminId}/meetingdetails/${meetingId}`] = newMeeting;

        if (selectedAgents.length > 0) {
          selectedAgents.forEach(agentId => {
            updates[`users/${adminId}/agents/${agentId}/meetingdetails/${meetingId}`] = {
              ...newMeeting,
              isAgentMeeting: true,
              originalMeetingId: meetingId,
              agentId: agentId
            };
          });
        }

        if (meeting?.participants) {
          const removedAgents = meeting.participants.filter(id => !selectedAgents.includes(id));
          removedAgents.forEach(agentId => {
            updates[`users/${adminId}/agents/${agentId}/meetingdetails/${meetingId}`] = null;
          });
        }
      } else {
        updates[`users/${adminId}/agents/${agentId}/meetingdetails/${meetingId}`] = newMeeting;

        const adminMeetingRef = push(ref(database, `users/${adminId}/meetingdetails`));
        updates[`users/${adminId}/meetingdetails/${adminMeetingRef.key}`] = {
          ...newMeeting,
          isAgentMeeting: true,
          agentId: agentId
        };

        selectedAgents.filter(id => id !== agentId).forEach(participantId => {
          updates[`users/${adminId}/agents/${participantId}/meetingdetails/${meetingId}`] = {
            ...newMeeting,
            isAgentMeeting: true,
            originalMeetingId: meetingId,
            agentId: agentId
          };
        });
      }

      await update(ref(database), updates);
      await scheduleNotification(newMeeting);

      toast.success(meeting ? 'Meeting updated successfully' : 'Meeting scheduled successfully');
      onSubmit();
      onClose();
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast.error('Failed to save meeting');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] neuro border-none">
        <DialogHeader>
          <DialogTitle>{meeting ? 'Edit Meeting' : 'Schedule New Meeting'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title</Label>
            <Input
              id="title"
              name="title"
              className="neuro-inset focus:shadow-none"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Date</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                className="neuro-inset focus:shadow-none"
                value={formData.startDate}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="startTime">Time</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                className="neuro-inset focus:shadow-none"
                value={formData.startTime}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Select 
                value={formData.duration?.toString() || '30'}
                onValueChange={(value) => handleSelectChange('duration', value)}
              >
                <SelectTrigger className="neuro-inset focus:shadow-none">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reminder">Reminder</Label>
              <Select 
                value={formData.reminder || '15min'}
                onValueChange={(value) => handleSelectChange('reminder', value)}
              >
                <SelectTrigger className="neuro-inset focus:shadow-none">
                  <SelectValue placeholder="Select reminder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5min">5 minutes before</SelectItem>
                  <SelectItem value="10min">10 minutes before</SelectItem>
                  <SelectItem value="15min">15 minutes before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status || 'scheduled'}
              onValueChange={(value) => handleSelectChange('status', value)}
            >
              <SelectTrigger className="neuro-inset focus:shadow-none">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {(isAdmin || agentId) && (
            <div className="space-y-2">
              <Label htmlFor="participants">Participants</Label>
              <div className="neuro-inset p-3 rounded-md space-y-2 max-h-40 overflow-y-auto">
                {isLoading ? (
                  <div className="text-center text-sm text-muted-foreground">Loading agents...</div>
                ) : availableAgents.length > 0 ? (
                  availableAgents.map(agent => (
                    <div key={agent.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`agent-${agent.id}`} 
                        checked={selectedAgents.includes(agent.id)}
                        onCheckedChange={() => handleAgentToggle(agent.id)}
                        disabled={!isAdmin && agent.id === user?.id && selectedAgents.length <= 1}
                      />
                      <label htmlFor={`agent-${agent.id}`} className="text-sm">
                        {agent.firstName} {agent.lastName} ({agent.email})
                        {agent.id === user?.id && " (You)"}
                      </label>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-sm text-muted-foreground">No agents available</div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              type="button"
              variant="outline"
              onClick={onClose}
              className="neuro hover:shadow-none transition-all duration-300"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="neuro hover:shadow-none transition-all duration-300"
              disabled={isLoading || (!isAdmin && selectedAgents.length === 0)}
            >
              {isLoading ? (meeting ? 'Updating...' : 'Scheduling...') : (meeting ? 'Update Meeting' : 'Schedule Meeting')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};