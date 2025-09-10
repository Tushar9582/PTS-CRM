import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext';
import { database, messaging } from '../../firebase';
import { ref, push, set, get, update, remove } from 'firebase/database';
import { getToken, onMessage } from 'firebase/messaging';
import { toast } from 'sonner';
import { format, parseISO, subMinutes, addMinutes, isBefore, isAfter, addDays, addWeeks, addMonths } from 'date-fns';
import { Mic, StopCircle } from 'lucide-react';

// Encryption key - should be stored securely in production (consider environment variables)
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8'; // 32 chars for AES-256

interface Meeting {
  id: string;
  title: string;
  startDate: string;
  startTime: string;
  duration: number;
  participants: string[];
  leads: string[];
  reminder: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdBy: string;
  agentId?: string;
  isAgentMeeting?: boolean;
  originalMeetingId?: string;
  notificationId?: string;
  isRecurring?: boolean;
  recurrencePattern?: 'daily' | 'weekly' | 'monthly';
  recurrenceEndDate?: string;
  followUp?: boolean;
  parentMeetingId?: string;
  transcript?: string; // Added for voice transcription
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  Email_ID: string;
  phone?: string;
  [key: string]: any;
}

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  [key: string]: any;
}

interface MeetingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (meeting: Meeting) => Promise<void>;
  onDelete?: (meetingId: string) => Promise<void>;
  meeting?: Meeting;
}

// Enhanced encryption function that handles all data types
async function encryptValue(value: any): Promise<any> {
  if (value === null || value === undefined) {
    return value;
  }
  
  if (typeof value === 'string') {
    return await encryptData(value);
  } else if (Array.isArray(value)) {
    return await Promise.all(value.map(v => encryptValue(v)));
  } else if (typeof value === 'object') {
    const encryptedObj: any = {};
    for (const [key, val] of Object.entries(value)) {
      encryptedObj[key] = await encryptValue(val);
    }
    return encryptedObj;
  }
  return value;
}

// Enhanced decryption function that handles all data types
async function decryptValue(value: any): Promise<any> {
  if (value === null || value === undefined) {
    return value;
  }
  
  if (typeof value === 'string') {
    return await decryptData(value);
  } else if (Array.isArray(value)) {
    return await Promise.all(value.map(v => decryptValue(v)));
  } else if (typeof value === 'object') {
    const decryptedObj: any = {};
    for (const [key, val] of Object.entries(value)) {
      decryptedObj[key] = await decryptValue(val);
    }
    return decryptedObj;
  }
  return value;
}

// Base encryption function for strings using AES-GCM
async function encryptData(data: string): Promise<string> {
  if (!data) return data;
  
  try {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(ENCRYPTION_KEY),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    return data;
  }
}

// Base decryption function for strings using AES-GCM
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
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedData;
  }
}

// Encrypt entire meeting object
async function encryptMeeting(meeting: Meeting): Promise<Meeting> {
  const encrypted: any = {};
  
  for (const [key, value] of Object.entries(meeting)) {
    encrypted[key] = await encryptValue(value);
  }
  
  return encrypted as Meeting;
}

// Decrypt entire meeting object
async function decryptMeeting(meeting: Meeting): Promise<Meeting> {
  const decrypted: any = {};
  
  for (const [key, value] of Object.entries(meeting)) {
    decrypted[key] = await decryptValue(value);
  }
  
  return decrypted as Meeting;
}

// Decrypt agent data
async function decryptAgent(agent: Agent): Promise<Agent> {
  const decrypted: any = {};
  
  for (const [key, value] of Object.entries(agent)) {
    decrypted[key] = await decryptValue(value);
  }
  
  return decrypted as Agent;
}

// Decrypt lead data
async function decryptLead(lead: Lead): Promise<Lead> {
  const decrypted: any = {};
  
  for (const [key, value] of Object.entries(lead)) {
    decrypted[key] = await decryptValue(value);
  }
  
  return decrypted as Lead;
}

