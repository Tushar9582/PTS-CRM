import React, { useState, useEffect, useCallback } from 'react';
import { Edit, Trash2, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Undo, Clock, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Task } from '@/lib/mockData';
import { useIsMobile } from '@/hooks/use-mobile';
import { AddTaskForm } from './AddTaskForm';
import { database } from '../../firebase';
import { ref, onValue, off, remove, set, push, update, query, orderByChild, endAt, get } from 'firebase/database';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO, isBefore, isAfter, addDays, differenceInDays } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

interface Agent {
  id: string;
  name: string;
  email: string;
  status: string;
  taskCount?: number;
  lastAssigned?: string;
}

export const TasksTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [backupTasks, setBackupTasks] = useState<Task[]>([]);
  const [showBackup, setShowBackup] = useState(false);
  const [showAutomationSettings, setShowAutomationSettings] = useState(false);
  const isMobile = useIsMobile();
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey');
  const { user, isAdmin } = useAuth();

  // Automation settings state
  const [automationSettings, setAutomationSettings] = useState({
    autoCleanupDays: 30,
    autoStatusUpdate: true,
    autoAssignTasks: true,
    notifyOverdue: true,
    notifyDueSoon: true
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [currentBackupPage, setCurrentBackupPage] = useState(1);
  const tasksPerPage = 10;

  // Fetch tasks from Firebase based on user role
useEffect(() => {
  let tasksRef;
  
  if (isAdmin && adminId) {
    // Admin sees all tasks
    tasksRef = ref(database, `users/${adminId}/tasks`);
  } else if (agentId && adminId) {
    // Agent sees only their assigned tasks
    tasksRef = ref(database, `users/${adminId}/tasks`);
    // We'll filter these tasks later to only show those assigned to this agent
  } else {
    return;
  }

  const fetchTasks = () => {
    onValue(tasksRef, (snapshot) => {
      const tasksData: Task[] = [];
      snapshot.forEach((childSnapshot) => {
        const task = {
          id: childSnapshot.key || '',
          ...childSnapshot.val()
        };
        
        // If this is an agent view, only include tasks assigned to them
        if (!isAdmin && task.agentId !== agentId) return;
        
        tasksData.push(task);
      });
      setTasks(tasksData);
      setCurrentPage(1); // Reset to first page when tasks change
    });
  };

  fetchTasks();

  return () => {
    if (tasksRef) {
      off(tasksRef);
    }
  };
}, [isAdmin, adminId, agentId]);

  // Fetch backup tasks
  useEffect(() => {
    if (!adminId) return;

    const backupRef = ref(database, `users/${adminId}/backups/tasks`);
    
    const fetchBackupTasks = () => {
      onValue(backupRef, (snapshot) => {
        const backupData: Task[] = [];
        snapshot.forEach((childSnapshot) => {
          backupData.push({
            id: childSnapshot.key || '',
            ...childSnapshot.val()
          });
        });
        setBackupTasks(backupData);
      });
    };

    fetchBackupTasks();

    return () => {
      off(backupRef);
    };
  }, [adminId]);

  // Fetch agents data (for task assignment)
  useEffect(() => {
    if (!adminId) return;

    const agentsRef = ref(database, `users/${adminId}/agents`);
    
    const fetchAgents = () => {
      onValue(agentsRef, (snapshot) => {
        const agentsData: Agent[] = [];
        snapshot.forEach((childSnapshot) => {
          agentsData.push({
            id: childSnapshot.key || '',
            ...childSnapshot.val()
          });
        });
        
        // Fetch task counts for each agent
        Promise.all(agentsData.map(async agent => {
          const tasksRef = ref(database, `users/${adminId}/agents/${agent.id}/tasks`);
          const tasksSnapshot = await get(query(tasksRef, orderByChild('status'), endAt('in_progress')));
          const taskCount = tasksSnapshot.exists() ? tasksSnapshot.size : 0;
          
          return {
            ...agent,
            taskCount,
            lastAssigned: agent.lastAssigned || ''
          };
        })).then(updatedAgents => {
          setAgents(updatedAgents);
        });
      });
    };

    fetchAgents();

    return () => {
      off(agentsRef);
    };
  }, [adminId]);

  // Load automation settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('taskAutomationSettings');
    if (savedSettings) {
      setAutomationSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Save automation settings to localStorage
  useEffect(() => {
    localStorage.setItem('taskAutomationSettings', JSON.stringify(automationSettings));
  }, [automationSettings]);

  // Automatically clean up old completed tasks
  useEffect(() => {
    if (!adminId || !isAdmin) return;

    const cleanupOldTasks = async () => {
      try {
        const now = new Date();
        const cutoffDate = format(addDays(now, -automationSettings.autoCleanupDays), 'yyyy-MM-dd');
        
        const tasksRef = ref(database, `users/${adminId}/tasks`);
        const snapshot = await get(query(tasksRef, orderByChild('endDate'), endAt(cutoffDate)));
        
        if (snapshot.exists()) {
          const updates: Record<string, any> = {};
          const tasksToDelete: Task[] = [];
          
          snapshot.forEach(childSnapshot => {
            const task = childSnapshot.val();
            // Only clean up completed tasks that are past the cutoff date
            if (task.status === 'completed' && isBefore(parseISO(task.endDate), parseISO(cutoffDate))) {
              updates[`users/${adminId}/tasks/${childSnapshot.key}`] = null;
              updates[`users/${adminId}/backups/tasks/${childSnapshot.key}`] = {
                ...task,
                deletedAt: new Date().toISOString(),
                deletedBy: 'system (auto-cleanup)'
              };
              tasksToDelete.push(task);
            }
          });
          
          if (Object.keys(updates).length > 0) {
            await update(ref(database), updates);
            console.log(`Automatically cleaned up ${tasksToDelete.length} old tasks`);
            
          }
        }
      } catch (error) {
        console.error('Error during automatic task cleanup:', error);
      }
    };

    // Run cleanup once per day
    const cleanupInterval = setInterval(cleanupOldTasks, 24 * 60 * 60 * 1000);
    
    // Initial cleanup
    cleanupOldTasks();
    
    return () => clearInterval(cleanupInterval);
  }, [adminId, isAdmin, automationSettings.autoCleanupDays]);

  // Automatically update task statuses based on dates
  useEffect(() => {
    if (!automationSettings.autoStatusUpdate || !adminId) return;
// In the automatic status updates effect, remove the overdue logic
const updateTaskStatuses = async () => {
  try {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    
    const tasksRef = ref(database, `users/${adminId}/tasks`);
    const snapshot = await get(tasksRef);

    if (snapshot.exists()) {
      const updates: Record<string, any> = {};
      
      snapshot.forEach(childSnapshot => {
        const task = childSnapshot.val();
        const taskId = childSnapshot.key;
        
        // Skip if task is already completed
        if (task.status === 'completed') return;
        
        // Update tasks that should be in progress today
        if (task.startDate === today && task.status === 'pending') {
          updates[`users/${adminId}/tasks/${taskId}/status`] = 'in_progress';
        }
        
        // Notify for tasks due soon (within 1 day)
        if (automationSettings.notifyDueSoon && 
            differenceInDays(parseISO(task.endDate), now) <= 1 && 
            task.status === 'in_progress') {
          updates[`users/${adminId}/notifications/${taskId}_due_soon`] = {
            type: 'task-due-soon',
            taskId,
            title: `Task Due Soon: ${task.title}`,
            message: `The task "${task.title}" is due soon`,
            timestamp: new Date().toISOString(),
            read: false
          };
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
      }
    }
  } catch (error) {
    console.error('Error during automatic status update:', error);
  }
};

    // Run status updates every hour
    const statusUpdateInterval = setInterval(updateTaskStatuses, 60 * 60 * 1000);
    
    // Initial update
    updateTaskStatuses();
    
    return () => clearInterval(statusUpdateInterval);
  }, [adminId, automationSettings]);

  // Get the least busy agent for auto-assignment
  const getLeastBusyAgent = useCallback(() => {
    if (agents.length === 0) return null;
    
    // Filter active agents
    const activeAgents = agents.filter(agent => agent.status === 'active');
    if (activeAgents.length === 0) return null;
    
    // Find agent with fewest assigned tasks
    let leastBusyAgent = activeAgents[0];
    for (const agent of activeAgents) {
      if ((agent.taskCount || 0) < (leastBusyAgent.taskCount || 0)) {
        leastBusyAgent = agent;
      } else if ((agent.taskCount || 0) === (leastBusyAgent.taskCount || 0)) {
        // If same task count, pick the one who was assigned last longer ago
        const lastAssignedA = agent.lastAssigned ? new Date(agent.lastAssigned) : new Date(0);
        const lastAssignedB = leastBusyAgent.lastAssigned ? new Date(leastBusyAgent.lastAssigned) : new Date(0);
        if (lastAssignedA < lastAssignedB) {
          leastBusyAgent = agent;
        }
      }
    }
    
    return leastBusyAgent;
  }, [agents]);

  // Auto-assign task to least busy agent
  const autoAssignTask = useCallback(async (taskId: string) => {
    if (!automationSettings.autoAssignTasks || !adminId) return;
    
    const leastBusyAgent = getLeastBusyAgent();
    if (!leastBusyAgent) return;
    
    try {
      // Update the task assignment
      await update(ref(database, `users/${adminId}/tasks/${taskId}`), {
        agentId: leastBusyAgent.id,
        agentName: leastBusyAgent.name,
        assignedAt: new Date().toISOString()
      });
      
      // Update agent's last assigned time
      await update(ref(database, `users/${adminId}/agents/${leastBusyAgent.id}`), {
        lastAssigned: new Date().toISOString()
      });
      
      console.log(`Automatically assigned task ${taskId} to agent ${leastBusyAgent.name}`);
    } catch (error) {
      console.error('Error during auto-assignment:', error);
    }
  }, [adminId, automationSettings.autoAssignTasks, getLeastBusyAgent]);

  // Filter tasks based on search term
  const filteredTasks = tasks.filter(task => {
    return task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (task.agentName && task.agentName.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const filteredBackupTasks = backupTasks.filter(task => {
    return task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (task.agentName && task.agentName.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  // Calculate task statistics
// Update the taskStats calculation to match the form statuses
const taskStats = {
  total: tasks.length,
  completed: tasks.filter(t => t.status === 'completed').length,
  inProgress: tasks.filter(t => t.status === 'in_progress').length,
  pending: tasks.filter(t => t.status === 'pending').length
  // Removed the overdue count since we're not using it anymore
};

  // Get task urgency (for sorting/display)
  const getTaskUrgency = (task: Task) => {
    if (task.status === 'in_progress') return 1;
    
    const daysUntilDue = differenceInDays(parseISO(task.endDate), new Date());
    if (daysUntilDue <= 1) return 2; // Due today or tomorrow
    if (daysUntilDue <= 3) return 3; // Due in next 3 days
    return 4; // Not urgent
  };
  // Sort tasks by urgency (overdue first, then soonest due dates)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const urgencyA = getTaskUrgency(a);
    const urgencyB = getTaskUrgency(b);
    
    if (urgencyA !== urgencyB) return urgencyA - urgencyB;
    
    // If same urgency, sort by due date
    return isBefore(parseISO(a.endDate), parseISO(b.endDate)) ? -1 : 1;
  });

  // Pagination logic for main tasks
  const indexOfLastTask = currentPage * tasksPerPage;
  const indexOfFirstTask = indexOfLastTask - tasksPerPage;
  const currentTasks = sortedTasks.slice(indexOfFirstTask, indexOfLastTask);
  const totalPages = Math.ceil(sortedTasks.length / tasksPerPage);

  // Pagination logic for backup tasks
  const indexOfLastBackupTask = currentBackupPage * tasksPerPage;
  const indexOfFirstBackupTask = indexOfLastBackupTask - tasksPerPage;
  const currentBackupTasks = filteredBackupTasks.slice(indexOfFirstBackupTask, indexOfLastBackupTask);
  const totalBackupPages = Math.ceil(filteredBackupTasks.length / tasksPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleBackupPageChange = (page: number) => {
    setCurrentBackupPage(page);
  };

  const handleDelete = async (id: string) => {
  try {
    // First find the task to be deleted
    const taskToDelete = tasks.find(task => task.id === id);
    if (!taskToDelete) return;

    // Agents can only delete their own tasks
    if (!isAdmin && taskToDelete.agentId !== agentId) {
      toast.error('You can only delete your own tasks');
      return;
    }

    // Add to backup before deleting
    if (adminId) {
      const backupRef = ref(database, `users/${adminId}/backups/tasks/${id}`);
      await set(backupRef, {
        ...taskToDelete,
        deletedAt: new Date().toISOString(),
        deletedBy: user?.email || (isAdmin ? 'admin' : 'agent')
      });
    }

    // Then delete from main tasks
    const taskRef = ref(database, `users/${adminId}/tasks/${id}`);
    await remove(taskRef);
    toast.success('Task moved to backup successfully');
  } catch (error) {
    console.error('Error deleting task:', error);
    toast.error('Failed to delete task');
  }
};

  const handleRestoreTask = async (task: Task) => {
    try {
      // First add the task back to main tasks
      let taskRef;
      if (isAdmin && adminId) {
        taskRef = ref(database, `users/${adminId}/tasks/${task.id}`);
      } else if (agentId && adminId) {
        taskRef = ref(database, `users/${adminId}/agents/${agentId}/tasks/${task.id}`);
      } else {
        throw new Error('Unable to determine storage path');
      }

      // Remove the deletedAt field before restoring
      const { deletedAt, deletedBy, ...taskToRestore } = task;
      await set(taskRef, taskToRestore);
      
      // Then remove from backup
      if (adminId) {
        const backupRef = ref(database, `users/${adminId}/backups/tasks/${task.id}`);
        await remove(backupRef);
      }

      toast.success('Task restored successfully');
    } catch (error) {
      console.error('Error restoring task:', error);
      toast.error('Failed to restore task');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      if (adminId) {
        const backupRef = ref(database, `users/${adminId}/backups/tasks/${id}`);
        await remove(backupRef);
        toast.success('Task permanently deleted from backup');
      }
    } catch (error) {
      console.error('Error permanently deleting task:', error);
      toast.error('Failed to permanently delete task');
    }
  };
const handleAddTask = async (newTask: Task) => {
  try {
    let taskRef;
    if (isAdmin && adminId) {
      taskRef = ref(database, `users/${adminId}/tasks/${newTask.id}`);
    } else if (agentId && adminId) {
      taskRef = ref(database, `users/${adminId}/tasks/${newTask.id}`);
      // Ensure the task is assigned to the current agent
      newTask.agentId = agentId;
      newTask.agentName = agents.find(a => a.id === agentId)?.name || 'Self';
    } else {
      throw new Error('Unable to determine storage path');
    }

    await set(taskRef, newTask);
    
    // Auto-assign if no agent was specified and auto-assign is enabled (admin only)
    if (isAdmin && automationSettings.autoAssignTasks && !newTask.agentId) {
      await autoAssignTask(newTask.id);
    }
    
    // REMOVE THIS LINE - let the Firebase listener handle the state update
    // setTasks(prev => [newTask, ...prev]);
    
    setIsAddingTask(false);
    toast.success('Task added successfully');
  } catch (error) {
    console.error('Error adding task:', error);
    toast.error('Failed to add task');
  }
};
 const handleUpdateTask = async (updatedTask: Task) => {
  try {
    // Agents can only update their own tasks
    if (!isAdmin && updatedTask.agentId !== agentId) {
      toast.error('You can only update your own tasks');
      return;
    }

    let taskRef;
    if (isAdmin && adminId) {
      taskRef = ref(database, `users/${adminId}/tasks/${updatedTask.id}`);
    } else if (agentId && adminId) {
      taskRef = ref(database, `users/${adminId}/tasks/${updatedTask.id}`);
      // Ensure agent can't change assignment
      updatedTask.agentId = agentId;
      updatedTask.agentName = agents.find(a => a.id === agentId)?.name || 'Self';
    } else {
      throw new Error('Unable to determine storage path');
    }

    await set(taskRef, updatedTask);
    
    setTasks(prev => prev.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ));
    setIsAddingTask(false);
    setSelectedTask(null);
    toast.success('Task updated successfully');
  } catch (error) {
    console.error('Error updating task:', error);
    toast.error('Failed to update task');
  }
};
  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    setIsAddingTask(true);
  };

  const getPriorityClassName = (priority: string) => {
    switch(priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };
  
  const getStatusClassName = (status: string) => {
    switch(status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  // Pagination controls component
  const PaginationControls = ({ currentPage, totalPages, onPageChange }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  }) => {
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-sm text-muted-foreground">
          Showing {showBackup 
            ? (Math.min((currentBackupPage - 1) * tasksPerPage + 1, filteredBackupTasks.length)) 
            : (Math.min((currentPage - 1) * tasksPerPage + 1, sortedTasks.length))}-{
            showBackup 
              ? Math.min(currentBackupPage * tasksPerPage, filteredBackupTasks.length) 
              : Math.min(currentPage * tasksPerPage, sortedTasks.length)
          } of {showBackup ? filteredBackupTasks.length : sortedTasks.length} tasks
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="hidden sm:flex"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {startPage > 1 && (
            <>
              <Button
                variant={currentPage === 1 ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(1)}
              >
                1
              </Button>
              {startPage > 2 && <span className="px-2">...</span>}
            </>
          )}
          
          {pageNumbers.map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ))}
          
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="px-2">...</span>}
              <Button
                variant={currentPage === totalPages ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </Button>
            </>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="hidden sm:flex"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Automation Settings Dialog */}
      <Dialog open={showAutomationSettings} onOpenChange={setShowAutomationSettings}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Task Automation Settings</DialogTitle>
            <DialogDescription>
              Configure automated task management features
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="autoStatusUpdate"
                  checked={automationSettings.autoStatusUpdate}
                  onCheckedChange={(checked) => setAutomationSettings({
                    ...automationSettings,
                    autoStatusUpdate: Boolean(checked)
                  })}
                />
                <label htmlFor="autoStatusUpdate" className="text-sm font-medium leading-none">
                  Auto-update Task Statuses
                </label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Automatically updates task statuses (e.g., to overdue when past due date)
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="autoAssignTasks"
                  checked={automationSettings.autoAssignTasks}
                  onCheckedChange={(checked) => setAutomationSettings({
                    ...automationSettings,
                    autoAssignTasks: Boolean(checked)
                  })}
                />
                <label htmlFor="autoAssignTasks" className="text-sm font-medium leading-none">
                  Auto-assign New Tasks
                </label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Automatically assigns new tasks to the least busy agent
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="notifyOverdue"
                  checked={automationSettings.notifyOverdue}
                  onCheckedChange={(checked) => setAutomationSettings({
                    ...automationSettings,
                    notifyOverdue: Boolean(checked)
                  })}
                />
                <label htmlFor="notifyOverdue" className="text-sm font-medium leading-none">
                  Notify About Overdue Tasks
                </label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Create notifications when tasks become overdue
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="notifyDueSoon"
                  checked={automationSettings.notifyDueSoon}
                  onCheckedChange={(checked) => setAutomationSettings({
                    ...automationSettings,
                    notifyDueSoon: Boolean(checked)
                  })}
                />
                <label htmlFor="notifyDueSoon" className="text-sm font-medium leading-none">
                  Notify About Tasks Due Soon
                </label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Create notifications for tasks due within 24 hours
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="autoCleanupDays" className="text-sm font-medium leading-none">
                  Auto-cleanup Completed Tasks After:
                </Label>
                <Input
                  id="autoCleanupDays"
                  type="number"
                  min="1"
                  max="365"
                  value={automationSettings.autoCleanupDays}
                  onChange={(e) => setAutomationSettings({
                    ...automationSettings,
                    autoCleanupDays: Number(e.target.value)
                  })}
                  className="w-20"
                />
                <span className="text-sm">days</span>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Automatically archive completed tasks older than this period
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              onClick={() => setShowAutomationSettings(false)}
              className="neuro hover:shadow-none transition-all duration-300"
            >
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
{/* Task Statistics Panel */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <div className="neuro p-3 rounded-lg">
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium">Total Tasks</span>
      <span className="text-lg font-bold">{taskStats.total}</span>
    </div>
  </div>
  <div className="neuro p-3 rounded-lg">
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium">Completed</span>
      <span className="text-lg font-bold text-green-500">{taskStats.completed}</span>
    </div>
  </div>
  <div className="neuro p-3 rounded-lg">
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium">In Progress</span>
      <span className="text-lg font-bold text-blue-500">{taskStats.inProgress}</span>
    </div>
  </div>
  <div className="neuro p-3 rounded-lg">
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium">Pending</span>
      <span className="text-lg font-bold text-yellow-500">{taskStats.pending}</span>
    </div>
  </div>
</div>

      {/* Search and Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center mb-4">
        <h2 className="text-xl font-semibold">{showBackup ? 'Deleted Tasks Backup' : 'Tasks'}</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder="Search tasks..."
            className="neuro-inset focus:shadow-none w-full sm:w-[300px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {isAdmin && (
            <Button 
              variant="outline"
              size="icon"
              onClick={() => setShowAutomationSettings(true)}
              className="neuro hover:shadow-none transition-all duration-300"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Backup/Active Tasks Toggle */}
      <div className="flex justify-between mb-4">
        <Button 
          variant={showBackup ? "outline" : "default"}
          onClick={() => setShowBackup(!showBackup)}
          className="neuro hover:shadow-none transition-all duration-300"
        >
          {showBackup ? (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Tasks
            </>
          ) : (
            <>
              <Undo className="h-4 w-4 mr-2" />
              View Deleted Tasks
            </>
          )}
        </Button>
        
        {!showBackup && (
          <Button 
            onClick={() => {
              setSelectedTask(null);
              setIsAddingTask(true);
            }}
            className="neuro hover:shadow-none transition-all duration-300"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        )}
      </div>

      {showBackup ? (
        <>
          {/* Backup Tasks Table - Desktop */}
          <div className="overflow-auto neuro hidden sm:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Task</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Assigned To</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Deleted At</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Deleted By</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentBackupTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-muted/20">
                    <td className="p-3">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                          {task.description}
                        </p>
                      </div>
                    </td>
                    <td className="p-3">{task.agentName}</td>
                    <td className="p-3">{new Date(task.deletedAt || '').toLocaleString()}</td>
                    <td className="p-3">{task.deletedBy || 'Unknown'}</td>
                    <td className="p-3">
                      <div className="flex space-x-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-green-500 hover:text-green-600"
                          onClick={() => handleRestoreTask(task)}
                        >
                          <Undo className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => handlePermanentDelete(task.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls 
              currentPage={currentBackupPage} 
              totalPages={totalBackupPages} 
              onPageChange={handleBackupPageChange} 
            />
          </div>

          {/* Backup Tasks Cards - Mobile */}
          <div className="sm:hidden space-y-4">
            {currentBackupTasks.map((task) => (
              <div key={task.id} className="neuro p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{task.title}</h3>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  </div>
                </div>
                
                <div className="mt-3 flex flex-col space-y-2">
                  <div className="text-sm">Assigned to: <span className="font-medium">{task.agentName}</span></div>
                  <div className="text-sm">Deleted at: <span className="font-medium">{new Date(task.deletedAt || '').toLocaleString()}</span></div>
                  <div className="text-sm">Deleted by: <span className="font-medium">{task.deletedBy || 'Unknown'}</span></div>
                </div>
                
                <div className="mt-3 pt-3 border-t flex justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-green-500 hover:text-green-600"
                    onClick={() => handleRestoreTask(task)}
                  >
                    <Undo className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600"
                    onClick={() => handlePermanentDelete(task.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <PaginationControls 
              currentPage={currentBackupPage} 
              totalPages={totalBackupPages} 
              onPageChange={handleBackupPageChange} 
            />
          </div>
        </>
      ) : (
        <>
          {/* Tasks Table - Desktop */}
          <div className="overflow-auto neuro hidden sm:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Task</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Assigned To</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Start Date</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">End Date</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Priority</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-muted/20">
                    <td className="p-3">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                          {task.description}
                        </p>
                      </div>
                    </td>
                    <td className="p-3">{task.agentName}</td>
                    <td className="p-3">{task.startDate}</td>
                    <td className="p-3">{task.endDate}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityClassName(task.priority)}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusClassName(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex space-x-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEdit(task)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(task.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={handlePageChange} 
            />
          </div>

          {/* Tasks Cards - Mobile */}
          <div className="sm:hidden space-y-4">
            {currentTasks.map((task) => (
              <div key={task.id} className="neuro p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{task.title}</h3>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityClassName(task.priority)}`}>
                    {task.priority}
                  </span>
                </div>
                
                <div className="mt-3 flex flex-col space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="text-sm">Assigned to: <span className="font-medium">{task.agentName}</span></div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusClassName(task.status)}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <div>Start: {task.startDate}</div>
                    <div>End: {task.endDate}</div>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t flex justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleEdit(task)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(task.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <PaginationControls 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={handlePageChange} 
            />
          </div>
        </>
      )}

      {/* Task Form */}
      <AddTaskForm
        isOpen={isAddingTask}
        onClose={() => {
          setIsAddingTask(false);
          setSelectedTask(null);
        }}
        onSubmit={selectedTask ? handleUpdateTask : handleAddTask}
        task={selectedTask}
        agents={agents}
      />
    </div>
  );
};