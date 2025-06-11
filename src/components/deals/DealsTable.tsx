import React, { useState, useEffect } from 'react';
import { Edit, Trash2, CreditCard, Calendar, Check, X, AlertCircle, RotateCcw, Table, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { DealForm } from './DealForm';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { ref, onValue, off, remove, set, push } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '@/context/AuthContext';
import { decryptObject } from '@/lib/utils';
import {
  Table as ShadcnTable, // Renamed to avoid conflict with HTML table tag
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';


// Re-defining the Deal interface here for clarity, but ideally, it should be in a shared type file
interface Deal {
  id: string;
  name: string;
  leadId: string;
  leadName: string;
  agentId: string;
  agentName: string;
  amount: number;
  status: 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  createdAt: string;
  closingDate: string;
  company: string;
  description?: string;
  [key: string]: any; // Allow arbitrary string keys for custom fields
}

type ViewMode = 'card' | 'table'; // New type for view mode

export const DealsTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [backupDeals, setBackupDeals] = useState<Deal[]>([]);
  const [isAddingDeal, setIsAddingDeal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [deletingDealId, setDeletingDealId] = useState<string | null>(null);
  const [restoringDealId, setRestoringDealId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('card'); // Default to card view
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey');

  // Define core fields that have specific rendering logic or are usually displayed upfront
  const coreFields = ['id', 'name', 'company', 'amount', 'status', 'createdAt', 'closingDate', 'description', 'leadId', 'leadName', 'agentId', 'agentName'];

  // Helper function to get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  // Fetch deals and backup from Firebase based on user role
  useEffect(() => {
    let dealsRef: any;
    let backupRef: any;

    if (isAdmin && adminId) {
      dealsRef = ref(database, `users/${adminId}/deals`);
      backupRef = ref(database, `users/${adminId}/backups/${getCurrentDate()}`);
    } else if (agentId && adminId) {
      // Agents fetch their deals and backups under admin's agent structure
      dealsRef = ref(database, `users/${adminId}/agents/${agentId}/deals`);
      backupRef = ref(database, `users/${adminId}/agents/${agentId}/backups/${getCurrentDate()}`);
    } else {
      return;
    }

    const fetchDeals = () => {
      // Active Deals Listener
      onValue(dealsRef, async (snapshot) => {
        const dealsData: Deal[] = [];
        snapshot.forEach((childSnapshot) => {
          dealsData.push({
            id: childSnapshot.key || '',
            ...childSnapshot.val()
          });
        });
        try {
          const decryptedDeals = await Promise.all(
            dealsData.map(async (deal) => await decryptObject(deal))
          );
          setDeals(decryptedDeals);
        } catch (error) {
          console.error("Error decrypting active deals:", error);
          toast.error("Failed to load active deals due to decryption error.");
          setDeals([]);
        }
      }, (error) => {
        console.error("Firebase onValue error for active deals:", error);
        toast.error("Failed to fetch active deals from database.");
      });

      // Backup Deals Listener
      onValue(backupRef, async (snapshot) => {
        const backupData: Deal[] = [];
        snapshot.forEach((childSnapshot) => {
          backupData.push({
            id: childSnapshot.key || '',
            ...childSnapshot.val()
          });
        });
        try {
          const decryptedBackupDeals = await Promise.all(
            backupData.map(async (deal) => await decryptObject(deal))
          );
          setBackupDeals(decryptedBackupDeals);
        } catch (error) {
          console.error("Error decrypting backup deals:", error);
          toast.error("Failed to load backup deals due to decryption error.");
          setBackupDeals([]);
        }
      }, (error) => {
        console.error("Firebase onValue error for backup deals:", error);
        toast.error("Failed to fetch backup deals from database.");
      });
    };

    fetchDeals();

    return () => {
      if (dealsRef) off(dealsRef);
      if (backupRef) off(backupRef);
    };
  }, [isAdmin, adminId, agentId]); // Removed showBackup from dependency array, as listeners handle changes

  const filteredDeals = (showBackup ? backupDeals : deals).filter(deal => {
    return deal?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal?.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal?.leadName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal?.agentName?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleDelete = async (id: string) => {
    setIsLoading(true); // Set loading for the delete action
    try {
      let dealRef;
      let backupPath;
      let currentDealPath; // Path where the deal currently resides for deletion

      // Determine the current path of the deal to delete it from
      const dealToDelete = deals.find(d => d.id === id); // Find in active deals
      const dealToDeleteFromBackup = backupDeals.find(d => d.id === id); // Find in backup deals

      if (showBackup && dealToDeleteFromBackup) {
        // If we are showing backup, and the deal is in backup, then we permanently delete from backup
        if (isAdmin && adminId) {
          dealRef = ref(database, `users/${adminId}/backups/${getCurrentDate()}/${id}`);
        } else if (agentId && adminId) {
          dealRef = ref(database, `users/${adminId}/agents/${agentId}/backups/${getCurrentDate()}/${id}`);
        } else {
          throw new Error('Unable to determine storage path for backup deletion');
        }
        await remove(dealRef);
        toast.success('Deal permanently deleted from backup');
      } else if (!showBackup && dealToDelete) {
        // If we are showing active and the deal is active, move to backup
        if (isAdmin && adminId) {
          currentDealPath = `users/${adminId}/deals/${id}`;
          backupPath = `users/${adminId}/backups/${getCurrentDate()}/${id}`;
        } else if (agentId && adminId) {
          currentDealPath = `users/${adminId}/agents/${agentId}/deals/${id}`;
          backupPath = `users/${adminId}/agents/${agentId}/backups/${getCurrentDate()}/${id}`;
        } else {
          throw new Error('Unable to determine storage path for active deal deletion');
        }

        // Backup the deal before deleting from main collection
        await set(ref(database, backupPath), dealToDelete);
        await remove(ref(database, currentDealPath)); // Delete from main
        toast.success('Deal moved to backup');
      } else {
        throw new Error('Deal not found in current view for deletion.');
      }

      setDeletingDealId(null);
    } catch (error) {
      console.error('Error deleting deal:', error);
      toast.error('Failed to delete deal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    setIsLoading(true); // Set loading for the restore action
    try {
      let dealRef;
      let backupRef;

      // Find the deal to restore from backup
      const dealToRestore = backupDeals.find(deal => deal.id === id);
      if (!dealToRestore) {
        throw new Error('Deal not found in backup for restoration.');
      }

      if (isAdmin && adminId) {
        dealRef = ref(database, `users/${adminId}/deals/${id}`);
        backupRef = ref(database, `users/${adminId}/backups/${getCurrentDate()}/${id}`);
      } else if (agentId && adminId) {
        dealRef = ref(database, `users/${adminId}/agents/${agentId}/deals/${id}`);
        backupRef = ref(database, `users/${adminId}/agents/${agentId}/backups/${getCurrentDate()}/${id}`);
      } else {
        throw new Error('Unable to determine storage path');
      }

      // Restore the deal to main collection
      await set(dealRef, dealToRestore);

      // Then remove from backup
      await remove(backupRef);

      setRestoringDealId(null);
      toast.success('Deal restored successfully');
    } catch (error) {
      console.error('Error restoring deal:', error);
      toast.error('Failed to restore deal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOrUpdateDeal = async (dealData: Deal) => {
    setIsLoading(true);
    try {
      let targetDealRef;
      let targetBackupRef;
      let newDealId = dealData.id; // Use existing ID if editing, otherwise it will be empty

      if (isAdmin && adminId) {
        if (!newDealId) {
          const newRef = push(ref(database, `users/${adminId}/deals`));
          newDealId = newRef.key!; // Get the new ID generated by push
          dealData.id = newDealId; // Assign the new ID to the dealData
        }
        targetDealRef = ref(database, `users/${adminId}/deals/${newDealId}`);
        targetBackupRef = ref(database, `users/${adminId}/backups/${getCurrentDate()}/${newDealId}`);
      } else if (agentId && adminId) {
        if (!newDealId) {
          const newRef = push(ref(database, `users/${adminId}/agents/${agentId}/deals`));
          newDealId = newRef.key!;
          dealData.id = newDealId;
        }
        targetDealRef = ref(database, `users/${adminId}/agents/${agentId}/deals/${newDealId}`);
        targetBackupRef = ref(database, `users/${adminId}/agents/${agentId}/backups/${getCurrentDate()}/${newDealId}`);
      } else {
        throw new Error('Unable to determine storage path for deal.');
      }

      // Save to main collection
      await set(targetDealRef, dealData);

      // Also save to daily backup
      await set(targetBackupRef, dealData);

      // The useEffect listener will handle state updates, no need to manually setDeals here
      setIsAddingDeal(false);
      setEditingDeal(null);
      toast.success(`Deal ${dealData.id ? 'updated' : 'added'} successfully`);
    } catch (error) {
      console.error('Error saving deal:', error);
      toast.error(`Failed to ${dealData.id ? 'update' : 'create'} deal`);
    } finally {
      setIsLoading(false);
    }
  };


  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'closed_won':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'closed_lost':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'proposal':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'negotiation':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'closed_won':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'closed_lost':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const getDealToDelete = () => {
    return deals.find(deal => deal.id === deletingDealId) || backupDeals.find(deal => deal.id === deletingDealId);
  };

  const getDealToRestore = () => {
    return backupDeals.find(deal => deal.id === restoringDealId);
  };

  // Function to render any field
  const renderField = (key: string, value: any) => {
    // Skip fields that are already explicitly rendered or are internal IDs
    if (['id', 'name', 'company', 'amount', 'status', 'createdAt', 'closingDate', 'description', 'leadId', 'agentId'].includes(key)) {
      return null;
    }

    // Format special fields like leadName and agentName
    if (key === 'leadName') {
      return (
        <div className="flex items-center gap-2" key={key}>
          <span className="text-sm font-medium text-muted-foreground">Lead:</span>
          <span className="text-sm">{value}</span>
        </div>
      );
    }
    if (key === 'agentName') {
      return (
        <div className="flex items-center gap-2" key={key}>
          <span className="text-sm font-medium text-muted-foreground">Agent:</span>
          <span className="text-sm">{value}</span>
        </div>
      );
    }

    // Attempt to make a human-readable label from the key
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    // Basic rendering for other fields
    return (
      <div className="flex items-center gap-2" key={key}>
        <span className="text-sm font-medium text-muted-foreground">{label}:</span>
        <span className="text-sm">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
      </div>
    );
  };

  // Determine all unique keys (headers) for the table view
  const getAllDealKeys = () => {
    const keys = new Set<string>(coreFields); // Start with core fields
    (showBackup ? backupDeals : deals).forEach(deal => {
      Object.keys(deal).forEach(key => {
        if (!coreFields.includes(key) && !['id'].includes(key)) { // Exclude internal IDs and already handled core fields
          keys.add(key);
        }
      });
    });
    return Array.from(keys);
  };

  const dynamicTableHeaders = getAllDealKeys();


  return (
    <div className="space-y-4">
      {/* Actions and Search */}
      <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} justify-between gap-4 items-start sm:items-center`}>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setIsAddingDeal(true)}
            className="neuro hover:shadow-none transition-all duration-300 flex-1 sm:flex-none"
          >
            Add Deal
          </Button>
          <Button
            variant={showBackup ? "default" : "outline"}
            onClick={() => setShowBackup(!showBackup)}
            className="flex-1 sm:flex-none"
          >
            {showBackup ? 'Show Active' : 'Show Backup'}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
            className="hidden sm:flex" // Hide on small screens, show on medium and larger
          >
            {viewMode === 'card' ? <Table className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
          </Button>
        </div>

        <Input
          placeholder={`Search ${showBackup ? 'backup' : 'active'} deals...`}
          className="neuro-inset focus:shadow-none w-full sm:w-[300px]"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Info Banner when viewing backup */}
      {showBackup && (
        <div className="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>Viewing backup deals. These are deleted or previous versions of active deals.</span>
        </div>
      )}

      {/* Conditional Rendering based on viewMode */}
      {viewMode === 'card' ? (
        // Deals in Cards
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDeals.length === 0 ? (
            <p className="text-center text-muted-foreground col-span-full py-8">
              No {showBackup ? 'backup' : 'active'} deals found.
            </p>
          ) : (
            filteredDeals.map((deal) => (
              <div
                key={deal.id}
                className="rounded-xl p-4 bg-white dark:bg-gray-800
                                  shadow-[inset_5px_5px_10px_rgba(0,0,0,0.05),inset_-5px_-5px_10px_rgba(255,255,255,0.8)]
                                  dark:shadow-[inset_5px_5px_10px_rgba(0,0,0,0.3),inset_-5px_-5px_10px_rgba(75,85,99,0.3)]
                                  hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
                                        dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]
                                  transition-all duration-200 hover:scale-[1]"
              >
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-4/5">
                      <h3 className="font-semibold text-lg truncate">{deal.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{deal.company}</p>
                    </div>
                    <Badge className={`${getStatusColor(deal.status)} whitespace-nowrap`}>
                      <div className="flex items-center">
                        {getStatusIcon(deal.status)}
                        <span className="ml-1 capitalize">{deal.status.replace('_', ' ')}</span>
                      </div>
                    </Badge>
                  </div>

                  {/* Main Content Fields */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Amount</span>
                      <span className="text-lg font-bold">${deal.amount?.toLocaleString() || '0.00'}</span>
                    </div>

                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="text-sm">
                          <span className="text-muted-foreground">Created: </span>
                          <span>{deal.createdAt}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="text-sm">
                          <span className="text-muted-foreground">Closing: </span>
                          <span>{deal.closingDate}</span>
                        </div>
                      </div>
                    </div>

                    {deal.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2 italic">
                        "{deal.description}"
                      </p>
                    )}

                    {/* Render all other properties/custom fields */}
                    <div className="space-y-1 text-sm pt-2 border-t dark:border-gray-700">
                      {Object.entries(deal).map(([key, value]) => renderField(key, value))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t dark:border-gray-700 flex justify-end">
                    <div className="flex space-x-2">
                      {showBackup ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
                                         dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]"
                            onClick={() => setRestoringDealId(deal.id)}
                            disabled={isLoading}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" /> Restore
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-red-500 hover:text-red-600 hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
                                         dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]"
                            onClick={() => setDeletingDealId(deal.id)}
                            disabled={isLoading}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
                                                 dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]"
                            onClick={() => handleEdit(deal)}
                            disabled={isLoading}
                          >
                            <Edit className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-red-500 hover:text-red-600 hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
                                                 dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]"
                            onClick={() => setDeletingDealId(deal.id)}
                            disabled={isLoading}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        // Deals in Table
        <div className="overflow-x-auto rounded-lg shadow-[inset_5px_5px_10px_rgba(0,0,0,0.05),inset_-5px_-5px_10px_rgba(255,255,255,0.8)] dark:shadow-[inset_5px_5px_10px_rgba(0,0,0,0.3),inset_-5px_-5px_10px_rgba(75,85,99,0.3)]">
          <ShadcnTable className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <TableHeader className="bg-gray-50 dark:bg-gray-800">
              <TableRow className="bg-white dark:bg-gray-800 neuro-inset">
                {/* Core fields first, then dynamic custom fields */}
                <TableHead className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deal Name</TableHead>
                <TableHead className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</TableHead>
                <TableHead className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</TableHead>
                <TableHead className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</TableHead>
                <TableHead className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</TableHead>
                <TableHead className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</TableHead>
                <TableHead className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</TableHead>
                <TableHead className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Closing Date</TableHead>
                <TableHead className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</TableHead>
                {dynamicTableHeaders.filter(key => !coreFields.includes(key)).map(key => (
                  <TableHead key={key} className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </TableHead>
                ))}
                <TableHead className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
              {filteredDeals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={dynamicTableHeaders.length + 1} className="py-4 text-center text-muted-foreground">
                    No {showBackup ? 'backup' : 'active'} deals found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeals.map((deal) => (
                  <TableRow key={deal.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <TableCell className="py-4 px-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[150px]">
                      {deal.name}
                    </TableCell>
                    <TableCell className="py-4 px-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                      {deal.company}
                    </TableCell>
                    <TableCell className="py-4 px-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                      {deal.leadName}
                    </TableCell>
                    <TableCell className="py-4 px-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                      {deal.agentName}
                    </TableCell>
                    <TableCell className="py-4 px-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${deal.amount?.toLocaleString() || '0.00'}
                    </TableCell>
                    <TableCell className="py-4 px-4 whitespace-nowrap">
                      <Badge className={`${getStatusColor(deal.status)}`}>
                        <div className="flex items-center">
                          {getStatusIcon(deal.status)}
                          <span className="ml-1 capitalize">{deal.status.replace('_', ' ')}</span>
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 px-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {deal.createdAt}
                    </TableCell>
                    <TableCell className="py-4 px-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {deal.closingDate}
                    </TableCell>
                    <TableCell className="py-4 px-4 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                      {deal.description || '-'}
                    </TableCell>
                    {dynamicTableHeaders.filter(key => !coreFields.includes(key)).map(key => (
                      <TableCell key={key} className="py-4 px-4 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                        {deal[key] !== undefined && deal[key] !== null ? String(deal[key]) : '-'}
                      </TableCell>
                    ))}
                    <TableCell className="py-4 px-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {showBackup ? (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
                                                    dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]"
                              onClick={() => setRestoringDealId(deal.id)}
                              disabled={isLoading}
                              title="Restore Deal"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
                                                    dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]"
                              onClick={() => setDeletingDealId(deal.id)}
                              disabled={isLoading}
                              title="Delete Permanently"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
                                                      dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]"
                              onClick={() => handleEdit(deal)}
                              disabled={isLoading}
                              title="Edit Deal"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
                                                      dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]"
                              onClick={() => setDeletingDealId(deal.id)}
                              disabled={isLoading}
                              title="Delete Deal"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </ShadcnTable>
        </div>
      )}


      {/* Deal Form Dialog */}
      <DealForm
        isOpen={isAddingDeal || editingDeal !== null}
        onClose={() => {
          setIsAddingDeal(false);
          setEditingDeal(null);
        }}
        onSubmit={handleAddOrUpdateDeal}
        deal={editingDeal}
        isLoading={isLoading}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingDealId} onOpenChange={() => setDeletingDealId(null)}>
        <AlertDialogContent className="rounded-xl bg-white dark:bg-gray-800
          shadow-[inset_5px_5px_10px_rgba(0,0,0,0.05),inset_-5px_-5px_10px_rgba(255,255,255,0.8)]
          dark:shadow-[inset_5px_5px_10px_rgba(0,0,0,0.3),inset_-5px_-5px_10px_rgba(75,85,99,0.3)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {showBackup ? 'permanently delete' : 'delete'} the deal "
              <span className="font-semibold">{getDealToDelete()?.name || getDealToRestore()?.name}</span>"?
              {showBackup ? ' This action cannot be undone.' : ' This will move it to the backup system where you can restore it later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
              dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDealId && handleDelete(deletingDealId)}
              className="bg-red-500 hover:bg-red-600"
              disabled={isLoading}
            >
              {showBackup ? 'Delete Permanently' : 'Move to Backup'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoringDealId} onOpenChange={() => setRestoringDealId(null)}>
        <AlertDialogContent className="rounded-xl bg-white dark:bg-gray-800
          shadow-[inset_5px_5px_10px_rgba(0,0,0,0.05),inset_-5px_-5px_10px_rgba(255,255,255,0.8)]
          dark:shadow-[inset_5px_5px_10px_rgba(0,0,0,0.3),inset_-5px_-5px_10px_rgba(75,85,99,0.3)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <RotateCcw className="h-5 w-5 text-green-500 mr-2" />
              Confirm Restoration
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore the deal "<span className="font-semibold">{getDealToRestore()?.name}</span>"?
              This will move it back to your active deals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
              dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoringDealId && handleRestore(restoringDealId)}
              className="bg-green-500 hover:bg-green-600"
              disabled={isLoading}
            >
              Restore Deal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};