export const MeetingForm: React.FC<MeetingFormProps> = ({ isOpen, onClose, onSubmit, onDelete, meeting }) => {
  const { user, isAdmin } = useAuth();
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey');

  const [formData, setFormData] = useState<Partial<Meeting>>({
    title: '',
    startDate: '',
    startTime: '',
    duration: 30,
    participants: [],
    leads: [],
    reminder: '15min',
    status: 'scheduled',
    isRecurring: false,
    recurrencePattern: 'weekly',
    recurrenceEndDate: '',
    followUp: false,
    transcript: ''
  });

  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isAgentsDropdownOpen, setIsAgentsDropdownOpen] = useState(false);
  const [isLeadsDropdownOpen, setIsLeadsDropdownOpen] = useState(false);
  const [conflicts, setConflicts] = useState<{ agentId: string, conflicts: Meeting[] }[]>([]);
  const [suggestedTimes, setSuggestedTimes] = useState<string[]>([]);
  const [agentAvailabilities, setAgentAvailabilities] = useState<Record<string, { start: string, end: string }>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = 'en-US';

        recognitionInstance.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          setTranscript(prev => prev + finalTranscript);
        };

        recognitionInstance.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          toast.error('Speech recognition error: ' + event.error);
          setIsRecording(false);
        };

        setRecognition(recognitionInstance);
      } else {
        toast.warning('Speech recognition not supported in this browser');
      }
    }

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognition) {
      toast.error('Speech recognition not available');
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
      setFormData(prev => ({ ...prev, transcript: transcript }));
    } else {
      recognition.start();
      setIsRecording(true);
      setTranscript('');
      toast.info('Recording started. Speak now...');
    }
  };

  // Load meeting data and decrypt it
  useEffect(() => {
    const loadMeetingData = async () => {
      if (meeting) {
        setIsDecrypting(true);
        try {
          const decryptedMeeting = await decryptMeeting(meeting);
          
          setFormData({
            title: decryptedMeeting.title,
            startDate: decryptedMeeting.startDate,
            startTime: decryptedMeeting.startTime,
            duration: decryptedMeeting.duration,
            participants: decryptedMeeting.participants || [],
            leads: decryptedMeeting.leads || [],
            reminder: decryptedMeeting.reminder,
            status: decryptedMeeting.status as any,
            isRecurring: decryptedMeeting.isRecurring || false,
            recurrencePattern: decryptedMeeting.recurrencePattern as any,
            recurrenceEndDate: decryptedMeeting.recurrenceEndDate,
            followUp: decryptedMeeting.followUp || false,
            parentMeetingId: decryptedMeeting.parentMeetingId,
            transcript: decryptedMeeting.transcript || ''
          });
          setSelectedAgents(decryptedMeeting.participants || []);
          setSelectedLeads(decryptedMeeting.leads || []);
          setTranscript(decryptedMeeting.transcript || '');
        } catch (error) {
          console.error('Error decrypting meeting:', error);
          toast.error('Failed to decrypt meeting data');
        } finally {
          setIsDecrypting(false);
        }
      } else {
        const today = new Date().toISOString().split('T')[0];
        const defaultTime = new Date();
        defaultTime.setHours(10, 0, 0, 0);

        setFormData({
          title: '',
          startDate: today,
          startTime: format(defaultTime, 'HH:mm'),
          duration: 30,
          participants: [],
          leads: [],
          reminder: '15min',
          status: 'scheduled',
          isRecurring: false,
          recurrencePattern: 'weekly',
          recurrenceEndDate: '',
          followUp: false,
          transcript: ''
        });
        setSelectedAgents([]);
        setSelectedLeads([]);
        setTranscript('');
      }
    };

    if (isOpen) {
      loadMeetingData();
    }
  }, [meeting, isOpen]);

  // Initialize notifications and fetch data when form opens
  useEffect(() => {
    const initializeNotifications = async () => {
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
      }

      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted' && messaging) {
        try {
          const currentToken = await getToken(messaging, {
            vapidKey: 'YOUR_VAPID_KEY_HERE'
          });
          if (currentToken && user?.id) {
            await update(ref(database, `users/${user.id}/fcmToken`), currentToken);
          }
        } catch (error) {
          console.error('Error getting FCM token:', error);
        }
      }

      if (messaging) {
        onMessage(messaging, (payload) => {
          const { title, body } = payload.notification || {};
          if (title && body) {
            showLocalNotification(title, body);
          }
        });
      }
    };

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

          // Decrypt all agents
          const decryptedAgents = await Promise.all(
            agentsData
              .filter(agent => agent.status === 'active')
              .map(async agent => await decryptAgent(agent))
          );

          setAvailableAgents(decryptedAgents);

          // Load agent availabilities
          const availabilities: Record<string, { start: string, end: string }> = {};
          for (const agent of decryptedAgents) {
            const availabilityRef = ref(database, `users/${adminId}/agents/${agent.id}/availability`);
            const availabilitySnapshot = await get(availabilityRef);
            if (availabilitySnapshot.exists()) {
              availabilities[agent.id] = availabilitySnapshot.val();
            } else {
              availabilities[agent.id] = { start: '09:00', end: '17:00' };
            }
          }
          setAgentAvailabilities(availabilities);

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

    const fetchLeads = async () => {
      if (!adminId) return;

      setIsLoading(true);
      try {
        const leadsRef = ref(database, `users/${adminId}/leads`);
        const snapshot = await get(leadsRef);

        if (snapshot.exists()) {
          const leadsData: Lead[] = [];
          snapshot.forEach((childSnapshot) => {
            leadsData.push({
              id: childSnapshot.key,
              ...childSnapshot.val()
            });
          });

          // Decrypt all leads
          const decryptedLeads = await Promise.all(
            leadsData.map(async lead => await decryptLead(lead))
          );
          
          setAvailableLeads(decryptedLeads);
        } else {
          setAvailableLeads([]);
        }
      } catch (error) {
        console.error('Error fetching leads:', error);
        toast.error('Failed to load leads');
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      initializeNotifications();
      fetchAgents();
      fetchLeads();
    }
  }, [isOpen, user, adminId, agentId, isAdmin, meeting]);

  // Check for scheduling conflicts
  useEffect(() => {
    const checkConflicts = async () => {
      if (!adminId || !formData.startDate || !formData.startTime || !formData.duration) return;

      const meetingStart = parseISO(`${formData.startDate}T${formData.startTime}`);
      const meetingEnd = addMinutes(meetingStart, formData.duration);

      const conflictResults: { agentId: string, conflicts: Meeting[] }[] = [];

      for (const agentId of selectedAgents) {
        try {
          const meetingsRef = ref(database, `users/${adminId}/agents/${agentId}/meetingdetails`);
          const snapshot = await get(meetingsRef);

          const agentConflicts: Meeting[] = [];

          if (snapshot.exists()) {
            for (const childSnapshot of snapshot.each()) {
              const meetingData = childSnapshot.val();
              if (meetingData.id === formData.id) continue;

              // Decrypt meeting data to check conflicts
              const decryptedMeeting = await decryptMeeting(meetingData);
              
              const existingStart = parseISO(`${decryptedMeeting.startDate}T${decryptedMeeting.startTime}`);
              const existingEnd = addMinutes(existingStart, decryptedMeeting.duration);

              if (
                (isBefore(meetingStart, existingEnd) && isAfter(meetingStart, existingStart)) ||
                (isBefore(meetingEnd, existingEnd) && isAfter(meetingEnd, existingStart)) ||
                (isBefore(existingStart, meetingEnd) && isAfter(existingStart, meetingStart)) ||
                (isBefore(existingEnd, meetingEnd) && isAfter(existingEnd, meetingStart))
              ) {
                agentConflicts.push(decryptedMeeting);
              }
            }
          }

          if (agentConflicts.length > 0) {
            conflictResults.push({ agentId, conflicts: agentConflicts });
          }
        } catch (error) {
          console.error(`Error checking conflicts for agent ${agentId}:`, error);
        }
      }

      setConflicts(conflictResults);

      if (conflictResults.length > 0) {
        suggestAlternativeTimes();
      }
    };

    if (formData.startDate && formData.startTime && formData.duration && selectedAgents.length > 0) {
      checkConflicts();
    }
  }, [formData.startDate, formData.startTime, formData.duration, selectedAgents, adminId, formData.id]);

  // Suggest alternative meeting times
  const suggestAlternativeTimes = useCallback(() => {
    if (!formData.startDate || !formData.startTime || !formData.duration) return;

    const originalTime = parseISO(`${formData.startDate}T${formData.startTime}`);
    const suggestions: string[] = [];

    for (let i = 1; i <= 3; i++) {
      const earlierTime = subMinutes(originalTime, i * 30);
      if (isWithinWorkingHours(earlierTime)) {
        suggestions.push(format(earlierTime, 'HH:mm'));
      }

      const laterTime = addMinutes(originalTime, i * 30);
      if (isWithinWorkingHours(laterTime)) {
        suggestions.push(format(laterTime, 'HH:mm'));
      }
    }

    setSuggestedTimes(suggestions);
  }, [formData.startDate, formData.startTime, formData.duration, selectedAgents, agentAvailabilities]);

  // Check if time is within agent working hours
  const isWithinWorkingHours = (time: Date) => {
    if (selectedAgents.length === 0) return true;

    return selectedAgents.every(agentId => {
      const availability = agentAvailabilities[agentId];
      if (!availability) return true;

      const startHour = parseInt(availability.start.split(':')[0]);
      const startMinute = parseInt(availability.start.split(':')[1]);
      const endHour = parseInt(availability.end.split(':')[0]);
      const endMinute = parseInt(availability.end.split(':')[1]);

      const timeHour = time.getHours();
      const timeMinute = time.getMinutes();

      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      const timeMinutes = timeHour * 60 + timeMinute;

      return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
    });
  };

  // Show local notification
  const showLocalNotification = (title: string, body: string) => {
    if (notificationPermission === 'granted') {
      new Notification(title, {
        body,
        icon: '/notification-icon.png'
      });
    }
  };

  // Schedule notification for meeting reminder
  const scheduleNotification = async (meeting: Meeting) => {
    if (!('Notification' in window)) return;

    try {
      const meetingDateTime = parseISO(`${meeting.startDate}T${meeting.startTime}`);
      let reminderMinutes = 15;

      if (meeting.reminder === '5min') reminderMinutes = 5;
      else if (meeting.reminder === '10min') reminderMinutes = 10;

      const notificationTime = subMinutes(meetingDateTime, reminderMinutes);
      const now = new Date();

      if (notificationTime > now) {
        const timeUntilNotification = notificationTime.getTime() - now.getTime();

        setTimeout(() => {
          if (notificationPermission === 'granted') {
            new Notification(`Meeting Reminder: ${meeting.title}`, {
              body: `Your meeting starts in ${reminderMinutes} minutes`,
              icon: '/notification-icon.png',
            });
          }
        }, timeUntilNotification);

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

        await update(ref(database, `users/${adminId}/meetingdetails/${meeting.id}`), {
          notificationId
        });
      }
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  // Handle form field changes
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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      transcript: e.target.value
    });
    setTranscript(e.target.value);
  };

  // Toggle agent selection
  const handleAgentToggle = (agentId: string) => {
    setSelectedAgents(prevSelected => {
      if (prevSelected.includes(agentId)) {
        return prevSelected.filter(id => id !== agentId);
      } else {
        return [...prevSelected, agentId];
      }
    });
  };

  // Toggle lead selection
  const handleLeadToggle = (leadId: string) => {
    setSelectedLeads(prevSelected => {
      if (prevSelected.includes(leadId)) {
        return prevSelected.filter(id => id !== leadId);
      } else {
        return [...prevSelected, leadId];
      }
    });
  };

  // Use suggested time
  const handleTimeSuggestionClick = (time: string) => {
    setFormData(prev => ({
      ...prev,
      startTime: time
    }));
    setSuggestedTimes([]);
  };

  // Create recurring meetings
  const createRecurringMeetings = async (baseMeeting: Meeting) => {
    if (!formData.isRecurring || !formData.recurrencePattern || !formData.recurrenceEndDate) {
      return [];
    }

    const recurringMeetings: Meeting[] = [];
    const baseDate = parseISO(`${baseMeeting.startDate}T${baseMeeting.startTime}`);
    const endDate = parseISO(formData.recurrenceEndDate);

    let currentDate = baseDate;
    let iteration = 1;

    while (currentDate <= endDate) {
      iteration++;

      switch (formData.recurrencePattern) {
        case 'daily':
          currentDate = addDays(currentDate, 1);
          break;
        case 'weekly':
          currentDate = addWeeks(currentDate, 1);
          break;
        case 'monthly':
          currentDate = addMonths(currentDate, 1);
          break;
      }

      if (currentDate > endDate) break;

      const recurringMeeting: Meeting = {
        ...baseMeeting,
        id: `${baseMeeting.id}-recur-${iteration}`,
        startDate: format(currentDate, 'yyyy-MM-dd'),
        startTime: format(currentDate, 'HH:mm'),
        originalMeetingId: baseMeeting.id,
        isRecurring: true,
        recurrencePattern: formData.recurrencePattern,
        recurrenceEndDate: formData.recurrenceEndDate,
        transcript: baseMeeting.transcript || ''
      };

      recurringMeetings.push(recurringMeeting);
    }

    return recurringMeetings;
  };

  // Save meeting to both admin and agent paths in encrypted format
  const saveMeeting = async (meetingData: Meeting) => {
    if (!adminId) return;

    try {
      // Encrypt the meeting data
      const encryptedMeeting = await encryptMeeting(meetingData);

      // Save to admin's meeting details
      const adminMeetingRef = ref(database, `users/${adminId}/meetingdetails/${meetingData.id}`);
      await set(adminMeetingRef, encryptedMeeting);

      // Save to each agent's meeting details
      for (const agentId of meetingData.participants) {
        const agentMeetingRef = ref(database, `users/${adminId}/agents/${agentId}/meetingdetails/${meetingData.id}`);
        await set(agentMeetingRef, encryptedMeeting);
      }

      // Schedule notification if needed
      if (meetingData.status === 'scheduled') {
        await scheduleNotification(meetingData);
      }

      return true;
    } catch (error) {
      console.error('Error saving meeting:', error);
      throw error;
    }
  };

  // Delete meeting from both admin and agent paths
  const deleteMeeting = async (meetingId: string) => {
    if (!adminId || !meeting) return;

    try {
      // Delete from admin's meeting details
      const adminMeetingRef = ref(database, `users/${adminId}/meetingdetails/${meetingId}`);
      await remove(adminMeetingRef);

      // Delete from each agent's meeting details
      for (const agentId of meeting.participants) {
        const agentMeetingRef = ref(database, `users/${adminId}/agents/${agentId}/meetingdetails/${meetingId}`);
        await remove(agentMeetingRef);
      }

      // Delete any associated notifications
      if (meeting.notificationId) {
        const notificationRef = ref(database, `notifications/${meeting.notificationId}`);
        await remove(notificationRef);
      }

      if (onDelete) {
        await onDelete(meetingId);
      }

      toast.success('Meeting deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast.error('Failed to delete meeting');
      throw error;
    }
  };

  // Handle delete button click
  const handleDelete = async () => {
    if (!meeting) return;

    const confirmDelete = window.confirm('Are you sure you want to delete this meeting?');
    if (!confirmDelete) return;

    setIsLoading(true);
    try {
      await deleteMeeting(meeting.id);
      onClose();
    } catch (error) {
      console.error('Error deleting meeting:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
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
        leads: selectedLeads,
        reminder: formData.reminder || '15min',
        status: formData.status || 'scheduled',
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        isRecurring: formData.isRecurring || false,
        recurrencePattern: formData.recurrencePattern,
        recurrenceEndDate: formData.recurrenceEndDate,
        followUp: formData.followUp || false,
        transcript: transcript || '',
        ...(meeting?.isAgentMeeting && { isAgentMeeting: true }),
        ...(meeting?.originalMeetingId && { originalMeetingId: meeting.originalMeetingId }),
        ...(!isAdmin && { agentId: agentId }),
      };

      // Save the meeting (encryption happens inside saveMeeting)
      await saveMeeting(newMeeting);

      // Create recurring meetings if needed
      if (formData.isRecurring && formData.recurrencePattern && formData.recurrenceEndDate) {
        const recurringMeetings = await createRecurringMeetings(newMeeting);
        for (const recurringMeeting of recurringMeetings) {
          await saveMeeting(recurringMeeting);
        }
      }

      // Call the parent onSubmit with the meeting data
      await onSubmit(newMeeting);
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
      <DialogContent className="sm:max-w-[500px] neuro border-none max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{meeting ? 'Edit Meeting' : 'Schedule New Meeting'}</DialogTitle>
        </DialogHeader>

        {(isLoading || isDecrypting) && (
          <div className="flex justify-center items-center h-32">
            {isDecrypting ? 'Decrypting meeting data...' : 'Loading...'}
          </div>
        )}

        {!(isLoading || isDecrypting) && (
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
                  min={new Date().toISOString().split('T')[0]}
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
                {suggestedTimes.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Suggested times: {suggestedTimes.map(time => (
                      <span
                        key={time}
                        className="cursor-pointer text-blue-500 hover:underline mr-2"
                        onClick={() => handleTimeSuggestionClick(time)}
                      >
                        {time}
                      </span>
                    ))}
                  </div>
                )}
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

            <div className="space-y-2">
              <Label>Meeting Notes</Label>
              <div className="relative">
                <textarea
                  className="w-full neuro-inset focus:shadow-none min-h-[100px] p-3 rounded-md"
                  value={transcript}
                  onChange={handleTextareaChange}
                  placeholder="Click the microphone to record notes..."
                />
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "outline"}
                  size="icon"
                  className="absolute bottom-2 right-2 h-8 w-8"
                  onClick={toggleRecording}
                  title={isRecording ? "Stop recording" : "Start recording"}
                >
                  {isRecording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
              {isRecording && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  Recording in progress...
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRecurring"
                  checked={formData.isRecurring || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: Boolean(checked) })}
                />
                <label htmlFor="isRecurring" className="text-sm font-medium leading-none">
                  Recurring Meeting
                </label>
              </div>

              {formData.isRecurring && (
                <div className="pl-6 space-y-2">
                  <div className="space-y-2">
                    <Label htmlFor="recurrencePattern">Recurrence Pattern</Label>
                    <Select
                      value={formData.recurrencePattern || 'weekly'}
                      onValueChange={(value) => handleSelectChange('recurrencePattern', value)}
                    >
                      <SelectTrigger className="neuro-inset focus:shadow-none">
                        <SelectValue placeholder="Select pattern" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recurrenceEndDate">End Date</Label>
                    <Input
                      id="recurrenceEndDate"
                      name="recurrenceEndDate"
                      type="date"
                      className="neuro-inset focus:shadow-none"
                      value={formData.recurrenceEndDate || ''}
                      onChange={handleChange}
                      min={formData.startDate}
                      required={formData.isRecurring}
                    />
                  </div>
                </div>
              )}
            </div>

            {meeting && !meeting.followUp && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="followUp"
                    checked={formData.followUp || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, followUp: Boolean(checked) })}
                  />
                  <label htmlFor="followUp" className="text-sm font-medium leading-none">
                    Schedule as Follow-up Meeting
                  </label>
                </div>
              </div>
            )}

            {(isAdmin || agentId) && (
              <div className="space-y-2">
                <Label htmlFor="participants">Agents (Participants)</Label>
                <div className="relative">
                  <Select
                    open={isAgentsDropdownOpen}
                    onOpenChange={setIsAgentsDropdownOpen}
                  >
                    <SelectTrigger
                      className="neuro-inset focus:shadow-none w-full"
                      onClick={() => setIsAgentsDropdownOpen(!isAgentsDropdownOpen)}
                    >
                      <SelectValue placeholder={`${selectedAgents.length} agent(s) selected`} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {isLoading ? (
                        <div className="text-center text-sm text-muted-foreground p-2">Loading agents...</div>
                      ) : availableAgents.length > 0 ? (
                        availableAgents.map(agent => (
                          <div
                            key={agent.id}
                            className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAgentToggle(agent.id);
                            }}
                          >
                            <Checkbox
                              id={`agent-${agent.id}`}
                              checked={selectedAgents.includes(agent.id)}
                              onCheckedChange={() => { }}
                              disabled={!isAdmin && agent.id === user?.id && selectedAgents.length <= 1}
                            />
                            <label htmlFor={`agent-${agent.id}`} className="text-sm cursor-pointer">
                              {agent.firstName} {agent.lastName} ({agent.email})
                              {agent.id === user?.id && " (You)"}
                            </label>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-sm text-muted-foreground p-2">No agents available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {selectedAgents.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Selected: {selectedAgents.map(id => {
                      const agent = availableAgents.find(a => a.id === id);
                      return agent ? `${agent.firstName} ${agent.lastName}` : '';
                    }).filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            )}

            {(isAdmin || agentId) && (
              <div className="space-y-2">
                <Label htmlFor="leads">Leads</Label>
                <div className="relative">
                  <Select
                    open={isLeadsDropdownOpen}
                    onOpenChange={setIsLeadsDropdownOpen}
                  >
                    <SelectTrigger
                      className="neuro-inset focus:shadow-none w-full"
                      onClick={() => setIsLeadsDropdownOpen(!isLeadsDropdownOpen)}
                    >
                      <SelectValue placeholder={`${selectedLeads.length} lead(s) selected`} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {isLoading ? (
                        <div className="text-center text-sm text-muted-foreground p-2">Loading leads...</div>
                      ) : availableLeads.length > 0 ? (
                        availableLeads.map(lead => (
                          <div
                            key={lead.id}
                            className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLeadToggle(lead.id);
                            }}
                          >
                            <Checkbox
                              id={`lead-${lead.id}`}
                              checked={selectedLeads.includes(lead.id)}
                              onCheckedChange={() => { }}
                            />
                            <label htmlFor={`lead-${lead.id}`} className="text-sm cursor-pointer">
                              {lead.first_name} {lead.last_name} ({lead.Email_ID})
                            </label>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-sm text-muted-foreground p-2">No leads available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {selectedLeads.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Selected: {selectedLeads.map(id => {
                      const lead = availableLeads.find(l => l.id === id);
                      return lead ? `${lead.first_name} ${lead.last_name}` : '';
                    }).filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            )}

            {conflicts.length > 0 && (
              <div className="p-3 bg-yellow-100 border border-yellow-300 rounded-md">
                <h4 className="font-medium text-yellow-800">Scheduling Conflicts Detected</h4>
                <ul className="mt-2 text-sm text-yellow-700">
                  {conflicts.map(({ agentId, conflicts }) => {
                    const agent = availableAgents.find(a => a.id === agentId);
                    return (
                      <li key={agentId}>
                        {agent?.firstName} {agent?.lastName} has conflicts:
                        <ul className="ml-4 list-disc">
                          {conflicts.map(conflict => (
                            <li key={conflict.id}>
                              {conflict.title} at {conflict.startTime} ({conflict.duration} mins)
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <DialogFooter>
              {meeting && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  className="neuro hover:shadow-none transition-all duration-300 mr-auto"
                  disabled={isLoading}
                >
                  Delete Meeting
                </Button>
              )}
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
        )}
      </DialogContent>
    </Dialog>
  );
};