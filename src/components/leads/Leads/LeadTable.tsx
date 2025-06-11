import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../firebase';
import { onValue, remove, update, ref, push, set } from 'firebase/database';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

// Components
import { LeadsToolbar } from './LeadsToolbar';
import { LeadsGrid } from './LeadsGrid';
import { LeadsList } from './LeadsList';
import { LeadDetails } from './LeadDetails';
import { LeadForm } from './LeadForm';
import { StatusCards } from './StatusCards';
import { Pagination } from './Pagination';
import { BulkActionsBar } from './BulkActionsBar';
import { MobileSelectionHeader } from './MobileSelectionHeader';
import { MobileBulkActions } from './MobileBulkActions';
import { ScheduleCallDialog } from './ScheduleCallDialog';
import PlanModal from '@/pages/PlanModel';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company?: string;
  propertyType: string;
  budget: string;
  location: string;
  bedrooms?: string;
  bathrooms?: string;
  squareFootage?: string;
  timeline: string;
  source: string;
  status: string;
  notes: string;
  preferredContactMethod: string;
  createdAt: string;
  updatedAt: string;
  leadNumber?: number;
  scheduledCall?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export const LeadsTable: React.FC = () => {
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey');
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deletedLeads, setDeletedLeads] = useState<Lead[]>([]);
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [currentAgentRange, setCurrentAgentRange] = useState<{from: number, to: number} | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showAddLeadButton, setShowAddLeadButton] = useState(true);
  const [showBackupLeads, setShowBackupLeads] = useState(false);
  const [leadLimit, setLeadLimit] = useState<number | null>(null);
  
  // Bulk selection state
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  // Call scheduling state
  const [showScheduleCall, setShowScheduleCall] = useState(false);
  const [callScheduleDate, setCallScheduleDate] = useState<Date | undefined>(new Date());
  const [callScheduleTime, setCallScheduleTime] = useState('09:00');
  const [isBulkScheduling, setIsBulkScheduling] = useState(false);
  const [mobileSelectMode, setMobileSelectMode] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage] = useState(10);

  // Fetch data
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
  
    // Get active leads
    const unsubscribeLeads = onValue(leadsRef, (snapshot) => {
      const leadsData = snapshot.val();
      const allLeads: Lead[] = [];
  
      if (leadsData) {
        Object.keys(leadsData).forEach((pushKey) => {
          const leadData = leadsData[pushKey];
          if (leadData && !leadData.isDeleted) {
            allLeads.push({
              id: pushKey,
              ...leadData,
            });
          }
        });
      }
  
      setLeads(allLeads);
    });
  
    // Get deleted leads
    const unsubscribeDeletedLeads = onValue(deletedLeadsRef, (snapshot) => {
      const deletedLeadsData = snapshot.val();
      const allDeletedLeads: Lead[] = [];
  
      if (deletedLeadsData) {
        Object.keys(deletedLeadsData).forEach((pushKey) => {
          const leadData = deletedLeadsData[pushKey];
          if (leadData) {
            allDeletedLeads.push({
              id: pushKey,
              ...leadData,
            });
          }
        });
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
  }, [adminId]);

  // Filter and paginate leads
  const filteredLeads = showBackupLeads 
    ? deletedLeads.filter(lead => {
        const searchFields = [
          lead.firstName?.toLowerCase(),
          lead.lastName?.toLowerCase(),
          lead.email?.toLowerCase(),
          lead.company?.toLowerCase(),
          lead.phone?.toLowerCase()
        ].join(' ');

        const matchesSearch = searchFields.includes(searchTerm.toLowerCase());
        const matchesStatus = selectedStatus ? lead.status === selectedStatus : true;
        const matchesSource = selectedSource && selectedSource !== 'all' 
          ? lead.source === selectedSource 
          : true;    
        return matchesSearch && matchesStatus && matchesSource;
      })
    : leads.filter(lead => {
        const searchFields = [
          lead.firstName?.toLowerCase(),
          lead.lastName?.toLowerCase(),
          lead.email?.toLowerCase(),
          lead.company?.toLowerCase(),
          lead.phone?.toLowerCase()
        ].join(' ');

        const matchesSearch = searchFields.includes(searchTerm.toLowerCase());
        const matchesStatus = selectedStatus ? lead.status === selectedStatus : true;
        const matchesSource = selectedSource && selectedSource !== 'all' 
          ? lead.source === selectedSource 
          : true;    
        return matchesSearch && matchesStatus && matchesSource;
      });

  const indexOfLastLead = currentPage * leadsPerPage;
  const indexOfFirstLead = indexOfLastLead - leadsPerPage;
  const currentLeads = filteredLeads.slice(indexOfFirstLead, indexOfLastLead);
  const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);

  // Helper functions
  const toggleSelectAll = () => {
    if (isSelectAll) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(currentLeads.map(lead => lead.id));
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

  const toggleMobileSelectMode = () => {
    setMobileSelectMode(!mobileSelectMode);
    if (mobileSelectMode) {
      setSelectedLeads([]);
      setIsSelectAll(false);
    }
  };

  const toggleMobileSelectLead = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId) 
        : [...prev, leadId]
    );
  };

  // Action handlers
  const handleAction = (type: string, lead: Lead) => {
    switch (type) {
      case 'call':
        if (lead.phone) {
          window.open(`tel:${lead.phone}`, '_blank');
        } else {
          toast.warning('No phone number available for this lead');
        }
        break;
      case 'email':
        if (lead.email) {
          window.open(`mailto:${lead.email}?subject=Regarding your property inquiry`, '_blank');
        } else {
          toast.warning('No email address available for this lead');
        }
        break;
      case 'whatsapp':
        if (lead.phone) {
          const cleanedPhone = lead.phone.replace(/\D/g, '');
          const message = `Hi ${lead.firstName}, I'm following up on your property inquiry.`;
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

  const handleScheduleCall = async () => {
    if (!adminId || !callScheduleDate) return;

    const leadIds = isBulkScheduling ? selectedLeads : [selectedLead?.id].filter(Boolean) as string[];
    if (leadIds.length === 0) return;

    try {
      const scheduleDateTime = `${format(callScheduleDate, 'yyyy-MM-dd')}T${callScheduleTime}`;
      const updatePromises = leadIds.map(leadId => 
        update(ref(database, `users/${adminId}/leads/${leadId}`), { 
          scheduledCall: scheduleDateTime,
          updatedAt: new Date().toISOString()
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

  // Other handlers (delete, restore, etc.) would go here...

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
          {showBackupLeads ? 'View Active Leads' : 'View Backup Leads'}
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        showBulkActions={showBulkActions}
        selectedLeads={selectedLeads}
        showBackupLeads={showBackupLeads}
        onBulkStatusChange={handleBulkStatusChange}
        onBulkScheduleCall={handleBulkScheduleCall}
        onBulkRestore={handleBulkRestore}
        onBulkPermanentDelete={handleBulkPermanentDelete}
        onBulkDelete={handleBulkDelete}
        onClearSelection={() => {
          setSelectedLeads([]);
          setIsSelectAll(false);
        }}
        allStatuses={allStatuses}
      />

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
      <StatusCards
        allStatuses={allStatuses}
        selectedStatus={selectedStatus}
        onStatusClick={(status) => {
          setSelectedStatus(selectedStatus === status ? null : status);
          setCurrentPage(1);
        }}
        leads={leads}
        deletedLeads={deletedLeads}
        showBackupLeads={showBackupLeads}
      />

      {/* Toolbar */}
      <LeadsToolbar
        isAddingLead={isAddingLead}
        setIsAddingLead={setIsAddingLead}
        userRole={userRole}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        selectedSource={selectedSource}
        setSelectedSource={setSelectedSource}
        allStatuses={allStatuses}
        allSources={allSources}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showBackupLeads={showBackupLeads}
        onExport={handleExport}
        onImport={handleImport}
        resetFilters={() => {
          setSelectedStatus(null);
          setSelectedSource(null);
          setCurrentPage(1);
        }}
        applyFilters={() => {
          setCurrentPage(1);
          toast.success('Filters applied successfully');
        }}
      />

      {/* Desktop Table */}
      {!isMobile && (
        <LeadsGrid
          currentLeads={currentLeads}
          selectedLeads={selectedLeads}
          showBackupLeads={showBackupLeads}
          onSelectLead={toggleSelectLead}
          onAction={handleAction}
          onViewLead={setSelectedLead}
        />
      )}

      {/* Mobile List */}
      {isMobile && (
        <LeadsList
          currentLeads={currentLeads}
          selectedLeads={selectedLeads}
          showBackupLeads={showBackupLeads}
          mobileSelectMode={mobileSelectMode}
          onSelectLead={toggleMobileSelectLead}
          onAction={handleAction}
          onViewLead={setSelectedLead}
        />
      )}

      {/* Mobile Selection Mode Toggle */}
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

      {/* Mobile Selection Header */}
      {isMobile && mobileSelectMode && (
        <MobileSelectionHeader
          selectedLeads={selectedLeads}
          isSelectAll={isSelectAll}
          onToggleSelectMode={toggleMobileSelectMode}
          onToggleSelectAll={() => {
            setIsSelectAll(!isSelectAll);
            setSelectedLeads(isSelectAll ? [] : currentLeads.map(lead => lead.id));
          }}
        />
      )}

      {/* Mobile Bulk Actions */}
      {isMobile && mobileSelectMode && (
        <MobileBulkActions
          showBackupLeads={showBackupLeads}
          allStatuses={allStatuses}
          onBulkStatusChange={handleBulkStatusChange}
          onBulkScheduleCall={handleBulkScheduleCall}
          onBulkRestore={handleBulkRestore}
          onBulkPermanentDelete={handleBulkPermanentDelete}
          onBulkDelete={handleBulkDelete}
        />
      )}

      {/* Lead Details */}
      {selectedLead && (
        <LeadDetails
          lead={selectedLead}
          isMobile={isMobile}
          showBackupLeads={showBackupLeads}
          onClose={() => setSelectedLead(null)}
          onEdit={() => {
            setSelectedLead(null);
            setEditingLead(selectedLead);
          }}
          onDelete={() => {
            showBackupLeads ? handlePermanentDelete(selectedLead.id) : handleDelete(selectedLead.id);
            setSelectedLead(null);
          }}
          onRestore={showBackupLeads ? () => {
            handleRestore(selectedLead.id);
            setSelectedLead(null);
          } : undefined}
          onSchedule={() => handleSingleScheduleCall(selectedLead)}
        />
      )}

      {/* Pagination */}
      {filteredLeads.length > leadsPerPage && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          indexOfFirstLead={indexOfFirstLead}
          indexOfLastLead={indexOfLastLead}
          filteredLeads={filteredLeads}
          onPageChange={setCurrentPage}
          onFirstPage={() => setCurrentPage(1)}
          onPrevPage={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          onNextPage={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          onLastPage={() => setCurrentPage(totalPages)}
        />
      )}

      {/* Call Scheduling Dialog */}
      <ScheduleCallDialog
        open={showScheduleCall}
        onOpenChange={setShowScheduleCall}
        isBulkScheduling={isBulkScheduling}
        callScheduleDate={callScheduleDate}
        setCallScheduleDate={setCallScheduleDate}
        callScheduleTime={callScheduleTime}
        setCallScheduleTime={setCallScheduleTime}
        onSchedule={handleScheduleCall}
      />

      {/* Lead Form */}
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

      {/* Plan Modal */}
      <PlanModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
};