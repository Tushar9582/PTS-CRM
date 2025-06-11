// utils/activityLogger.ts
import { database } from '../firebase';
import { ref, push, set, get } from 'firebase/database';
import { decryptObject, encryptObject } from './utils';

// types.ts
export type AgentActivity = {
    id?: string;
    agentId: string;
    leadId: string; // 'multiple' for bulk actions
    activityType: 'view' | 'call' | 'email' | 'whatsapp' | 'edit' | 'status_change' | 'delete' | 'schedule_call' | 'bulk_action';
    activityDetails: string | Record<string, any>;
    timestamp: string;
    metadata?: Record<string, any>;
  };
export const logAgentActivity = async (
  adminId: string,
  activity: AgentActivity
): Promise<void> => {
  if (!adminId) return;

  try {
    // Decrypt any encrypted data in activityDetails before storing
    const decryptedDetails = await decryptObject(activity.activityDetails);
    
    // Prepare the activity data to store
    const activityData = {
      ...activity,
      activityDetails: decryptedDetails,
      timestamp: new Date().toISOString()
    };

    // Encrypt the entire activity data before storing
    const encryptedActivity = await encryptObject(activityData);

    const activitiesRef = ref(database, `users/${adminId}/agentActivities`);
    await push(activitiesRef, encryptedActivity);
  } catch (error) {
    console.error('Error logging agent activity:', error);
  }
};

export const getAgentActivities = async (
  adminId: string,
  agentId?: string,
  leadId?: string,
  limit = 50
): Promise<AgentActivity[]> => {
  if (!adminId) return [];

  try {
    const activitiesRef = ref(database, `users/${adminId}/agentActivities`);
    const snapshot = await get(activitiesRef);
    const activitiesData = snapshot.val();

    if (!activitiesData) return [];

    const activityEntries = Object.entries(activitiesData);

    const decryptedActivities = await Promise.all(
      activityEntries.map(async ([pushKey, encryptedActivity]) => {
        try {
          const decrypted = await decryptObject(encryptedActivity) as AgentActivity;
          return {
            ...decrypted,
            id: pushKey
          };
        } catch (error) {
          console.error('Error decrypting activity:', pushKey, error);
          return null;
        }
      })
    );

    // Filter and sort activities
    let filteredActivities = decryptedActivities
      .filter((activity): activity is AgentActivity => activity !== null)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply filters if provided
    if (agentId) {
      filteredActivities = filteredActivities.filter(activity => activity.agentId === agentId);
    }
    if (leadId) {
      filteredActivities = filteredActivities.filter(activity => activity.leadId === leadId);
    }

    return filteredActivities.slice(0, limit);
  } catch (error) {
    console.error('Error fetching agent activities:', error);
    return [];
  }
};