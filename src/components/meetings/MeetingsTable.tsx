import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Users, Phone, Mail, MessageSquare, ChevronLeft, ChevronRight, Calendar, RotateCcw, X, MapPin, FileText, Link, Clipboard, Share2, Plus, Minus, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { MeetingForm } from './MeetingForm';
import { useIsMobile } from '@/hooks/use-mobile';
import { database } from '../../firebase';
import { ref, onValue, off, remove, get, update } from 'firebase/database';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { getAuth } from 'firebase/auth';

// Encryption key - should match the one used for encryption
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8'; // 32 chars for AES-256
const FIXED_MEETING_LINK = 'https://meet.google.com/hmh-xqph-jhm';

interface Meeting {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  startTime: string;
  endTime?: string;
  duration: number;
  location?: string;
  participants: string[];
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
  leads?: string[];
  clientPortalEnabled?: boolean;
  clientPortalLink?: string;
  clientPreparation?: {
    documents?: string[];
    questions?: string[];
    notes?: string;
  };
  smartResponses?: {
    followUp?: string;
    reschedule?: string;
    cancellation?: string;
    confirmation?: string;
  };
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

// Helper function to decrypt data
async function decryptData(encryptedData: string): Promise<string> {
  if (!encryptedData || typeof encryptedData !== 'string') return encryptedData;
  
  try {
    const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(encryptedData);
    if (!isBase64) return encryptedData;

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
    return encryptedData;
  }
}

async function decryptMeeting(meeting: Meeting): Promise<Meeting> {
  const decryptedMeeting: Meeting = { ...meeting };
  
  const fieldsToDecrypt = [
    'title',
    'description',
    'location',
    'reminder',
    'status',
    'createdBy',
    'startDate',
    'startTime',
    'endTime',
    'clientPortalLink'
  ];

  await Promise.all(fieldsToDecrypt.map(async (field) => {
    if (decryptedMeeting[field as keyof Meeting]) {
      (decryptedMeeting as any)[field] = await decryptData((decryptedMeeting as any)[field]);
    }
  }));

  if (decryptedMeeting.agendaItems) {
    decryptedMeeting.agendaItems = await Promise.all(
      decryptedMeeting.agendaItems.map(async (item) => ({
        ...item,
        title: await decryptData(item.title),
        description: item.description ? await decryptData(item.description) : undefined
      }))
    );
  }

  if (decryptedMeeting.participants) {
    decryptedMeeting.participants = await Promise.all(
      decryptedMeeting.participants.map(async (participant) => await decryptData(participant))
    );
  }

  if (decryptedMeeting.leads) {
    decryptedMeeting.leads = await Promise.all(
      decryptedMeeting.leads.map(async (lead) => await decryptData(lead))
    );
  }

  if (decryptedMeeting.clientPreparation) {
    if (decryptedMeeting.clientPreparation.documents) {
      decryptedMeeting.clientPreparation.documents = await Promise.all(
        decryptedMeeting.clientPreparation.documents.map(async (doc) => await decryptData(doc))
      );
    }
    if (decryptedMeeting.clientPreparation.questions) {
      decryptedMeeting.clientPreparation.questions = await Promise.all(
        decryptedMeeting.clientPreparation.questions.map(async (q) => await decryptData(q))
      );
    }
    if (decryptedMeeting.clientPreparation.notes) {
      decryptedMeeting.clientPreparation.notes = await decryptData(decryptedMeeting.clientPreparation.notes);
    }
  }

  if (decryptedMeeting.smartResponses) {
    if (decryptedMeeting.smartResponses.followUp) {
      decryptedMeeting.smartResponses.followUp = await decryptData(decryptedMeeting.smartResponses.followUp);
    }
    if (decryptedMeeting.smartResponses.reschedule) {
      decryptedMeeting.smartResponses.reschedule = await decryptData(decryptedMeeting.smartResponses.reschedule);
    }
    if (decryptedMeeting.smartResponses.cancellation) {
      decryptedMeeting.smartResponses.cancellation = await decryptData(decryptedMeeting.smartResponses.cancellation);
    }
    if (decryptedMeeting.smartResponses.confirmation) {
      decryptedMeeting.smartResponses.confirmation = await decryptData(decryptedMeeting.smartResponses.confirmation);
    }
  }

  return decryptedMeeting;
}

async function decryptAgent(agent: Agent): Promise<Agent> {
  const decryptedAgent: Agent = { ...agent };
  
  const fieldsToDecrypt = [
    'firstName',
    'lastName',
    'email',
    'phone'
  ];

  await Promise.all(fieldsToDecrypt.map(async (field) => {
    if (decryptedAgent[field as keyof Agent]) {
      (decryptedAgent as any)[field] = await decryptData((decryptedAgent as any)[field]);
    }
  }));

  return decryptedAgent;
}

export const MeetingsTable: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [decryptedMeetings, setDecryptedMeetings] = useState<Meeting[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [decryptedAgents, setDecryptedAgents] = useState<Agent[]>([]);
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
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);
  const [clientPortalDialogOpen, setClientPortalDialogOpen] = useState(false);
  const [selectedPortalMeeting, setSelectedPortalMeeting] = useState<Meeting | null>(null);
  const [newDocument, setNewDocument] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [showSmartResponses, setShowSmartResponses] = useState(false);
  const [selectedMeetingForResponses, setSelectedMeetingForResponses] = useState<Meeting | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.email) {
        setCurrentUserEmail(user.email);
      }
    });
    return () => unsubscribe();
  }, []);

  const copyPortalLink = (meeting: Meeting) => {
    navigator.clipboard.writeText(FIXED_MEETING_LINK)
      .then(() => toast.success('Meeting link copied to clipboard'))
      .catch(() => toast.error('Failed to copy link'));
  };

  const sharePortalLink = (meeting: Meeting) => {
    if (navigator.share) {
      navigator.share({
        title: `Meeting: ${meeting.title}`,
        text: `Please join our meeting: ${meeting.title}`,
        url: FIXED_MEETING_LINK
      }).catch(() => {
        copyPortalLink(meeting);
      });
    } else {
      window.open(`mailto:?subject=Meeting: ${meeting.title}&body=Please join our meeting: ${FIXED_MEETING_LINK}`);
    }
  };

  const toggleClientPortal = async (meeting: Meeting, enabled: boolean) => {
    try {
      const updates: Partial<Meeting> = {
        clientPortalEnabled: enabled,
        clientPortalLink: FIXED_MEETING_LINK,
        clientPreparation: meeting.clientPreparation || {
          documents: [],
          questions: [],
          notes: ''
        },
        location: FIXED_MEETING_LINK
      };

      if (isAdmin && adminId) {
        await update(ref(database, `users/${adminId}/meetingdetails/${meeting.id}`), updates);
        
        if (meeting.participants?.length > 0) {
          const participantUpdates: Record<string, any> = {};
          meeting.participants.forEach(participantId => {
            participantUpdates[`users/${adminId}/agents/${participantId}/meetingdetails/${meeting.id}`] = updates;
          });
          await update(ref(database), participantUpdates);
        }
      } else if (agentId && adminId) {
        await update(ref(database, `users/${adminId}/agents/${agentId}/meetingdetails/${meeting.id}`), updates);
        await update(ref(database, `users/${adminId}/meetingdetails/${meeting.id}`), updates);
      }

      toast.success(`Client portal ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating client portal:', error);
      toast.error('Failed to update client portal');
    }
  };

  const viewClientPortal = (meeting: Meeting) => {
    setSelectedPortalMeeting(meeting);
    setClientNotes(meeting.clientPreparation?.notes || '');
    setClientPortalDialogOpen(true);
  };

  const addDocument = async () => {
    if (!newDocument.trim() || !selectedPortalMeeting) return;
    
    try {
      const updatedMeeting = { ...selectedPortalMeeting };
      if (!updatedMeeting.clientPreparation) {
        updatedMeeting.clientPreparation = {
          documents: [],
          questions: [],
          notes: ''
        };
      }
      updatedMeeting.clientPreparation.documents = [
        ...(updatedMeeting.clientPreparation.documents || []),
        newDocument.trim()
      ];

      await updateMeetingClientPreparation(updatedMeeting);
      setNewDocument('');
      toast.success('Document added successfully');
    } catch (error) {
      console.error('Error adding document:', error);
      toast.error('Failed to add document');
    }
  };

  const removeDocument = async (index: number) => {
    if (!selectedPortalMeeting || !selectedPortalMeeting.clientPreparation?.documents) return;
    
    try {
      const updatedMeeting = { ...selectedPortalMeeting };
      updatedMeeting.clientPreparation.documents = [
        ...updatedMeeting.clientPreparation.documents.slice(0, index),
        ...updatedMeeting.clientPreparation.documents.slice(index + 1)
      ];

      await updateMeetingClientPreparation(updatedMeeting);
      toast.success('Document removed successfully');
    } catch (error) {
      console.error('Error removing document:', error);
      toast.error('Failed to remove document');
    }
  };

  const addQuestion = async () => {
    if (!newQuestion.trim() || !selectedPortalMeeting) return;
    
    try {
      const updatedMeeting = { ...selectedPortalMeeting };
      if (!updatedMeeting.clientPreparation) {
        updatedMeeting.clientPreparation = {
          documents: [],
          questions: [],
          notes: ''
        };
      }
      updatedMeeting.clientPreparation.questions = [
        ...(updatedMeeting.clientPreparation.questions || []),
        newQuestion.trim()
      ];

      await updateMeetingClientPreparation(updatedMeeting);
      setNewQuestion('');
      toast.success('Question added successfully');
    } catch (error) {
      console.error('Error adding question:', error);
      toast.error('Failed to add question');
    }
  };

  const removeQuestion = async (index: number) => {
    if (!selectedPortalMeeting || !selectedPortalMeeting.clientPreparation?.questions) return;
    
    try {
      const updatedMeeting = { ...selectedPortalMeeting };
      updatedMeeting.clientPreparation.questions = [
        ...updatedMeeting.clientPreparation.questions.slice(0, index),
        ...updatedMeeting.clientPreparation.questions.slice(index + 1)
      ];

      await updateMeetingClientPreparation(updatedMeeting);
      toast.success('Question removed successfully');
    } catch (error) {
      console.error('Error removing question:', error);
      toast.error('Failed to remove question');
    }
  };

  const updateNotes = async () => {
    if (!selectedPortalMeeting) return;
    
    try {
      const updatedMeeting = { ...selectedPortalMeeting };
      if (!updatedMeeting.clientPreparation) {
        updatedMeeting.clientPreparation = {
          documents: [],
          questions: [],
          notes: clientNotes
        };
      } else {
        updatedMeeting.clientPreparation.notes = clientNotes;
      }

      await updateMeetingClientPreparation(updatedMeeting);
      toast.success('Notes updated successfully');
    } catch (error) {
      console.error('Error updating notes:', error);
      toast.error('Failed to update notes');
    }
  };

  const updateMeetingClientPreparation = async (meeting: Meeting) => {
    try {
      const updates = {
        clientPreparation: meeting.clientPreparation,
        clientPortalLink: FIXED_MEETING_LINK,
        location: FIXED_MEETING_LINK
      };

      if (isAdmin && adminId) {
        await update(ref(database, `users/${adminId}/meetingdetails/${meeting.id}`), updates);
        
        if (meeting.participants?.length > 0) {
          const participantUpdates: Record<string, any> = {};
          meeting.participants.forEach(participantId => {
            participantUpdates[`users/${adminId}/agents/${participantId}/meetingdetails/${meeting.id}`] = updates;
          });
          await update(ref(database), participantUpdates);
        }
      } else if (agentId && adminId) {
        await update(ref(database, `users/${adminId}/agents/${agentId}/meetingdetails/${meeting.id}`), updates);
        await update(ref(database, `users/${adminId}/meetingdetails/${meeting.id}`), updates);
      }

      setSelectedPortalMeeting(meeting);
      setDecryptedMeetings(prev => 
        prev.map(m => m.id === meeting.id ? meeting : m)
      );
    } catch (error) {
      console.error('Error updating meeting preparation:', error);
      throw error;
    }
  };

  const generateSmartResponses = async (meeting: Meeting) => {
    try {
      const mockResponses = {
        followUp: `Hi [Client Name],\n\nThank you for attending our meeting about "${meeting.title}" on ${meeting.startDate}. As discussed, here are the next steps:\n\n1. [Action Item 1]\n2. [Action Item 2]\n\nPlease don't hesitate to reach out if you have any questions.\n\nBest regards,\n[Your Name]`,
        reschedule: `Hi [Client Name],\n\nI hope this message finds you well. I wanted to check if we could reschedule our meeting about "${meeting.title}" currently set for ${meeting.startDate} at ${meeting.startTime}.\n\nWould any of these alternative times work for you?\n\n1. [Alternative Date/Time 1]\n2. [Alternative Date/Time 2]\n\nPlease let me know what works best for your schedule.\n\nBest regards,\n[Your Name]`,
        cancellation: `Hi [Client Name],\n\nI'm writing to inform you that we need to cancel our upcoming meeting about "${meeting.title}" scheduled for ${meeting.startDate} at ${meeting.startTime} due to [reason].\n\nI apologize for any inconvenience this may cause. We can reschedule at your earliest convenience.\n\nBest regards,\n[Your Name]`,
        confirmation: `Hi [Client Name],\n\nThis is a confirmation of our meeting about "${meeting.title}" scheduled for ${meeting.startDate} at ${meeting.startTime}.\n\nMeeting Details:\n- Location: ${FIXED_MEETING_LINK}\n- Duration: ${meeting.duration} minutes\n\nPlease let me know if you need to reschedule or if you have any questions beforehand.\n\nLooking forward to our discussion!\n\nBest regards,\n[Your Name]`
      };

      const updates = {
        smartResponses: mockResponses
      };

      if (isAdmin && adminId) {
        await update(ref(database, `users/${adminId}/meetingdetails/${meeting.id}`), updates);
        
        if (meeting.participants?.length > 0) {
          const participantUpdates: Record<string, any> = {};
          meeting.participants.forEach(participantId => {
            participantUpdates[`users/${adminId}/agents/${participantId}/meetingdetails/${meeting.id}`] = updates;
          });
          await update(ref(database), participantUpdates);
        }
      } else if (agentId && adminId) {
        await update(ref(database, `users/${adminId}/agents/${agentId}/meetingdetails/${meeting.id}`), updates);
        await update(ref(database, `users/${adminId}/meetingdetails/${meeting.id}`), updates);
      }

      setDecryptedMeetings(prev => 
        prev.map(m => m.id === meeting.id ? {...m, smartResponses: mockResponses} : m)
      );
      
      setSelectedMeetingForResponses({...meeting, smartResponses: mockResponses});
      setShowSmartResponses(true);
      toast.success('Smart responses generated successfully');
    } catch (error) {
      console.error('Error generating smart responses:', error);
      toast.error('Failed to generate smart responses');
    }
  };

  const copyResponse = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success('Response copied to clipboard'))
      .catch(() => toast.error('Failed to copy response'));
  };

  const sendEmailWithResponse = (subject: string, body: string) => {
    try {
      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(body);
      
      // First try to open Gmail directly
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodedSubject}&body=${encodedBody}`;
      const gmailWindow = window.open(gmailUrl, '_blank');
      
      // Fallback to regular mailto: if Gmail doesn't open
      setTimeout(() => {
        if (!gmailWindow || gmailWindow.closed || typeof gmailWindow.closed === 'undefined') {
          window.open(`mailto:?subject=${encodedSubject}&body=${encodedBody}`);
        }
      }, 500);
    } catch (error) {
      console.error('Error opening email client:', error);
      toast.error('Failed to open email client');
    }
  };

  useEffect(() => {
    const decryptAllMeetings = async () => {
      if (meetings.length === 0) return;
      
      setIsDecrypting(true);
      try {
        const decrypted = await Promise.all(meetings.map(meeting => decryptMeeting(meeting)));
        setDecryptedMeetings(decrypted);
      } catch (error) {
        console.error('Error decrypting meetings:', error);
        setDecryptedMeetings(meetings);
      } finally {
        setIsDecrypting(false);
      }
    };

    decryptAllMeetings();
  }, [meetings]);

  useEffect(() => {
    const decryptAllAgents = async () => {
      if (agents.length === 0) return;
      
      try {
        const decrypted = await Promise.all(agents.map(agent => decryptAgent(agent)));
        setDecryptedAgents(decrypted);
      } catch (error) {
        console.error('Error decrypting agents:', error);
        setDecryptedAgents(agents);
      }
    };

    decryptAllAgents();
  }, [agents]);

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
      const meetingWithFixedLink = {
        ...meeting,
        clientPortalLink: FIXED_MEETING_LINK,
        location: FIXED_MEETING_LINK
      };

      if (isAdmin && adminId) {
        await update(ref(database, `users/${adminId}/meetingdetails/${meeting.id}`), meetingWithFixedLink);

        if (meeting.participants?.length > 0) {
          const updates: Record<string, any> = {};
          meeting.participants.forEach(agentId => {
            updates[`users/${adminId}/agents/${agentId}/meetingdetails/${meeting.id}`] = meetingWithFixedLink;
          });
          await update(ref(database), updates);
        }
      } else if (agentId && adminId) {
        await update(ref(database, `users/${adminId}/agents/${agentId}/meetingdetails/${meeting.id}`), meetingWithFixedLink);
        await update(ref(database, `users/${adminId}/meetingdetails/${meeting.id}`), meetingWithFixedLink);
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
    decryptedMeetings.forEach(meeting => {
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
      window.open(FIXED_MEETING_LINK, '_blank');
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
  }, [decryptedMeetings, shownNotifications]);

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
            ...childSnapshot.val(),
            clientPortalLink: FIXED_MEETING_LINK,
            location: FIXED_MEETING_LINK
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
    if (decryptedMeetings.length > 0) {
      const timer = setTimeout(() => {
        createDailyBackup(decryptedMeetings);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [decryptedMeetings]);

  useEffect(() => {
    loadDailyBackups();
  }, []);

  const filteredMeetings = decryptedMeetings.filter(meeting => {
    return meeting.title?.toLowerCase().includes(searchTerm?.toLowerCase());
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

  const handleDeleteClick = (id: string) => {
    setMeetingToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!meetingToDelete) return;
    
    try {
      const meetingToDeleteObj = decryptedMeetings.find(m => m.id === meetingToDelete);
      if (!meetingToDeleteObj) {
        toast.error('Meeting not found');
        return;
      }

      if (isAdmin && adminId) {
        await remove(ref(database, `users/${adminId}/meetingdetails/${meetingToDelete}`));

        if (meetingToDeleteObj.participants?.length > 0) {
          const updates: Record<string, null> = {};
          meetingToDeleteObj.participants.forEach(participantId => {
            updates[`users/${adminId}/agents/${participantId}/meetingdetails/${meetingToDelete}`] = null;
          });
          await update(ref(database), updates);
        }

        if (meetingToDeleteObj.agentId) {
          await remove(ref(database, `users/${adminId}/agents/${meetingToDeleteObj.agentId}/meetingdetails/${meetingToDelete}`));
        }
      } else if (agentId && adminId) {
        await remove(ref(database, `users/${adminId}/agents/${agentId}/meetingdetails/${meetingToDelete}`));
        
        const adminMeetingsRef = ref(database, `users/${adminId}/meetingdetails`);
        const snapshot = await get(adminMeetingsRef);
        if (snapshot.exists()) {
          snapshot.forEach(child => {
            const meeting = child.val();
            if (meeting.agentId === agentId && meeting.id === meetingToDelete) {
              remove(ref(database, `users/${adminId}/meetingdetails/${child.key}`));
            }
          });
        }
      }

      setDecryptedMeetings(prev => prev.filter(m => m.id !== meetingToDelete));
      setMeetings(prev => prev.filter(m => m.id !== meetingToDelete));
      
      toast.success('Meeting deleted successfully');
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast.error('Failed to delete meeting');
    } finally {
      setDeleteDialogOpen(false);
      setMeetingToDelete(null);
    }
  };

  const handleEdit = async (meeting: Meeting) => {
    try {
      setIsDecrypting(true);
      
      const decryptedMeeting = await decryptMeeting(meeting);
      
      const completeMeeting = {
        ...decryptedMeeting,
        participants: decryptedMeeting.participants || [],
        agendaItems: decryptedMeeting.agendaItems || [],
        leads: decryptedMeeting.leads || [],
        clientPortalLink: FIXED_MEETING_LINK,
        location: FIXED_MEETING_LINK
      };
      
      setSelectedMeeting(completeMeeting);
      setIsAddingMeeting(true);
    } catch (error) {
      console.error('Error decrypting meeting for edit:', error);
      toast.error('Failed to load meeting for editing');
      setSelectedMeeting({
        ...meeting,
        participants: meeting.participants || [],
        agendaItems: meeting.agendaItems || [],
        leads: meeting.leads || [],
        clientPortalLink: FIXED_MEETING_LINK,
        location: FIXED_MEETING_LINK
      });
      setIsAddingMeeting(true);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleCall = (participantId: string) => {
    const participant = decryptedAgents.find(a => a.id === participantId);
    if (participant?.phone) {
      window.open(`tel:${participant.phone}`, '_blank');
    } else {
      toast.warning('No phone number available for this participant');
    }
  };

  const handleEmail = (participantId: string) => {
    const participant = decryptedAgents.find(a => a.id === participantId);
    if (participant?.email) {
      window.open(`mailto:${participant.email}?subject=Regarding our meeting`, '_blank');
    } else {
      toast.warning('No email available for this participant');
    }
  };

  const handleWhatsApp = (participantId: string) => {
    const participant = decryptedAgents.find(a => a.id === participantId);
    if (participant?.phone) {
      const phone = participant.phone.startsWith('+') ? participant.phone : `+${participant.phone}`;
      window.open(`https://wa.me/${phone}`, '_blank');
    } else {
      toast.warning('No phone number available for WhatsApp');
    }
  };

  const getParticipantNames = (participantIds: string[]): {id: string, name: string, phone?: string, email?: string}[] => {
    if (!decryptedAgents || decryptedAgents.length === 0) return [{id: 'loading', name: 'Loading...'}];
    
    return participantIds.map(id => {
      const agent = decryptedAgents.find(a => a.id === id);
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

  const handleMeetingSubmit = async (meetingData: Meeting) => {
    try {
      const meetingWithFixedLink = {
        ...meetingData,
        clientPortalLink: FIXED_MEETING_LINK,
        location: FIXED_MEETING_LINK
      };

      if (isAdmin && adminId) {
        if (selectedMeeting) {
          await update(ref(database, `users/${adminId}/meetingdetails/${selectedMeeting.id}`), meetingWithFixedLink);
          
          if (meetingData.participants?.length > 0) {
            const updates: Record<string, any> = {};
            meetingData.participants.forEach(participantId => {
              updates[`users/${adminId}/agents/${participantId}/meetingdetails/${selectedMeeting.id}`] = meetingWithFixedLink;
            });
            await update(ref(database), updates);
          }
          
          toast.success('Meeting updated successfully');
        } else {
          const newMeetingRef = ref(database, `users/${adminId}/meetingdetails`);
          const newMeeting = await update(newMeetingRef, { [meetingData.id]: meetingWithFixedLink });
          
          if (meetingData.participants?.length > 0) {
            const updates: Record<string, any> = {};
            meetingData.participants.forEach(participantId => {
              updates[`users/${adminId}/agents/${participantId}/meetingdetails/${meetingData.id}`] = meetingWithFixedLink;
            });
            await update(ref(database), updates);
          }
          
          toast.success('Meeting created successfully');
        }
      } else if (agentId && adminId) {
        if (selectedMeeting) {
          await update(ref(database, `users/${adminId}/agents/${agentId}/meetingdetails/${selectedMeeting.id}`), meetingWithFixedLink);
          await update(ref(database, `users/${adminId}/meetingdetails/${selectedMeeting.id}`), meetingWithFixedLink);
          toast.success('Meeting updated successfully');
        } else {
          const newMeetingRef = ref(database, `users/${adminId}/agents/${agentId}/meetingdetails`);
          const newMeeting = await update(newMeetingRef, { [meetingData.id]: meetingWithFixedLink });
          await update(ref(database, `users/${adminId}/meetingdetails/${meetingData.id}`), meetingWithFixedLink);
          toast.success('Meeting created successfully');
        }
      }
      
      setIsAddingMeeting(false);
      setSelectedMeeting(null);
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast.error('Failed to save meeting');
    }
  };

  const renderClientPortalActions = (meeting: Meeting) => {
    return (
      <div className="flex space-x-1">
        {meeting.clientPortalEnabled ? (
          <>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-blue-500 hover:text-blue-600"
              onClick={() => viewClientPortal(meeting)}
              title="View Portal"
            >
              <Link className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-purple-500 hover:text-purple-600"
              onClick={() => copyPortalLink(meeting)}
              title="Copy Link"
            >
              <Clipboard className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-green-500 hover:text-green-600"
              onClick={() => sharePortalLink(meeting)}
              title="Share Portal"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-gray-500 hover:text-gray-600"
            onClick={() => toggleClientPortal(meeting, true)}
            title="Enable Portal"
          >
            <Link className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this meeting? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clientPortalDialogOpen} onOpenChange={setClientPortalDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Client Portal: {selectedPortalMeeting?.title}</DialogTitle>
            <DialogDescription>
              Manage the client-facing portal for this meeting
            </DialogDescription>
          </DialogHeader>
          
          {selectedPortalMeeting && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Portal Status</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPortalMeeting.clientPortalEnabled ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <Button
                  variant={selectedPortalMeeting.clientPortalEnabled ? "destructive" : "default"}
                  onClick={() => toggleClientPortal(selectedPortalMeeting, !selectedPortalMeeting.clientPortalEnabled)}
                >
                  {selectedPortalMeeting.clientPortalEnabled ? 'Disable Portal' : 'Enable Portal'}
                </Button>
              </div>

              {selectedPortalMeeting.clientPortalEnabled && (
                <>
                  <div>
                    <p className="font-medium">Meeting Link</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={FIXED_MEETING_LINK}
                        readOnly
                        className="flex-1"
                      />
                      <Button variant="outline" onClick={() => copyPortalLink(selectedPortalMeeting)}>
                        <Clipboard className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button variant="outline" onClick={() => sharePortalLink(selectedPortalMeeting)}>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="font-medium">Meeting Details</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="border rounded-lg p-4">
                        <p className="text-sm font-medium text-muted-foreground">Date & Time</p>
                        <p>{selectedPortalMeeting.startDate} @ {selectedPortalMeeting.startTime}</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm font-medium text-muted-foreground">Duration</p>
                        <p>{selectedPortalMeeting.duration} minutes</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm font-medium text-muted-foreground">Location</p>
                        <p>{FIXED_MEETING_LINK}</p>
                      </div>
                      {selectedPortalMeeting.description && (
                        <div className="border rounded-lg p-4 md:col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">Description</p>
                          <p>{selectedPortalMeeting.description}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="font-medium">Client Preparation</p>
                    <div className="space-y-4 mt-2">
                      <div className="border rounded-lg p-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Documents Needed</p>
                        {selectedPortalMeeting.clientPreparation?.documents?.length ? (
                          <ul className="space-y-2 max-h-40 overflow-y-auto">
                            {selectedPortalMeeting.clientPreparation.documents.map((doc, index) => (
                              <li key={index} className="flex items-center justify-between group">
                                <div className="flex items-center">
                                  <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                                  <span className="truncate">{doc}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => removeDocument(index)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">No documents requested</p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Input
                            value={newDocument}
                            onChange={(e) => setNewDocument(e.target.value)}
                            placeholder="Add new document"
                            className="flex-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                addDocument();
                              }
                            }}
                          />
                          <Button 
                            onClick={addDocument}
                            disabled={!newDocument.trim()}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add
                          </Button>
                        </div>
                      </div>

                      <div className="border rounded-lg p-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Questions to Prepare</p>
                        {selectedPortalMeeting.clientPreparation?.questions?.length ? (
                          <ul className="space-y-2 max-h-40 overflow-y-auto">
                            {selectedPortalMeeting.clientPreparation.questions.map((q, index) => (
                              <li key={index} className="flex items-start justify-between group">
                                <div className="flex items-start flex-1 min-w-0">
                                  <span className="inline-block h-4 w-4 mr-2 mt-0.5">•</span>
                                  <span className="truncate">{q}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => removeQuestion(index)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">No questions to prepare</p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Input
                            value={newQuestion}
                            onChange={(e) => setNewQuestion(e.target.value)}
                            placeholder="Add new question"
                            className="flex-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                addQuestion();
                              }
                            }}
                          />
                          <Button 
                            onClick={addQuestion}
                            disabled={!newQuestion.trim()}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add
                          </Button>
                        </div>
                      </div>

                      <div className="border rounded-lg p-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Additional Notes</p>
                        <Textarea
                          value={clientNotes}
                          onChange={(e) => setClientNotes(e.target.value)}
                          placeholder="Enter notes for the client..."
                          className="min-h-[100px]"
                        />
                        <div className="flex justify-end mt-2">
                          <Button 
                            onClick={updateNotes}
                            disabled={clientNotes === selectedPortalMeeting.clientPreparation?.notes}
                          >
                            Save Notes
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={() => {
                setClientPortalDialogOpen(false);
                setSelectedPortalMeeting(null);
              }}
            >
              Close
            </Button>
            {selectedPortalMeeting?.clientPortalEnabled && (
              <Button 
                onClick={() => {
                  window.open(FIXED_MEETING_LINK, '_blank');
                }}
              >
                Join Meeting
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSmartResponses} onOpenChange={setShowSmartResponses}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Smart Responses: {selectedMeetingForResponses?.title}</DialogTitle>
            <DialogDescription>
              AI-generated response templates for client communications
            </DialogDescription>
          </DialogHeader>
          
          {selectedMeetingForResponses && (
            <div className="space-y-6">
              {!selectedMeetingForResponses.smartResponses ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No smart responses generated yet</p>
                  <Button onClick={() => generateSmartResponses(selectedMeetingForResponses)}>
                    <Bot className="h-4 w-4 mr-2" />
                    Generate Responses
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <h4 className="font-medium">Follow-up Email</h4>
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <Textarea
                        value={selectedMeetingForResponses.smartResponses.followUp || ''}
                        readOnly
                        className="min-h-[150px] bg-background"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => copyResponse(selectedMeetingForResponses.smartResponses?.followUp || '')}
                      >
                        <Clipboard className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button 
                        onClick={() => sendEmailWithResponse(
                          `Follow-up: ${selectedMeetingForResponses.title}`,
                          selectedMeetingForResponses.smartResponses?.followUp || ''
                        )}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Open in Email
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Reschedule Request</h4>
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <Textarea
                        value={selectedMeetingForResponses.smartResponses.reschedule || ''}
                        readOnly
                        className="min-h-[150px] bg-background"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => copyResponse(selectedMeetingForResponses.smartResponses?.reschedule || '')}
                      >
                        <Clipboard className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button 
                        onClick={() => sendEmailWithResponse(
                          `Reschedule Request: ${selectedMeetingForResponses.title}`,
                          selectedMeetingForResponses.smartResponses?.reschedule || ''
                        )}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Open in Email
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Cancellation Notice</h4>
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <Textarea
                        value={selectedMeetingForResponses.smartResponses.cancellation || ''}
                        readOnly
                        className="min-h-[150px] bg-background"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => copyResponse(selectedMeetingForResponses.smartResponses?.cancellation || '')}
                      >
                        <Clipboard className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button 
                        onClick={() => sendEmailWithResponse(
                          `Cancellation: ${selectedMeetingForResponses.title}`,
                          selectedMeetingForResponses.smartResponses?.cancellation || ''
                        )}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Open in Email
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Confirmation Email</h4>
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <Textarea
                        value={selectedMeetingForResponses.smartResponses.confirmation || ''}
                        readOnly
                        className="min-h-[150px] bg-background"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => copyResponse(selectedMeetingForResponses.smartResponses?.confirmation || '')}
                      >
                        <Clipboard className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button 
                        onClick={() => sendEmailWithResponse(
                          `Confirmation: ${selectedMeetingForResponses.title}`,
                          selectedMeetingForResponses.smartResponses?.confirmation || ''
                        )}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Open in Email
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={() => setShowSmartResponses(false)}
            >
              Close
            </Button>
            {selectedMeetingForResponses && !selectedMeetingForResponses.smartResponses && (
              <Button 
                onClick={() => generateSmartResponses(selectedMeetingForResponses)}
              >
                <Bot className="h-4 w-4 mr-2" />
                Generate Responses
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Calendar className="h-4 w-4 mr-1" />
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
                    backupMeeting => !decryptedMeetings.some(currentMeeting => currentMeeting.id === backupMeeting.id)
                  );
                  const filteredDeletedMeetings = backup.deletedMeetings?.filter(
                    deletedMeeting => !decryptedMeetings.some(currentMeeting => currentMeeting.id === deletedMeeting.id)
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

      {isDecrypting ? (
        <div className="flex justify-center items-center h-32">
          Decrypting meeting data...
        </div>
      ) : filteredMeetings.length > 0 ? (
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
                      {meeting.description && (
                        <p className="text-xs text-muted-foreground truncate">{meeting.description}</p>
                      )}
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
                          onClick={() => handleDeleteClick(meeting.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-purple-500 hover:text-purple-600"
                          onClick={() => {
                            setSelectedMeetingForResponses(meeting);
                            setShowSmartResponses(true);
                          }}
                          title="Smart Responses"
                        >
                          <Bot className="h-4 w-4" />
                        </Button>
                        {renderClientPortalActions(meeting)}
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
                
                {meeting.description && (
                  <p className="text-sm text-muted-foreground mt-1">{meeting.description}</p>
                )}
                
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
                    onClick={() => handleDeleteClick(meeting.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-purple-500 hover:text-purple-600"
                    onClick={() => {
                      setSelectedMeetingForResponses(meeting);
                      setShowSmartResponses(true);
                    }}
                    title="Smart Responses"
                  >
                    <Bot className="h-4 w-4" />
                  </Button>
                  {renderClientPortalActions(meeting)}
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
        onSubmit={handleMeetingSubmit}
        meeting={selectedMeeting}
      />

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
              
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 mt-0.5 text-blue-500 dark:text-blue-400" />
                <div>
                  <p className="font-medium dark:text-white">Meeting Link</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {FIXED_MEETING_LINK}
                  </p>
                </div>
              </div>
              
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
              <Button 
                onClick={handleJoinMeeting}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
              >
                Join Meeting
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};