// lib/activityLogger.ts
import { database } from './firebase';
import { ref, push } from 'firebase/database';

interface AgentActivity {
  agentId: string;
  leadId: string;
  activityType: 'view' | 'call' | 'email' | 'whatsapp' | 'edit' | 'status_change' | 'delete' | 'schedule_call' | 'bulk_action';
  activityDetails: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export const logAgentActivity = async (activity: Omit<AgentActivity, 'timestamp'>) => {
  try {
    const adminId = localStorage.getItem('adminId');
    if (!adminId) return;

    const activityRef = ref(database, `users/${adminId}/agentActivities`);
    await push(activityRef, {
      ...activity,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};