import React, { useState, useEffect } from 'react';
import { 
  Phone, Mail, MessageSquare, Edit, Trash2, Filter, Download, Upload, 
  ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, Calendar as CalendarIcon, 
  Check, CheckCircle, Circle, Clock, X, CheckSquare, Square, RotateCw,
  ArrowUp,
  ArrowDown,
  BarChart2, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { database } from '../../firebase';
import { onValue, remove, update, query, orderByChild, startAt, endAt, get } from 'firebase/database';
import { useAuth } from '@/context/AuthContext';
import { LeadForm } from './LeadForm';
import { FileManager } from '@/components/common/FileManager';
import { useIsMobile } from '@/hooks/use-mobile';
import { LeadDetails } from './LeadDetails';
import * as XLSX from 'xlsx';
import { ref, push, set } from 'firebase/database';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import PlanModal from '@/pages/PlanModel';

// Encryption key - in a real app, this should be securely managed
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8'; // 32 chars for AES-256

interface Lead {
  id?: string;
  Name?: string;
  Date?: string;
  Meeting_Date?: string;
  Meeting_Time?: string;
  Meeting_Status?: string;
  linkedin_url?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  Industry?: string;
  Employee_Size?: string;
  job_title?: string;
  Email_ID?: string;
  Mobile_Number?: string;
  Linkedin_R?: string;
  Email_R?: string;
  Mobile_R?: string;
  Whatsapp_R?: string;
  Comment?: string;
  RPC_link?: string;
  Meeting_Takeaway?: string;
  Website?: string;
  Requirement?: string;
  createdAt: string;
  leadNumber?: number;
  scheduledCall?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  score?: number;
  scoreFactors?: {
    emailOpened?: boolean;
    linkClicked?: boolean;
    meetingAttended?: boolean;
    responseReceived?: boolean;
  };
  source?: string;
}

interface LeadDetailsProps {
  lead: {
    id: string;
    Name?: string;
    Date?: string;
    Meeting_Date?: string;
    Meeting_Time?: string;
    Meeting_Status?: string;
    linkedin_url?: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    Industry?: string;
    Employee_Size?: string;
    job_title?: string;
    Email_ID?: string;
    Mobile_Number?: string;
    Linkedin_R?: string;
    Email_R?: string;
    Mobile_R?: string;
    Whatsapp_R?: string;
    Comment?: string;
    RPC_link?: string;
    Meeting_Takeaway?: string;
    Website?: string;
    Requirement?: string;
    createdAt?: string;
  };
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSchedule?: () => void;
  isMobile?: boolean;
  onRestore?: () => void;
}

// Helper function to encrypt data
async function encryptData(data: string): Promise<string> {
  if (!data) return data;
  
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
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encodedData
  );
  
  // Combine iv and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// Helper function to decrypt data
// Helper function to decrypt data
async function decryptData(encryptedData: string): Promise<string> {
  if (!encryptedData) return encryptedData;
  
  try {
    // Check if the string looks like it might be base64 encoded
    // Base64 strings should only contain A-Z, a-z, 0-9, +, /, and =
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    
    if (!base64Regex.test(encryptedData)) {
      console.warn('Data does not appear to be base64 encoded, returning as-is');
      return encryptedData;
    }
    
    const decoder = new TextDecoder();
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Check if the data has the expected minimum length (IV + some encrypted data)
    if (combined.length < 13) {
      console.warn('Encrypted data too short to be valid, returning as-is');
      return encryptedData;
    }
    
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

// Function to encrypt lead values
async function encryptLead(lead: Lead): Promise<Lead> {
  const encryptedLead = { ...lead };
  
  // Encrypt each field that needs encryption
  encryptedLead.Name = await encryptData(lead.Name || '');
  encryptedLead.linkedin_url = await encryptData(lead.linkedin_url || '');
  encryptedLead.first_name = await encryptData(lead.first_name || '');
  encryptedLead.last_name = await encryptData(lead.last_name || '');
  encryptedLead.company = await encryptData(lead.company || '');
  encryptedLead.Industry = await encryptData(lead.Industry || '');
  encryptedLead.job_title = await encryptData(lead.job_title || '');
  encryptedLead.Email_ID = await encryptData(lead.Email_ID || '');
  encryptedLead.Mobile_Number = await encryptData(lead.Mobile_Number || '');
  encryptedLead.Website = await encryptData(lead.Website || '');
  encryptedLead.RPC_link = await encryptData(lead.RPC_link || '');
  encryptedLead.Requirement = await encryptData(lead.Requirement || '');
  encryptedLead.Meeting_Takeaway = await encryptData(lead.Meeting_Takeaway || '');
  encryptedLead.Comment = await encryptData(lead.Comment || '');
  
  return encryptedLead;
}

// Function to decrypt lead values
async function decryptLead(lead: Lead): Promise<Lead> {
  const decryptedLead = { ...lead };
  
  // Decrypt each encrypted field
  decryptedLead.Name = await decryptData(lead.Name || '');
  decryptedLead.linkedin_url = await decryptData(lead.linkedin_url || '');
  decryptedLead.first_name = await decryptData(lead.first_name || '');
  decryptedLead.last_name = await decryptData(lead.last_name || '');
  decryptedLead.company = await decryptData(lead.company || '');
  decryptedLead.Industry = await decryptData(lead.Industry || '');
  decryptedLead.job_title = await decryptData(lead.job_title || '');
  decryptedLead.Email_ID = await decryptData(lead.Email_ID || '');
  decryptedLead.Mobile_Number = await decryptData(lead.Mobile_Number || '');
  decryptedLead.Website = await decryptData(lead.Website || '');
  decryptedLead.RPC_link = await decryptData(lead.RPC_link || '');
  decryptedLead.Requirement = await decryptData(lead.Requirement || '');
  decryptedLead.Meeting_Takeaway = await decryptData(lead.Meeting_Takeaway || '');
  decryptedLead.Comment = await decryptData(lead.Comment || '');
  
  return decryptedLead;
}

export const LeadsTable: React.FC = () => {
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey');
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deletedLeads, setDeletedLeads] = useState<Lead[]>([]);
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showFileManager, setShowFileManager] = useState(false);
  const [fileManagerMode, setFileManagerMode] = useState<'import' | 'export'>('import');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();
  const [currentAgentRange, setCurrentAgentRange] = useState<{from: number, to: number} | null>(null);
  const [showModal, setShowModal] = useState(false);
  const isAgent = true;
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showAddLeadButton, setShowAddLeadButton] = useState(true);
  const [showBackupLeads, setShowBackupLeads] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  
  // Bulk selection state
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: 'score', 
    direction: 'desc' 
  });

  const [reportLead, setReportLead] = useState<Lead | null>(null);
  
  const generateLeadReport = (lead: Lead) => {
    // Create a report object with all the lead details
    const reportData = {
      'Lead ID': lead.id,
      'First Name': lead.first_name || 'N/A',
      'Last Name': lead.last_name || 'N/A',
      'Email': lead.Email_ID || 'N/A',
      'Phone': lead.Mobile_Number || 'N/A',
      'Company': lead.company || 'N/A',
      'Industry': lead.Industry || 'N/A',
      'Job Title': lead.job_title || 'N/A',
      'Status': lead.Meeting_Status || 'N/A',
      'LinkedIn': lead.linkedin_url || 'N/A',
      'Website': lead.Website || 'N/A',
      'Meeting Date': lead.Meeting_Date || 'N/A',
      'Meeting Time': lead.Meeting_Time || 'N/A',
      'Comments': lead.Comment || 'N/A',
      'Created At': lead.createdAt ? new Date(lead.createdAt).toLocaleString() : 'N/A',
      'Lead Score': lead.score || 'Not calculated'
    };

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet([reportData]);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lead Report');
    
    // Generate file name
    const fileName = `lead_report_${lead.first_name}_${lead.last_name}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    
    // Download the file
    XLSX.writeFile(workbook, fileName);
    
    toast.success(`Report for ${lead.first_name} ${lead.last_name} downloaded`);
  };
  
  // Call scheduling state
  const [showScheduleCall, setShowScheduleCall] = useState(false);
  const [callScheduleDate, setCallScheduleDate] = useState<Date | undefined>(new Date());
  const [callScheduleTime, setCallScheduleTime] = useState('09:00');
  const [isBulkScheduling, setIsBulkScheduling] = useState(false);
  const [mobileSelectMode, setMobileSelectMode] = useState(false);
  const [dateFilter, setDateFilter] = useState<'created' | 'meeting'>('created');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [leadLimit, setLeadLimit] = useState<number | null>(null);
  const roleRef = ref(database, `users/${adminId}/agetns/${agentId}/role`);
  
  interface ScoringConfig {
    baseScores: {
      Email_R: number;
      Mobile_Number: number;
      Meeting_Date: number;
      Linkedin_R: number;
      Website: number;
    };
    engagement: {
      emailOpened: number;
      linkClicked: number;
      meetingAttended: number;
      responseReceived: number;
    };
    statusWeights: Record<string, number>;
    industryWeights: Record<string, number>;
    companySizeWeights: Record<string, number>;
  }
  
  const LEAD_SCORING_CONFIG: ScoringConfig = {
    baseScores: {
      Email_R: 5,
      Mobile_Number: 10,
      Meeting_Date: 20,
      Linkedin_R: 15,
      Website: 5,
    },
    engagement: {
      emailOpened: 2,
      linkClicked: 3,
      meetingAttended: 5,
      responseReceived: 4,
    },
    statusWeights: {
      new: 1,
      contacted: 1.2,
      qualified: 1.5,
      proposal: 1.8,
      negotiation: 2,
      closed: 0.5,
    },
    industryWeights: {
      'Technology': 1.5,
      'Finance': 1.3,
      'Healthcare': 1.2,
      'Manufacturing': 1.1,
      'Retail': 1.0,
    },
    companySizeWeights: {
      '1-10': 1,
      '11-50': 1.2,
      '51-200': 1.5,
      '201-500': 1.8,
      '501-1000': 2,
      '1001-5000': 2.2,
      '5001-10000': 2.5,
      '10000+': 3,
    }
  };

  const getConfigValue = <T extends Record<string, any>>(
    config: T, 
    key: string | undefined, 
    defaultValue: number
  ): number => {
    if (!key) return defaultValue;
    return config[key] ?? defaultValue;
  };

  const calculateLeadScore = (lead: Lead): number => {
    // Initialize with base score
    let score = 0;

    // Base contact information scores
    if (lead.Email_ID) score += LEAD_SCORING_CONFIG.baseScores.Email_R;
    if (lead.Mobile_Number) score += LEAD_SCORING_CONFIG.baseScores.Mobile_Number;
    if (lead.linkedin_url) score += LEAD_SCORING_CONFIG.baseScores.Linkedin_R;
    if (lead.Website) score += LEAD_SCORING_CONFIG.baseScores.Website;

    // Engagement multipliers (applied multiplicatively)
    const engagementFactors = lead.scoreFactors || {};
    if (engagementFactors.emailOpened) score *= LEAD_SCORING_CONFIG.engagement.emailOpened;
    if (engagementFactors.linkClicked) score *= LEAD_SCORING_CONFIG.engagement.linkClicked;
    if (engagementFactors.meetingAttended) score *= LEAD_SCORING_CONFIG.engagement.meetingAttended;
    if (engagementFactors.responseReceived) score *= LEAD_SCORING_CONFIG.engagement.responseReceived;

    // Status weight
    const statusWeight = getConfigValue(
      LEAD_SCORING_CONFIG.statusWeights, 
      lead.Meeting_Status, 
      1
    );
    score *= statusWeight;

    // Industry weight
    const industryWeight = getConfigValue(
      LEAD_SCORING_CONFIG.industryWeights, 
      lead.Industry, 
      1
    );
    score *= industryWeight;

    // Company size weight
    const companySizeWeight = getConfigValue(
      LEAD_SCORING_CONFIG.companySizeWeights, 
      lead.Employee_Size, 
      1
    );
    score *= companySizeWeight;

    // Ensure score is within reasonable bounds
    return Math.max(0, Math.min(100, Math.round(score)));
  };

const updateLeadScores = async () => {
  if (!adminId) return;

  try {
    const leadsRef = ref(database, `users/${adminId}/leads`);
    const updates: Record<string, any> = {};

    // Process each lead to calculate and update scores
    for (const lead of leads) {
      try {
        const decryptedLead = await decryptLead(lead);
        const score = calculateLeadScore(decryptedLead);
        updates[`${lead.id}/score`] = score;
      } catch (error) {
        console.error(`Failed to process lead ${lead.id}:`, error);
        // Optionally set a default score or skip this lead
        updates[`${lead.id}/score`] = 0;
      }
    }

    await update(leadsRef, updates);
    toast.success('Lead scores updated successfully');
  } catch (error) {
    toast.error('Failed to update lead scores');
    console.error('Error updating lead scores:', error);
  }
};

  // Fetch leads, deleted leads, and limit from Firebase
 // Fetch leads with agent range filtering and encryption
  useEffect(() => {
    if (!adminId) return;
  
    const leadsRef = ref(database, `users/${adminId}/leads`);
    const deletedLeadsRef = ref(database, `users/${adminId}/deletedLeads`);
    const leadLimitRef = ref(database, `users/${adminId}/leadLimit`);
    const roleRef = ref(database, `users/${adminId}/agetns/${agentId}/role`);
  
    // Get role first
    const unsubscribeRole = onValue(roleRef, (snapshot) => {
      const role = snapshot.val();
      setUserRole(role);
      setShowAddLeadButton(role !== "agent");
    });
  
    // Get active leads with decryption
    const unsubscribeLeads = onValue(leadsRef, async (snapshot) => {
      const leadsData = snapshot.val();
      let allLeads: Lead[] = [];

      if (leadsData) {
        // Process all leads first
        const leadsPromises = Object.keys(leadsData).map(async (pushKey) => {
          const leadData = leadsData[pushKey];
          if (leadData && !leadData.isDeleted) {
            try {
              const decryptedLead = await decryptLead({
                id: pushKey,
                ...leadData
              });
              return decryptedLead;
            } catch (error) {
              console.error('Error decrypting lead:', error);
              return {
                id: pushKey,
                ...leadData
              };
            }
          }
          return null;
        });

        const resolvedLeads = await Promise.all(leadsPromises);
        allLeads = resolvedLeads.filter(Boolean) as Lead[];
      }

      // Sort leads by creation date
      allLeads.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (isAdmin) {
        setLeads(allLeads);
      } else {
        if (!agentId) return;

        const agentRef = ref(database, `users/${adminId}/agents/${agentId}`);
        onValue(agentRef, async (agentSnapshot) => {
          const agentData = agentSnapshot.val();
          const fromPosition = parseInt(agentData?.from || '');
          const toPosition = parseInt(agentData?.to || '');
          const safeFrom = Math.max(1, fromPosition);
          const safeTo = Math.min(allLeads.length, toPosition);
          
          setCurrentAgentRange({ from: safeFrom, to: safeTo });
          const slicedLeads = allLeads.slice(safeFrom - 1, safeTo);
          setLeads(slicedLeads);
          setCurrentPage(1);
        });
      }
    });

    // Get deleted leads with decryption
    const unsubscribeDeletedLeads = onValue(deletedLeadsRef, async (snapshot) => {
      const deletedLeadsData = snapshot.val();
      const allDeletedLeads: Lead[] = [];

      if (deletedLeadsData) {
        for (const pushKey of Object.keys(deletedLeadsData)) {
          const leadData = deletedLeadsData[pushKey];
          if (leadData) {
            try {
              const decryptedLead = await decryptLead({
                id: pushKey,
                ...leadData
              });
              allDeletedLeads.push(decryptedLead);
            } catch (error) {
              console.error('Error decrypting deleted lead:', error);
              allDeletedLeads.push({
                id: pushKey,
                ...leadData
              });
            }
          }
        }
      }

      setDeletedLeads(allDeletedLeads);
    });

    // Get lead limit
    const unsubscribeLimit = onValue(leadLimitRef, (snapshot) => {
      const limit = snapshot.val();
      setLeadLimit(limit);
    });

    return () => {
      unsubscribeLeads();
      unsubscribeDeletedLeads();
      unsubscribeLimit();
      unsubscribeRole();
    };
  }, [adminId, agentId, isAdmin]);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage] = useState(10);

  // Reset bulk selection when leads change
  useEffect(() => {
    setSelectedLeads([]);
    setIsSelectAll(false);
  }, [leads, currentPage]);

  // Toggle show bulk actions based on selection
  useEffect(() => {
    setShowBulkActions(selectedLeads.length > 0);
  }, [selectedLeads]);

  const filteredLeads = showBackupLeads 
    ? deletedLeads.filter(lead => {
        const searchFields = [
          lead.first_name?.toLowerCase(),
          lead.last_name?.toLowerCase(),
          lead.Email_R?.toLowerCase(),
          lead.company?.toLowerCase(),
          lead.Mobile_Number
        ].join(' ');

        const matchesSearch = searchFields.includes(searchTerm.toLowerCase());
        const matchesStatus = selectedStatus ? lead.Meeting_Status === selectedStatus : true;
        const matchesSource = selectedSource && selectedSource !== 'all' 
          ? lead.source === selectedSource 
          : true;    
        if (dateRange.from || dateRange.to) {
          const dateToCheck = dateFilter === 'created' 
            ? new Date(lead.createdAt)
            : lead.Meeting_Date ? new Date(lead.Meeting_Date) : null;
          
          if (!dateToCheck) return false;
          
          if (dateRange.from && dateToCheck < dateRange.from) return false;
          if (dateRange.to && dateToCheck > dateRange.to) return false;
        }
        return matchesSearch && matchesStatus && matchesSource;
      })
    : leads.filter(lead => {
        const searchFields = [
          lead.first_name?.toLowerCase(),
          lead.last_name?.toLowerCase(),
          lead.Email_ID?.toLowerCase(),
          lead.company?.toLowerCase(),
          lead.Mobile_Number
        ].join(' ');

        const matchesSearch = searchFields.includes(searchTerm.toLowerCase());
        const matchesStatus = selectedStatus ? lead.Meeting_Status === selectedStatus : true;
        const matchesSource = selectedSource && selectedSource !== 'all' 
          ? lead.source === selectedSource 
          : true;    
        if (dateRange.from || dateRange.to) {
          const dateToCheck = dateFilter === 'created' 
            ? new Date(lead.createdAt)
            : lead.Meeting_Date ? new Date(lead.Meeting_Date) : null;
          
          if (!dateToCheck) return false;
          
          if (dateRange.from && dateToCheck < dateRange.from) return false;
          if (dateRange.to && dateToCheck > dateRange.to) return false;
        }
        return matchesSearch && matchesStatus && matchesSource;
      });

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (sortConfig.key === 'score') {
      const scoreA = a.score || 0;
      const scoreB = b.score || 0;
      return sortConfig.direction === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    }
    return 0;
  });

  // Pagination logic
  const indexOfLastLead = currentPage * leadsPerPage;
  const indexOfFirstLead = indexOfLastLead - leadsPerPage;
  const currentLeads = sortedLeads.slice(indexOfFirstLead, indexOfLastLead);
  const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const firstPage = () => setCurrentPage(1);
  const lastPage = () => setCurrentPage(totalPages);

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (isSelectAll) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(currentLeads.map(lead => lead.id!));
    }
    setIsSelectAll(!isSelectAll);
  };

  const toggleSelectLead = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId) 
        : [...prev, leadId]
    );
  };

  const permanentDeleteLead = async (leadId: string) => {
    if (!adminId) return;

    try {
      const leadRef = ref(database, `users/${adminId}/deletedLeads/${leadId}`);
      await remove(leadRef);
      toast.success('Lead permanently deleted');
      setShowDeleteConfirm(false);
      setLeadToDelete(null);
    } catch (error) {
      toast.error('Failed to permanently delete lead');
      console.error('Error deleting lead:', error);
    }
  };

  // Soft delete a lead (move to backup)
  const softDeleteLead = async (leadId: string) => {
    if (!adminId) return;

    try {
      // Get the lead data first
      const leadRef = ref(database, `users/${adminId}/leads/${leadId}`);
      const leadSnapshot = await get(leadRef);
      const leadData = leadSnapshot.val();

      if (leadData) {
        // Add to deleted leads
        const deletedLeadRef = ref(database, `users/${adminId}/deletedLeads/${leadId}`);
        await set(deletedLeadRef, {
          ...leadData,
          isDeleted: true,
          deletedAt: new Date().toISOString()
        });

        // Remove from active leads
        await remove(leadRef);

        toast.success('Lead moved to backup');
      }
    } catch (error) {
      toast.error('Failed to delete lead');
      console.error('Error deleting lead:', error);
    }
  };

  // Restore a lead from backup
  const restoreLead = async (leadId: string) => {
    if (!adminId) return;

    try {
      // Get the lead data from deleted leads
      const deletedLeadRef = ref(database, `users/${adminId}/deletedLeads/${leadId}`);
      const leadSnapshot = await get(deletedLeadRef);
      const leadData = leadSnapshot.val();

      if (leadData) {
        // Add back to active leads
        const leadRef = ref(database, `users/${adminId}/leads/${leadId}`);
        await set(leadRef, {
          ...leadData,
          isDeleted: false
        });

        // Remove from deleted leads
        await remove(deletedLeadRef);

        toast.success('Lead restored successfully');
      }
    } catch (error) {
      toast.error('Failed to restore lead');
      console.error('Error restoring lead:', error);
    }
  };

  // Bulk actions
  const handleBulkStatusChange = async (newStatus: string) => {
    if (!adminId || selectedLeads.length === 0) return;

    try {
      const updatePromises = selectedLeads.map(leadId => 
        update(ref(database, `users/${adminId}/leads/${leadId}`), { 
          status: newStatus
        })
      );

      await Promise.all(updatePromises);
      toast.success(`${selectedLeads.length} leads updated to ${newStatus}`);
      setSelectedLeads([]);
      setIsSelectAll(false);
    } catch (error) {
      toast.error('Failed to update leads');
      console.error('Error updating leads:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (!adminId || selectedLeads.length === 0 || !window.confirm(`Are you sure you want to delete ${selectedLeads.length} leads?`)) return;

    try {
      const deletePromises = selectedLeads.map(leadId => 
        softDeleteLead(leadId)
      );

      await Promise.all(deletePromises);
      toast.success(`${selectedLeads.length} leads moved to backup`);
      setSelectedLeads([]);
      setIsSelectAll(false);
      
      // Reset to first page if current page would be empty
      if (currentLeads.length === selectedLeads.length && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (error) {
      toast.error('Failed to delete leads');
      console.error('Error deleting leads:', error);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!adminId || !window.confirm('Are you sure you want to permanently delete this lead? This action cannot be undone.')) return;
    await permanentDeleteLead(id);
    
    if (selectedLead?.id === id) {
      setSelectedLead(null);
    }
    
    // Reset to first page if the current page would be empty after deletion
    if (currentLeads.length === 1 && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (!adminId || selectedLeads.length === 0 || !window.confirm(`Are you sure you want to permanently delete ${selectedLeads.length} leads? This action cannot be undone.`)) return;

    try {
      const deletePromises = selectedLeads.map(leadId => 
        permanentDeleteLead(leadId)
      );

      await Promise.all(deletePromises);
      toast.success(`${selectedLeads.length} leads permanently deleted`);
      setSelectedLeads([]);
      setIsSelectAll(false);
      
      // Reset to first page if current page would be empty
      if (currentLeads.length === selectedLeads.length && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (error) {
      toast.error('Failed to permanently delete leads');
      console.error('Error permanently deleting leads:', error);
    }
  };

  const handleBulkRestore = async () => {
    if (!adminId || selectedLeads.length === 0 || !window.confirm(`Are you sure you want to restore ${selectedLeads.length} leads?`)) return;

    try {
      const restorePromises = selectedLeads.map(leadId => 
        restoreLead(leadId)
      );

      await Promise.all(restorePromises);
      toast.success(`${selectedLeads.length} leads restored successfully`);
      setSelectedLeads([]);
      setIsSelectAll(false);
      
      // Reset to first page if current page would be empty
      if (currentLeads.length === selectedLeads.length && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (error) {
      toast.error('Failed to restore leads');
      console.error('Error restoring leads:', error);
    }
  };

  // Call scheduling
  const handleScheduleCall = async () => {
    if (!adminId || !callScheduleDate) return;

    const leadIds = isBulkScheduling ? selectedLeads : [selectedLead?.id].filter(Boolean) as string[];
    if (leadIds.length === 0) return;

    try {
      const scheduleDateTime = `${format(callScheduleDate, 'yyyy-MM-dd')}T${callScheduleTime}`;
      const updatePromises = leadIds.map(leadId => 
        update(ref(database, `users/${adminId}/leads/${leadId}`), { 
          scheduledCall: scheduleDateTime
        })
      );

      await Promise.all(updatePromises);
      const message = leadIds.length === 1 
        ? 'Call scheduled successfully' 
        : `${leadIds.length} calls scheduled successfully`;
      toast.success(message);
      setShowScheduleCall(false);
      setCallScheduleDate(new Date());
      setCallScheduleTime('09:00');
      setSelectedLead(null);
    } catch (error) {
      toast.error('Failed to schedule call');
      console.error('Error scheduling call:', error);
    }
  };

  const handleSingleScheduleCall = (lead: Lead) => {
    setSelectedLead(lead);
    if (lead.scheduledCall) {
      const [date, time] = lead.scheduledCall.split('T');
      setCallScheduleDate(new Date(date));
      setCallScheduleTime(time || '09:00');
    }
    setIsBulkScheduling(false);
    setShowScheduleCall(true);
  };

  const handleBulkScheduleCall = () => {
    if (selectedLeads.length === 0) return;
    setIsBulkScheduling(true);
    setShowScheduleCall(true);
  };

  // Toggle mobile selection mode
  const toggleMobileSelectMode = () => {
    setMobileSelectMode(!mobileSelectMode);
    if (mobileSelectMode) {
      setSelectedLeads([]);
      setIsSelectAll(false);
    }
  };

  // Toggle lead selection for mobile
  const toggleMobileSelectLead = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId) 
        : [...prev, leadId]
    );
  };

  const handleDelete = async (id: string) => {
    if (!adminId || !window.confirm('Are you sure you want to delete this lead?')) return;
    await softDeleteLead(id);
    
    if (selectedLead?.id === id) {
      setSelectedLead(null);
    }
    
    // Reset to first page if the current page would be empty after deletion
    if (currentLeads.length === 1 && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleRestore = async (id: string) => {
    if (!adminId || !window.confirm('Are you sure you want to restore this lead?')) return;
    await restoreLead(id);
    
    if (selectedLead?.id === id) {
      setSelectedLead(null);
    }
    
    // Reset to first page if the current page would be empty after restoration
    if (currentLeads.length === 1 && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleUpdateLead = async (updatedLead: Lead) => {
    if (!adminId) return;

    try {
      // Encrypt the updated lead data before saving
      const encryptedLead = await encryptLead(updatedLead);
      
      // Prepare the updates
      const updates: Record<string, any> = {};
      Object.keys(encryptedLead).forEach(key => {
        if (key !== 'id') {
          updates[key] = encryptedLead[key as keyof Lead];
        }
      });

      // Update the lead in Firebase
      const leadRef = ref(database, `users/${adminId}/leads/${updatedLead.id}`);
      await update(leadRef, updates);

      toast.success('Lead updated successfully');
      setEditingLead(null);
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error('Failed to update lead');
    }
  };

  const handleAction = (type: string, lead: Lead) => {
    switch (type) {
      case 'call':
        if (lead.Mobile_Number) {
          window.open(`tel:${lead.Mobile_Number}`, '_blank');
        } else {
          toast.warning('No phone number available for this lead');
        }
        break;
        
      case 'email':
        if (lead.Email_ID) {
          window.open(`mailto:${lead.Email_ID}?subject=Regarding your property inquiry`, '_blank');
        } else {
          toast.warning('No email address available for this lead');
        }
        break;
        
      case 'whatsapp':
        if (lead.Mobile_Number) {
          const cleanedPhone = lead.Mobile_Number.replace(/\D/g, '');
          const message = `Hi ${lead.first_name}, I'm following up on your property inquiry.`;
          window.open(`https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`, '_blank');
        } else {
          toast.warning('No phone number available for WhatsApp');
        }
        break;
        
      case 'edit':
        setEditingLead(lead);
        break;
        
      case 'view':
        setSelectedLead(lead);
        break;
        
      case 'schedule':
        handleSingleScheduleCall(lead);
        break;
        
      default:
        break;
    }
  };

  const handleExport = () => {
    try {
      // Prepare the data for export with all fields
      const exportData = filteredLeads.map(lead => ({
        'Lead ID': lead.id,
        'First Name': lead.first_name || '',
        'Last Name': lead.last_name || '',
        'Email': lead.Email_ID || '',
        'Mobile Number': lead.Mobile_Number || '',
        'Company': lead.company || '',
        'Industry': lead.Industry || '',
        'Job Title': lead.job_title || '',
        'Employee Size': lead.Employee_Size || '',
        'LinkedIn URL': lead.linkedin_url || '',
        'Website': lead.Website || '',
        'Status': lead.Meeting_Status || '',
        'Name': lead.Name || '',
        'Date': lead.Date || '',
        'Meeting Date': lead.Meeting_Date || '',
        'Meeting Time': lead.Meeting_Time || '',
        'LinkedIn Response': lead.Linkedin_R || '',
        'Email Response': lead.Email_R || '',
        'Mobile Response': lead.Mobile_R || '',
        'WhatsApp Response': lead.Whatsapp_R || '',
        'Comment': lead.Comment || '',
        'RPC Link': lead.RPC_link || '',
        'Meeting Takeaway': lead.Meeting_Takeaway || '',
        'Requirement': lead.Requirement || '',
        'Lead Score': lead.score || 0,
        'Created At': lead.createdAt ? new Date(lead.createdAt).toLocaleString() : '',
        'Scheduled Call': lead.scheduledCall 
          ? new Date(lead.scheduledCall).toLocaleString() 
          : '',
        'Deleted At': lead.deletedAt 
          ? new Date(lead.deletedAt).toLocaleString() 
          : ''
      }));

      // Create worksheet with auto-width columns
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths based on content
      const colWidths = [
        { wch: 15 }, // Lead ID
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 25 }, // Email
        { wch: 15 }, // Mobile Number
        { wch: 20 }, // Company
        { wch: 15 }, // Industry
        { wch: 20 }, // Job Title
        { wch: 15 }, // Employee Size
        { wch: 30 }, // LinkedIn URL
        { wch: 25 }, // Website
        { wch: 15 }, // Status
        { wch: 10 }, // RA
        { wch: 15 }, // Date
        { wch: 15 }, // Meeting Date
        { wch: 15 }, // Meeting Time
        { wch: 15 }, // LinkedIn Response
        { wch: 15 }, // Email Response
        { wch: 15 }, // Mobile Response
        { wch: 15 }, // WhatsApp Response
        { wch: 30 }, // Comment
        { wch: 30 }, // RPC Link
        { wch: 30 }, // Meeting Takeaway
        { wch: 20 }, // Requirement
        { wch: 10 }, // Lead Score
        { wch: 20 }, // Created At
        { wch: 20 }, // Scheduled Call
        { wch: 20 }  // Deleted At
      ];
      worksheet['!cols'] = colWidths;

      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
      
      // Add a second sheet with summary statistics
      const allStatuses = Array.from(new Set([...leads, ...deletedLeads].map(lead => lead.Meeting_Status)));
      const summaryData = [
        ['Total Leads', filteredLeads.length],
        ['By Status', ''],
        ...allStatuses.map(status => [
          status,
          filteredLeads.filter(lead => lead.Meeting_Status === status).length
        ]),
        ['', ''],
        ['Score Distribution', ''],
        ['0-49', filteredLeads.filter(lead => (lead.score || 0) < 50).length],
        ['50-79', filteredLeads.filter(lead => (lead.score || 0) >= 50 && (lead.score || 0) < 80).length],
        ['80-100', filteredLeads.filter(lead => (lead.score || 0) >= 80).length]
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Generate file name with current date and time
      const fileName = `Leads_Export_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
      
      // Export the file
      XLSX.writeFile(workbook, fileName);
      
      // Show success notification with download count
      toast.success(`Exported ${filteredLeads.length} leads to ${fileName}`, {
        action: {
          label: 'Open Folder',
          onClick: () => {
            // This will open the downloads folder (works in most browsers)
            window.open('file:///' + (XLSX.writeFile ? XLSX.writeFile.utils.path : 'downloads'));
          }
        }
      });

    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export leads. Please try again.');
    }
  };

  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        resolve(jsonData);
      };
      
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  const validateExcelData = (data: any[]): {
    isValid: boolean;
    missingFields: string[];
    validData: any[];
  } => {
    // Define required fields (minimum fields needed)
    const requiredFields = [
      'first_name',
      'last_name',
      'Email_ID',
      'Mobile_Number'
    ];

    if (data.length === 0) {
      return {
        isValid: false,
        missingFields: ['No data found in the Excel file'],
        validData: []
      };
    }

    // Check for missing required fields in the first row
    const firstRow = data[0];
    const missingFields = requiredFields.filter(field => !(field in firstRow));

    if (missingFields.length > 0) {
      return {
        isValid: false,
        missingFields,
        validData: []
      };
    }

    // Process all data, filling in missing fields with empty values
    const validData = data.map(row => {
      const lead: any = {};
      
      // Required fields
      lead.first_name = row['first_name'] || '';
      lead.last_name = row['last_name'] || '';
      lead.Email_ID = row['Email_ID'] || '';
      lead.Mobile_Number = row['Mobile_Number'] || '';
      
      // Optional fields with default values
      lead.Name = row['Name'] || '';
      lead.Date = row['Date'] ? (typeof row['Date'] === 'number' 
        ? excelSerialDateToString(row['Date']) 
        : row['Date']) : '';
      lead.Meeting_Date = row['Meeting_Date'] ? (typeof row['Meeting_Date'] === 'number'
        ? excelSerialDateToString(row['Meeting_Date'])
        : row['Meeting_Date']) : '';
      lead.Meeting_Time = row['Meeting_Time'] || '';
      lead.Meeting_Status = row['Meeting_Status'] || 'new';
      lead.linkedin_url = row['linkedin_url'] || '';
      lead.company = row['company'] || '';
      lead.Industry = row['Industry'] || '';
      lead.Employee_Size = row['Employee_Size'] || '';
      lead.job_title = row['job_title'] || '';
      lead.Linkedin_R = row['Linkedin_R'] || '';
      lead.Email_R = row['Email_R'] || '';
      lead.Mobile_R = row['Mobile_R'] || '';
      lead.Whatsapp_R = row['Whatsapp_R'] || '';
      lead.Comment = row['Comment'] || '';
      lead.RPC_link = row['RPC_link'] || '';
      lead.Meeting_Takeaway = row['Meeting_Takeaway'] || '';
      lead.Website = row['Website'] || '';
      lead.Requirement = row['Requirement'] || '';
      
      return lead;
    });

    return {
      isValid: true,
      missingFields: [],
      validData
    };
  };

  const excelSerialDateToString = (serial: number): string => {
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (serial - 1) * 24 * 60 * 60 * 1000);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const importLeadsToDatabase = async (leads: Omit<Lead, 'id'>[]) => {
    if (!adminId) throw new Error('User not authenticated');
    
    const leadsRef = ref(database, `users/${adminId}/leads`);
    const timestamp = new Date().toISOString();

    // Batch the imports to avoid overwhelming Firebase
    const batchSize = 50; // Adjust based on your needs
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const batchPromises = batch.map(async lead => {
        // Encrypt the lead data before saving
        const encryptedLead = await encryptLead(lead);
        const newLeadRef = push(leadsRef);
        const score = calculateLeadScore(lead);
        
        return set(newLeadRef, {
          ...encryptedLead,
          id: newLeadRef.key,
          createdAt: timestamp,
          leadNumber: lead.leadNumber || 0,
          isDeleted: false,
          score
        });
      });

      await Promise.all(batchPromises);
    }
  };

  const fetchLeadsCount = async () => {
    const adminId = localStorage.getItem('adminkey');
    const leadsRef = ref(database, `users/${adminId}/leads`);

    return new Promise<number>((resolve) => {
      onValue(leadsRef, (snapshot) => {
        const leadsData = snapshot.val();
        if (!leadsData) {
          resolve(0);
          return;
        }
        
        // Count only non-deleted leads
        let count = 0;
        Object.values(leadsData).forEach((lead: any) => {
          if (!lead.isDeleted) count++;
        });
        resolve(count);
      }, { onlyOnce: true });
    });
  };
  
  const fetchLeadLimit = async () => {
    const adminId = localStorage.getItem('adminkey');
    const limitRef = ref(database, `users/${adminId}/leadLimit`);
  
    return new Promise((resolve, reject) => {
      onValue(limitRef, (snapshot) => {
        const limit = snapshot.val() || 0;
        resolve(limit);
      }, {
        onlyOnce: true
      });
    });
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      toast.error('Please upload an Excel file (xlsx, xls, csv)');
      return;
    }

    try {
      const data = await readExcelFile(file);
      const validationResult = validateExcelData(data);

      if (!validationResult.isValid) {
        toast.error(`Missing required fields: ${validationResult.missingFields.join(', ')}`);
        return;
      }

      // Check lead limit only if not admin
      if (!isAdmin) {
        const currentLeadsCount = await fetchLeadsCount();
        const leadLimit = await fetchLeadLimit();
        const remainingLimit = leadLimit - currentLeadsCount;

        if (remainingLimit <= 0) {
          setShowModal(true);
          return;
        }

        // If there's a limit, only import up to that limit
        if (validationResult.validData.length > remainingLimit) {
          toast.warning(`Only ${remainingLimit} leads can be imported due to your plan limit`);
          validationResult.validData = validationResult.validData.slice(0, remainingLimit);
        }
      }

      // Import all valid data with encryption
      await importLeadsToDatabase(validationResult.validData);
      toast.success(`Successfully imported ${validationResult.validData.length} leads`);
      setCurrentPage(1);

    } catch (error) {
      console.error('Error importing file:', error);
      toast.error('Failed to import leads. Please check the file format and try again.');
    }
  };

  const handleFileManagerClose = (files?: string[]) => {
    setShowFileManager(false);
    
    if (files && files.length > 0) {
      if (fileManagerMode === 'import') {
        toast.success(`Imported leads from ${files[0]}`);
      } else {
        toast.success(`Exported leads to ${files[0]}`);
      }
    }
  };

  const resetFilters = () => {
    setSelectedStatus(null);
    setSelectedSource(null);
    setDateRange({});
    setCurrentPage(1);
  };

  const applyFilters = () => {
    setCurrentPage(1); // Reset to first page when filters are applied
    toast.success('Filters applied successfully');
  };

  const allStatuses = Array.from(
  new Set([...leads, ...deletedLeads]
    .map(lead => lead.Meeting_Status)
    .filter(status => status && status.trim() !== '') // Filter out empty statuses
  )
);
const allSources = Array.from(
  new Set([...leads, ...deletedLeads]
    .map(lead => lead.source)
    .filter(source => source && source.trim() !== '') // Filter out empty sources
  )
);

  return (
    <div className="space-y-4">
      {/* Backup Toggle Button */}
      <div className="flex justify-end">
        <Button
          variant={showBackupLeads ? "default" : "outline"}
          onClick={() => {
            setShowBackupLeads(!showBackupLeads);
            setCurrentPage(1);
            setSelectedLeads([]);
          }}
          className="flex items-center gap-2"
        >
          <RotateCw className="h-4 w-4" />
          {showBackupLeads ? 'View Active Leads' : 'View Backup Leads'}
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      {showBulkActions && (
        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium">
              {selectedLeads.length} selected
            </span>
            
            {!showBackupLeads && (
              <Select onValueChange={handleBulkStatusChange}>
                <SelectTrigger className="w-[180px] neuro-inset">
                  <SelectValue placeholder="Change status..." />
                </SelectTrigger>
                <SelectContent>
                  {allStatuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {!showBackupLeads && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBulkScheduleCall}
                className="flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Schedule Call
              </Button>
            )}
            
            {showBackupLeads ? (
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleBulkRestore}
                  className="flex items-center gap-2"
                >
                  <RotateCw className="h-4 w-4" />
                  Restore
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleBulkPermanentDelete}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Permanently
                </Button>
              </div>
            ) : (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleBulkDelete}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setSelectedLeads([]);
              setIsSelectAll(false);
            }}
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Range information for agents */}
      {!isAdmin && currentAgentRange && !showBackupLeads && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Showing leads {currentAgentRange.from} to {currentAgentRange.to} • {filteredLeads.length} leads found
            {filteredLeads.length === 0 && ' (No leads in your assigned range)'}
          </p>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 p-2">
        {/* Total Lead Card - Highlighted */}
        <div 
          className={`neuro p-4 cursor-pointer col-span-1 md:col-span-2 lg:col-span-1 ${
            selectedStatus === null ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() => {
            setSelectedStatus(null); // Show all leads
            setCurrentPage(1);
          }}
        >
          <p className="text-xs text-muted-foreground">Total Leads</p>
          <p className="text-2xl font-bold">
            {showBackupLeads ? deletedLeads.length : leads.length}
          </p>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-muted-foreground">
              {!showBackupLeads && (
                <span className="text-green-500">
                  +{leads.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length} today
                </span>
              )}
            </span>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        {allStatuses.map((status) => (
          <div 
            key={status}
            className={`neuro p-4 cursor-pointer ${selectedStatus === status ? 'ring-2 ring-pulse' : ''}`}
            onClick={() => {
              setSelectedStatus(selectedStatus === status ? null : status);
              setCurrentPage(1);
            }}
          >
            <p className="text-xs text-muted-foreground capitalize">{status}</p>
            <p className="text-xl font-bold">
              {showBackupLeads 
                ? deletedLeads.filter(lead => lead.Meeting_Status === status).length
                : leads.filter(lead => lead.Meeting_Status === status).length}
            </p>
          </div>
        ))}
      </div>

      {/* Actions and Search */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center mb-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {!showBackupLeads && isAdmin && (
            <Button
              onClick={() => setIsAddingLead(true)}
              className="neuro hover:shadow-none transition-all duration-300 w-full sm:w-auto"
              disabled={userRole === "agent"}
              title={userRole === "agent" ? "You cannot create leads" : ""}
            >
              Add Lead
            </Button>
          )}
  
          <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="neuro hover:shadow-none transition-all duration-300 w-full sm:w-auto">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <div className="space-y-4">
                  <h4 className="font-medium">Filter Leads</h4>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Status</p>
                    <div className="grid grid-cols-2 gap-2">
                      {allStatuses.map((status) => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`status-${status}`} 
                            checked={selectedStatus === status}
                            onCheckedChange={() => {
                              setSelectedStatus(selectedStatus === status ? null : status);
                              setCurrentPage(1);
                            }}
                          />
                          <label htmlFor={`status-${status}`} className="text-sm capitalize">
                            {status}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Source</p>
                    <Select 
  value={selectedSource || 'all'} 
  onValueChange={(value) => {
    setSelectedSource(value === 'all' ? null : value);
    setCurrentPage(1);
  }}
>
  <SelectTrigger className="w-full neuro-inset focus:shadow-none">
    <SelectValue placeholder="All sources" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All sources</SelectItem>
    {allSources
      .filter(source => source && source.trim() !== '') // Filter out empty/null sources
      .map(source => (
        <SelectItem key={source} value={source}>
          {source}
        </SelectItem>
      ))
    }
  </SelectContent>
</Select>
                  </div>
                     {/* Add Date Filter Section */}
    <div className="space-y-2">
      <p className="text-sm font-medium">Date Filter</p>
      <Select 
  value={dateFilter}
  onValueChange={(value: 'created' | 'meeting') => setDateFilter(value)}
>
  <SelectTrigger className="w-full neuro-inset focus:shadow-none">
    <SelectValue placeholder="Filter by" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="created">Created Date</SelectItem>
    {/* <SelectItem value="meeting">Meeting Date</SelectItem> */}
  </SelectContent>
</Select>
      
      <div className="grid gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "MMM dd, yyyy")} -{" "}
                    {format(dateRange.to, "MMM dd, yyyy")}
                  </>
                ) : (
                  format(dateRange.from, "MMM dd, yyyy")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        
        {dateRange.from || dateRange.to ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDateRange({})}
            className="w-full"
          >
            Clear date filter
          </Button>
        ) : null}
      </div>
    </div>
                  
                  <div className="flex justify-between">
                    <Button variant="outline" size="sm" onClick={resetFilters}>Reset</Button>
                    <Button size="sm" onClick={applyFilters}>Apply Filters</Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="icon" 
                className="neuro hover:shadow-none transition-all duration-300"
                onClick={handleExport}
                title="Export leads"
              >
                <Download className="h-4 w-4" />
              </Button>
              {!showBackupLeads && isAdmin && (
                <>
                  <input 
                    type="file" 
                    accept=".xlsx,.xls,.csv" 
                    onChange={handleImport} 
                    style={{ display: 'none' }} 
                    id="file-upload"
                  />
                  <Button
                    variant="outline"
                    className="neuro hover:shadow-none transition-all duration-300"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import Leads
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="w-full sm:w-auto">
          <Input
            placeholder={`Search ${showBackupLeads ? 'backup' : 'active'} leads...`}
            className="neuro-inset focus:shadow-none w-full sm:w-[300px]"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Leads Table - Desktop */}
      <div className="overflow-auto neuro hidden sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left p-3 text-sm font-medium text-muted-foreground w-10">
                <Checkbox 
                  checked={isSelectAll}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Mobile</th>
              {/* <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th> */}
              {/* <th className="text-left p-3 text-sm font-medium text-muted-foreground">Source</th>
   */}
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                {showBackupLeads ? 'Deleted At' : 'Created'}
              </th>
              <th 
                className="text-left p-3 text-sm font-medium text-muted-foreground cursor-pointer"
                onClick={() => setSortConfig({
                  key: 'score',
                  direction: sortConfig.key === 'score' && sortConfig.direction === 'desc' ? 'asc' : 'desc'
                })}
              >
                <div className="flex items-center">
                  Score
                  {sortConfig.key === 'score' && (
                    sortConfig.direction === 'asc' ? 
                      <ArrowUp className="ml-1 h-3 w-3" /> : 
                      <ArrowDown className="ml-1 h-3 w-3" />
                  )}
                </div>
              </th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {currentLeads.map((lead) => (
              <tr 
                key={lead.id} 
                className="hover:bg-muted/20 cursor-pointer"
                onClick={() => handleAction('view', lead)}
              >
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox 
                    checked={selectedLeads.includes(lead.id!)}
                    onCheckedChange={() => toggleSelectLead(lead.id!)}
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center">
                    <div>
                      <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                      <p className="text-sm text-muted-foreground">{lead.Email_ID}</p>
                      {lead.scheduledCall && !showBackupLeads && (
                        <div className="flex items-center mt-1 text-xs text-blue-600">
                          <Clock className="h-3 w-3 mr-1" />
                          {"Call Scheduled "+format(new Date(lead.scheduledCall), 'MMM dd, h:mm a')}
                        </div>
                      )}
                      {showBackupLeads && lead.deletedAt && (
                        <div className="flex items-center mt-1 text-xs text-red-600">
                          <Trash2 className="h-3 w-3 mr-1" />
                          {"Deleted "+format(new Date(lead.deletedAt), 'MMM dd, yyyy')}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="ml-2 h-4 w-4 text-muted-foreground" />
                  </div>
                </td>
                <td className="p-3">{lead.Mobile_Number}</td>
                {/* <td className="p-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    lead.Meeting_Status === 'new' ? 'bg-blue-100 text-blue-800' :
                    lead.Meeting_Status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                    lead.Meeting_Status === 'qualified' ? 'bg-green-100 text-green-800' :
                    lead.Meeting_Status === 'proposal' ? 'bg-indigo-100 text-indigo-800' :
                    lead.Meeting_Status === 'negotiation' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {lead.Meeting_Status}
                  </span>
                </td> */}
                {/* <td className="p-3 capitalize">{lead.source}</td> */}
                <td className="p-3">
                  {showBackupLeads && lead.deletedAt 
                    ? new Date(lead.deletedAt).toLocaleDateString()
                    : new Date(lead.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <div className="flex items-center">
                    <div className="w-8 text-right font-medium mr-2">{lead.score || 0}</div>
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          (lead.score || 0) >= 80 ? 'bg-green-500' :
                          (lead.score || 0) >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, lead.score || 0)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex space-x-1">
                    {!showBackupLeads && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction('call', lead);
                          }}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction('email', lead);
                          }}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction('whatsapp', lead);
                          }}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction('schedule', lead);
                          }}
                        >
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReportLead(lead);
                          }}
                          title="Generate report"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction('edit', lead);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {showBackupLeads ? (
                      <>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(lead.id!);
                          }}
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePermanentDelete(lead.id!);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(lead.id!);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-2">
        <div className="flex-1 text-sm text-muted-foreground">
          Showing {indexOfFirstLead + 1} to {Math.min(indexOfLastLead, filteredLeads.length)} of {filteredLeads.length} entries
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={firstPage}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={prevPage}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Show pages around current page
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
                  onClick={() => paginate(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <>
                <span className="px-2">...</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => paginate(totalPages)}
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={nextPage}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={lastPage}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile View */}
      <div className="sm:hidden space-y-4" style={mobileSelectMode ? { marginBottom: '80px', marginTop: '64px' } : {}}>
        {currentLeads.map((lead) => (
          <div 
            key={lead.id} 
            className={`neuro p-4 rounded-lg cursor-pointer relative ${selectedLeads.includes(lead.id!) ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => {
              if (mobileSelectMode) {
                toggleMobileSelectLead(lead.id!);
              } else {
                handleAction('view', lead);
              }
            }}
          >
            {mobileSelectMode && (
              <div className="absolute top-3 right-3">
                {selectedLeads.includes(lead.id!) ? (
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            )}
            
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{lead.first_name} {lead.last_name}</h3>
                <p className="text-sm text-muted-foreground">{lead.Email_ID}</p>
                <p className="text-sm mt-1">{lead.company}</p>
                {!showBackupLeads && lead.scheduledCall && (
                  <div className="flex items-center mt-1 text-xs text-blue-600">
                    <Clock className="h-3 w-3 mr-1" />
                    {format(new Date(lead.scheduledCall), 'MMM dd, h:mm a')}
                  </div>
                )}
                {showBackupLeads && lead.deletedAt && (
                  <div className="flex items-center mt-1 text-xs text-red-600">
                    <Trash2 className="h-3 w-3 mr-1" />
                    {"Deleted "+format(new Date(lead.deletedAt), 'MMM dd, yyyy')}
                  </div>
                )}
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                lead.Meeting_Status === 'new' ? 'bg-blue-100 text-blue-800' :
                lead.Meeting_Status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                lead.Meeting_Status === 'qualified' ? 'bg-green-100 text-green-800' :
                lead.Meeting_Status === 'proposal' ? 'bg-indigo-100 text-indigo-800' :
                lead.Meeting_Status === 'negotiation' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {lead.Meeting_Status}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center mt-2 gap-2 text-sm text-muted-foreground">
              <div className="mr-4">Source: {lead.source}</div>
              <div>
                {showBackupLeads ? 'Deleted: ' : 'Added: '}
                {showBackupLeads && lead.deletedAt 
                  ? new Date(lead.deletedAt).toLocaleDateString()
                  : new Date(lead.createdAt).toLocaleDateString()}
              </div>
            </div>
            
           {!mobileSelectMode && (
  <div className="mt-3 pt-3 border-t">
    <div className="flex flex-col sm:flex-row justify-between gap-3">
      {!showBackupLeads && (
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              handleAction('call', lead);
            }}
            title="Call"
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              handleAction('email', lead);
            }}
            title="Email"
          >
            <Mail className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              handleAction('whatsapp', lead);
            }}
            title="WhatsApp"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              handleAction('schedule', lead);
            }}
            title="Schedule"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setReportLead(lead);
            }}
            title="Report"
          >
            <FileText className="h-4 w-4" />
          </Button>
          {/* <Button 
            variant="outline" 
            onClick={(e) => {
              e.stopPropagation();
              updateLeadScores();
            }}
            className="flex items-center gap-2 text-xs sm:text-sm"
            title="Update Score"
          >
            <BarChart2 className="h-3 w-3 sm:h-4 sm:w-4" />
            Score
          </Button> */}
        </div>
      )}
      <div className="flex gap-2 justify-center sm:justify-end">
        <Button 
          variant="ghost" 
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            handleAction('edit', lead);
          }}
          title="Edit"
        >
          <Edit className="h-4 w-4" />
        </Button>
        {showBackupLeads ? (
          <>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700"
              onClick={(e) => {
                e.stopPropagation();
                handleRestore(lead.id!);
              }}
              title="Restore"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                handlePermanentDelete(lead.id!);
              }}
              title="Delete Permanently"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(lead.id!);
            }}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  </div>
)}
          </div>
        ))}
      </div>

      {/* Mobile Pagination */}
      <div className="sm:hidden flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={prevPage}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={nextPage}
          disabled={currentPage === totalPages || totalPages === 0}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile Selection Mode Toggle Button */}
      {isMobile && !mobileSelectMode && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button 
            size="icon" 
            className="h-12 w-12 rounded-full shadow-lg"
            onClick={toggleMobileSelectMode}
          >
            <CheckSquare className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Mobile Selection Mode Header */}
      {isMobile && mobileSelectMode && (
        <div className="fixed top-16 left-0 right-0 bg-background z-50 p-3 border-b flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleMobileSelectMode}
            >
              <X className="h-5 w-5" />
            </Button>
            <span className="font-medium">
              {selectedLeads.length} selected
            </span>
          </div>
          <Button 
            variant="ghost"
            onClick={() => {
              setIsSelectAll(!isSelectAll);
              setSelectedLeads(isSelectAll ? [] : currentLeads.map(lead => lead.id!));
            }}
          >
            {isSelectAll ? 'Deselect all' : 'Select all'}
          </Button>
        </div>
      )}

      {/* Mobile Bulk Actions Bar - Fixed at bottom when in selection mode */}
      {isMobile && mobileSelectMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-background z-50 p-3 border-t shadow-lg">
          <div className="flex justify-between gap-2">
            {!showBackupLeads && (
              <Select onValueChange={handleBulkStatusChange}>
  <SelectTrigger className="w-[180px] neuro-inset">
    <SelectValue placeholder="Change status..." />
  </SelectTrigger>
  <SelectContent>
    {allStatuses
      .filter(status => status && status.trim() !== '') // Filter out empty/null statuses
      .map(status => (
        <SelectItem key={status} value={status}>
          {status}
        </SelectItem>
      ))
    }
  </SelectContent>
</Select>
            )}
            
            {!showBackupLeads && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBulkScheduleCall}
                className="h-10 px-3"
              >
                <Clock className="h-4 w-4" />
              </Button>
            )}
            
            {showBackupLeads ? (
              <>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleBulkRestore}
                  className="h-10 px-3"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleBulkPermanentDelete}
                  className="h-10 px-3"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleBulkDelete}
                className="h-10 px-3"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Lead Details Dialog */}
      {selectedLead && (
        <>
          {isMobile ? (
            <Drawer open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
              <DrawerContent className="max-h-[90vh]">
                <div className="relative">
                  <DrawerHeader className="text-left pb-2">
                    <DrawerTitle className="flex justify-between items-center">
                      <span>Lead Details</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-4 right-4"
                        onClick={() => setSelectedLead(null)}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </DrawerTitle>
                  </DrawerHeader>
                  
                  <div className="p-4 pt-0 overflow-y-auto">
                    <LeadDetails 
                      lead={selectedLead}
                      onClose={() => setSelectedLead(null)}
                      onEdit={() => {
                        setSelectedLead(null);
                        setEditingLead(selectedLead);
                      }}
                      onDelete={() => {
                        showBackupLeads ? handlePermanentDelete(selectedLead.id!) : handleDelete(selectedLead.id!);
                        setSelectedLead(null);
                      }}
                      onRestore={showBackupLeads ? () => {
                        handleRestore(selectedLead.id!);
                        setSelectedLead(null);
                      } : undefined}
                      onSchedule={() => handleSingleScheduleCall(selectedLead)}
                      isMobile={true}
                    />
                  </div>
                  
                  <DrawerFooter className="pt-0">
                    <div className="flex justify-between gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedLead(null);
                          setEditingLead(selectedLead);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      {!showBackupLeads && (
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => handleSingleScheduleCall(selectedLead)}
                        >
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          Schedule
                        </Button>
                      )}
                      {showBackupLeads ? (
                        <>
                          <Button 
                            variant="default" 
                            className="flex-1"
                            onClick={() => {
                              handleRestore(selectedLead.id!);
                              setSelectedLead(null);
                            }}
                          >
                            <RotateCw className="h-4 w-4 mr-2" />
                            Restore
                          </Button>
                          <Button 
                            variant="destructive" 
                            className="flex-1"
                            onClick={() => {
                              handlePermanentDelete(selectedLead.id!);
                              setSelectedLead(null);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </>
                      ) : (
                        <Button 
                          variant="destructive" 
                          className="flex-1"
                          onClick={() => {
                            handleDelete(selectedLead.id!);
                            setSelectedLead(null);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Lead Details</DialogTitle>
                </DialogHeader>
                <LeadDetails 
                  lead={selectedLead}
                  onClose={() => setSelectedLead(null)}
                  onEdit={() => {
                    setSelectedLead(null);
                    setEditingLead(selectedLead);
                  }}
                  onDelete={() => {
                    showBackupLeads ? handlePermanentDelete(selectedLead.id!) : handleDelete(selectedLead.id!);
                    setSelectedLead(null);
                  }}
                  onRestore={showBackupLeads ? () => {
                    handleRestore(selectedLead.id!);
                    setSelectedLead(null);
                  } : undefined}
                  onSchedule={() => handleSingleScheduleCall(selectedLead)}
                />
              </DialogContent>
            </Dialog>
          )}
        </>
      )}

      {/* Lead Report Dialog */}
      {/* Lead Report Dialog */}
<Dialog open={!!reportLead} onOpenChange={(open) => !open && setReportLead(null)}>
  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="text-lg sm:text-xl">
        Lead Report - {reportLead?.first_name} {reportLead?.last_name}
      </DialogTitle>
    </DialogHeader>
    
    <div className="space-y-4">
      {reportLead && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Basic Information */}
          <div className="space-y-2 col-span-1 md:col-span-2">
            <h3 className="font-medium text-base sm:text-lg">Basic Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">First Name</p>
                <p className="text-sm sm:text-base">{reportLead.first_name || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Last Name</p>
                <p className="text-sm sm:text-base">{reportLead.last_name || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-sm sm:text-base break-all">{reportLead.Email_ID || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="text-sm sm:text-base">{reportLead.Mobile_Number || 'N/A'}</p>
              </div>
            </div>
          </div>
          
          {/* Professional Details */}
          <div className="space-y-2">
            <h3 className="font-medium text-base sm:text-lg">Professional Details</h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Company</p>
                <p className="text-sm sm:text-base">{reportLead.company || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Job Title</p>
                <p className="text-sm sm:text-base">{reportLead.job_title || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Industry</p>
                <p className="text-sm sm:text-base">{reportLead.Industry || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-sm sm:text-base">{reportLead.Meeting_Status || 'N/A'}</p>
              </div>
            </div>
          </div>
          
          {/* Engagement */}
          <div className="space-y-2">
            <h3 className="font-medium text-base sm:text-lg">Engagement</h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">LinkedIn</p>
                <p className="text-sm sm:text-base break-all">{reportLead.linkedin_url || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Website</p>
                <p className="text-sm sm:text-base break-all">{reportLead.Website || 'N/A'}</p>
              </div>
              {/* <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Meeting Date</p>
                <p className="text-sm sm:text-base">{reportLead.Meeting_Date || 'N/A'}</p>
              </div> */}
              {/* <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Meeting Time</p>
                <p className="text-sm sm:text-base">{reportLead.Meeting_Time || 'N/A'}</p>
              </div> */}
            </div>
          </div>
          
          {/* Metadata */}
          <div className="space-y-2">
            <h3 className="font-medium text-base sm:text-lg">Metadata</h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Created At</p>
                <p className="text-sm sm:text-base">
                  {reportLead.createdAt ? new Date(reportLead.createdAt).toLocaleString() : 'N/A'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Lead Score</p>
                <p className="text-sm sm:text-base">{reportLead.score || 'Not calculated'}</p>
              </div>
            </div>
          </div>
          
          {/* Comments */}
          {reportLead.Comment && (
            <div className="space-y-2 col-span-1 md:col-span-2">
              <h3 className="font-medium text-base sm:text-lg">Comments</h3>
              <p className="text-sm sm:text-base whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">
                {reportLead.Comment}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
    
    <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
      <Button 
        variant="outline" 
        onClick={() => setReportLead(null)}
        className="w-full sm:w-auto"
      >
        Close
      </Button>
      <Button 
        onClick={() => reportLead && generateLeadReport(reportLead)}
        className="w-full sm:w-auto"
      >
        <Download className="h-4 w-4 mr-2" />
        Download Report
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {/* Call Scheduling Dialog */}
      <Dialog open={showScheduleCall} onOpenChange={setShowScheduleCall}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isBulkScheduling ? 'Schedule Calls for Selected Leads' : 'Schedule Call'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-4">
              <Label htmlFor="call-date">Date</Label>
              <Calendar
                mode="single"
                selected={callScheduleDate}
                onSelect={setCallScheduleDate}
                className="rounded-md border"
              />
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <Label htmlFor="call-time">Time</Label>
              <Input
                type="time"
                id="call-time"
                value={callScheduleTime}
                onChange={(e) => setCallScheduleTime(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleCall(false)}>
              Cancel
            </Button>
            <Button onClick={handleScheduleCall}>
              {isBulkScheduling ? 'Schedule Calls' : 'Schedule Call'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Form Dialogs */}
      <LeadForm 
        isOpen={isAddingLead} 
        onClose={() => setIsAddingLead(false)} 
        onSubmit={(newLead) => {
          setIsAddingLead(false);
          toast.success('Lead added successfully');
          setCurrentPage(1);
        }} 
      />
      
      <LeadForm 
        isOpen={!!editingLead} 
        onClose={() => setEditingLead(null)} 
        onSubmit={handleUpdateLead}
        lead={editingLead}
      />

      {/* File Manager Dialog */}
      <FileManager 
        isOpen={showFileManager} 
        onClose={handleFileManagerClose}
        mode={fileManagerMode}
        fileType="excel"
      />
      
      <PlanModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
};