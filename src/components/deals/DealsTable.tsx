import React, { useState, useEffect } from 'react';
import { Edit, Trash2, CreditCard, Calendar, Check, X, AlertCircle, RotateCcw, Table, LayoutGrid, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
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
import {
  Table as ShadcnTable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';

// Encryption key - should be stored securely in production
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8'; // 32 chars for AES-256

// Helper function to decrypt data
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

// Function to decrypt deal object
async function decryptDeal(deal: any): Promise<any> {
  const decryptedDeal = { ...deal };
  
  // Decrypt each encrypted field
  decryptedDeal.name = await decryptData(deal.name);
  decryptedDeal.leadName = await decryptData(deal.leadName);
  decryptedDeal.agentName = await decryptData(deal.agentName);
  decryptedDeal.company = await decryptData(deal.company);
  decryptedDeal.description = await decryptData(deal.description);
  
  // Decrypt custom fields
  for (const key in deal) {
    if (![
      'id', 'leadId', 'agentId', 'amount', 'status', 
      'createdAt', 'closingDate', 'documents', 'signatures'
    ].includes(key)) {
      decryptedDeal[key] = await decryptData(deal[key]);
    }
  }
  
  return decryptedDeal;
}

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
  documents?: Array<{
    id: string;
    name: string;
    url: string;
    createdAt: string;
    templateId?: string;
    fields?: Record<string, string>;
  }>;
  signatures?: Array<{
    documentId: string;
    signerId: string;
    signerName: string;
    signerEmail: string;
    signedAt: string;
    signatureData: string;
  }>;
  [key: string]: any;
}

type ViewMode = 'card' | 'table';

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
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [previewDeal, setPreviewDeal] = useState<Deal | null>(null);
  const [currentDocument, setCurrentDocument] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey');

  const coreFields = ['id', 'name', 'company', 'amount', 'status', 'createdAt', 'closingDate', 'description', 'leadId', 'leadName', 'agentId', 'agentName'];

  const getCurrentDate = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  useEffect(() => {
    let dealsRef: any;
    let backupRef: any;

    if (isAdmin && adminId) {
      // Admin can see all deals under their account
      dealsRef = ref(database, `users/${adminId}/deals`);
      backupRef = ref(database, `users/${adminId}/backups/${getCurrentDate()}`);
    } else if (agentId && adminId) {
      // Agent can only see deals assigned to them
      dealsRef = ref(database, `users/${adminId}/agents/${agentId}/deals`);
      backupRef = ref(database, `users/${adminId}/agents/${agentId}/backups/${getCurrentDate()}`);
    } else {
      return;
    }

    const fetchDeals = () => {
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
            dealsData.map(async (deal) => await decryptDeal(deal))
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
            backupData.map(async (deal) => await decryptDeal(deal))
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
  }, [isAdmin, adminId, agentId]);

  const filteredDeals = (showBackup ? backupDeals : deals).filter(deal => {
    return deal?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal?.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal?.leadName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal?.agentName?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Pagination logic
  const totalItems = filteredDeals.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedDeals = filteredDeals.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleDelete = async (id: string) => {
    setIsLoading(true);
    try {
      let dealRef;
      let backupPath;
      let currentDealPath;

      const dealToDelete = deals.find(d => d.id === id);
      const dealToDeleteFromBackup = backupDeals.find(d => d.id === id);

      if (showBackup && dealToDeleteFromBackup) {
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
        if (isAdmin && adminId) {
          currentDealPath = `users/${adminId}/deals/${id}`;
          backupPath = `users/${adminId}/backups/${getCurrentDate()}/${id}`;
        } else if (agentId && adminId) {
          currentDealPath = `users/${adminId}/agents/${agentId}/deals/${id}`;
          backupPath = `users/${adminId}/agents/${agentId}/backups/${getCurrentDate()}/${id}`;
        } else {
          throw new Error('Unable to determine storage path for active deal deletion');
        }

        await set(ref(database, backupPath), dealToDelete);
        await remove(ref(database, currentDealPath));
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
    setIsLoading(true);
    try {
      let dealRef;
      let backupRef;

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

      await set(dealRef, dealToRestore);
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
      let newDealId = dealData.id;

      if (isAdmin && adminId) {
        // Admin is adding/updating a deal
        if (!newDealId) {
          const newRef = push(ref(database, `users/${adminId}/deals`));
          newDealId = newRef.key!;
          dealData.id = newDealId;
        }
        targetDealRef = ref(database, `users/${adminId}/deals/${newDealId}`);
        targetBackupRef = ref(database, `users/${adminId}/backups/${getCurrentDate()}/${newDealId}`);
        
        // If admin is assigning to an agent, also save to agent's deals
        if (dealData.agentId && dealData.agentId !== '') {
          const agentDealRef = ref(database, `users/${adminId}/agents/${dealData.agentId}/deals/${newDealId}`);
          await set(agentDealRef, dealData);
        }
      } else if (agentId && adminId) {
        // Agent is adding/updating a deal
        if (!newDealId) {
          const newRef = push(ref(database, `users/${adminId}/agents/${agentId}/deals`));
          newDealId = newRef.key!;
          dealData.id = newDealId;
        }
        targetDealRef = ref(database, `users/${adminId}/agents/${agentId}/deals/${newDealId}`);
        targetBackupRef = ref(database, `users/${adminId}/agents/${agentId}/backups/${getCurrentDate()}/${newDealId}`);
        
        // Also save to admin's deals
        const adminDealRef = ref(database, `users/${adminId}/deals/${newDealId}`);
        await set(adminDealRef, dealData);
      } else {
        throw new Error('Unable to determine storage path for deal.');
      }

      await set(targetDealRef, dealData);
      await set(targetBackupRef, dealData);

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

  const handlePreview = (deal: Deal) => {
    setPreviewDeal(deal);
  };

  const handleViewDocument = (document: any) => {
    setCurrentDocument(document);
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

  const renderField = (key: string, value: any) => {
    if (['id', 'name', 'company', 'amount', 'status', 'createdAt', 'closingDate', 'description', 'leadId', 'agentId', 'documents', 'signatures'].includes(key)) {
      return null;
    }

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

    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    return (
      <div className="flex items-center gap-2" key={key}>
        <span className="text-sm font-medium text-muted-foreground">{label}:</span>
        <span className="text-sm">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
      </div>
    );
  };

  const getAllDealKeys = () => {
    const keys = new Set<string>(coreFields);
    (showBackup ? backupDeals : deals).forEach(deal => {
      Object.keys(deal).forEach(key => {
        if (!coreFields.includes(key) && !['id', 'documents', 'signatures'].includes(key)) {
          keys.add(key);
        }
      });
    });
    return Array.from(keys);
  };

  const dynamicTableHeaders = getAllDealKeys();

  return (
    <div className="space-y-4">
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
            className="hidden sm:flex"
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

      {showBackup && (
        <div className="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>Viewing backup deals. These are deleted or previous versions of active deals.</span>
        </div>
      )}

      {viewMode === 'card' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedDeals.length === 0 ? (
              <p className="text-center text-muted-foreground col-span-full py-8">
                No {showBackup ? 'backup' : 'active'} deals found.
              </p>
            ) : (
              paginatedDeals.map((deal) => (
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
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">{deal.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">{deal.company}</p>
                      </div>
                      <Badge className={`${getStatusColor(deal.status)} whitespace-nowrap shrink-0`}>
                        <div className="flex items-center">
                          {getStatusIcon(deal.status)}
                          <span className="ml-1 capitalize text-xs">
                            {deal.status.replace('_', ' ')}
                          </span>
                        </div>
                      </Badge>
                    </div>

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

                      <div className="space-y-1 text-sm pt-2 border-t dark:border-gray-700">
                        {Object.entries(deal).map(([key, value]) => renderField(key, value))}
                      </div>
                    </div>

                    <div className="mt-4 pt-2 border-t dark:border-gray-700 flex justify-end">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
                                           dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]"
                          onClick={() => handlePreview(deal)}
                          disabled={isLoading}
                        >
                          <Eye className="h-4 w-4 " /> 
                        </Button>
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
                              <RotateCcw className="h-4 w-4 " /> 
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-red-500 hover:text-red-600 hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
                                           dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]"
                              onClick={() => setDeletingDealId(deal.id)}
                              disabled={isLoading}
                            >
                              <Trash2 className="h-4 w-2 " /> Delete
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
                              <Edit className="h-4 w-2 " />Edit
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

          {/* Pagination Controls */}
          {totalItems > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{endIndex} of {totalItems} deals
                </span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                >
                  {[5, 10, 20, 50, 100].map(size => (
                    <option key={size} value={size}>{size} per page</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <span className="px-2">...</span>
                )}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages)}
                  >
                    {totalPages}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg shadow-[inset_5px_5px_10px_rgba(0,0,0,0.05),inset_-5px_-5px_10px_rgba(255,255,255,0.8)] dark:shadow-[inset_5px_5px_10px_rgba(0,0,0,0.3),inset_-5px_-5px_10px_rgba(75,85,99,0.3)]">
            <ShadcnTable className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <TableHeader className="bg-gray-50 dark:bg-gray-800">
                <TableRow className="bg-white dark:bg-gray-800 neuro-inset">
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
                {paginatedDeals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={dynamicTableHeaders.length + 1} className="py-4 text-center text-muted-foreground">
                      No {showBackup ? 'backup' : 'active'} deals found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDeals.map((deal) => (
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
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 hover:shadow-[3px_3px_6px_rgba(0,0,0,0.1),-3px_-3px_6px_rgba(255,255,255,0.8)]
                                                      dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(75,85,99,0.3)]"
                            onClick={() => handlePreview(deal)}
                            disabled={isLoading}
                            title="Preview Deal"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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

          {/* Pagination Controls */}
          {totalItems > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{endIndex} of {totalItems} deals
                </span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                >
                  {[5, 10, 20, 50, 100].map(size => (
                    <option key={size} value={size}>{size} per page</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <span className="px-2">...</span>
                )}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages)}
                  >
                    {totalPages}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

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

      {/* Preview Deal Dialog */}
      <Dialog open={!!previewDeal} onOpenChange={() => setPreviewDeal(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deal Preview</DialogTitle>
            <DialogDescription>
              Detailed view of {previewDeal?.name || 'the selected deal'}
            </DialogDescription>
          </DialogHeader>
          
          {previewDeal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Deal Name</h4>
                  <p className="text-sm">{previewDeal.name}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Company</h4>
                  <p className="text-sm">{previewDeal.company}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Lead</h4>
                  <p className="text-sm">{previewDeal.leadName}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Agent</h4>
                  <p className="text-sm">{previewDeal.agentName}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Amount</h4>
                  <p className="text-sm">${previewDeal.amount?.toLocaleString() || '0.00'}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                  <Badge className={`${getStatusColor(previewDeal.status)}`}>
                    <div className="flex items-center">
                      {getStatusIcon(previewDeal.status)}
                      <span className="ml-1 capitalize">{previewDeal.status.replace('_', ' ')}</span>
                    </div>
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Created At</h4>
                  <p className="text-sm">{previewDeal.createdAt}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Closing Date</h4>
                  <p className="text-sm">{previewDeal.closingDate}</p>
                </div>
              </div>

              {previewDeal.description && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                  <p className="text-sm">{previewDeal.description}</p>
                </div>
              )}

              {previewDeal.documents && previewDeal.documents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Documents</h4>
                  <div className="space-y-2">
                    {previewDeal.documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">Created: {doc.createdAt}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDocument(doc)}
                        >
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewDeal.signatures && previewDeal.signatures.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Signatures</h4>
                  <div className="space-y-2">
                    {previewDeal.signatures.map(sig => {
                      // Find the associated document name
                      const document = previewDeal.documents?.find(doc => doc.id === sig.documentId);
                      return (
                        <div key={`${sig.documentId}-${sig.signerId}`} className="p-2 border rounded">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium">
                                {document?.name || 'Unknown Document'}
                              </p>
                              <p className="text-sm">
                                Signed by: {sig.signerName} ({sig.signerEmail})
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Signed at: {new Date(sig.signedAt).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant={sig.status === 'signed' ? 'default' : 'secondary'}>
                              {sig.status === 'signed' ? 'Signed' : 'Pending'}
                            </Badge>
                          </div>
                          
                          {/* Signature Image Display */}
                          {sig.signatureData && (
                            <div className="mt-3 border-t pt-3">
                              <p className="text-xs text-muted-foreground mb-1">Signature:</p>
                              <div className="border rounded p-2 bg-white">
                                <img 
                                  src={sig.signatureData} 
                                  alt={`Signature of ${sig.signerName}`}
                                  className="max-w-full h-auto max-h-20 object-contain"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Display custom fields */}
              {Object.entries(previewDeal)
                .filter(([key]) => !coreFields.includes(key) && !['id', 'documents', 'signatures'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </h4>
                    <p className="text-sm">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
                  </div>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Document View Dialog */}
      <Dialog open={!!currentDocument} onOpenChange={() => setCurrentDocument(null)}>
        <DialogContent className="sm:max-w-[90%] max-w-[95vw] h-[90vh]">
          <DialogHeader>
            <DialogTitle>{currentDocument?.name}</DialogTitle>
            <DialogDescription>
              Document created on {currentDocument?.createdAt}
            </DialogDescription>
          </DialogHeader>
          <div className="h-full w-full flex flex-col">
            {currentDocument?.url ? (
              <iframe 
                src={currentDocument.url} 
                className="flex-1 w-full border rounded-md"
                title={currentDocument.name}
              />
            ) : (
              <div className="flex-1 w-full border rounded-md p-4 overflow-auto">
                <pre className="whitespace-pre-wrap">{currentDocument?.content}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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