import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Upload, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { get, ref, set } from 'firebase/database';
import { database } from '../../firebase';
import { read, utils } from 'xlsx';
import PlanModal from '../../pages/PlanModel';

interface FileManagerProps {
  isOpen: boolean;
  onClose: (importedCount?: number) => void;
  mode: 'import' | 'export';
  fileType?: 'all' | 'image' | 'document' | 'excel';
}

interface FileItem {
  name: string;
  type: string;
  size: string;
  data?: any[];
  previewData?: any[];
  availableData?: any[]; // New field for leads that can be imported
}

export const FileManager: React.FC<FileManagerProps> = ({ isOpen, onClose, mode, fileType = 'all' }) => {
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [currentLeadCount, setCurrentLeadCount] = useState<number>(0);
  const [leadLimit, setLeadLimit] = useState<number>(0);
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage] = useState<number>(5);

  const importToFirebase = async () => {
    if (!selectedFile?.availableData?.length) {
      toast.error('No available data to import');
      return;
    }

    const adminId = localStorage.getItem('adminkey');
    if (!adminId) {
      toast.error('Authentication required');
      return;
    }

    setIsImporting(true);
    try {
      const leadsRef = ref(database, `users/${adminId}/leads`);
      const snapshot = await get(leadsRef);
      const existingLeads = snapshot.exists() ? snapshot.val() : {};
      
      // Prepare only the available leads
      const newLeads: { [key: string]: any } = {};
      selectedFile.availableData.forEach((lead, index) => {
        const leadId = `lead_${Date.now()}_${index}`;
        newLeads[leadId] = {
          ...lead,
          importedAt: new Date().toISOString(),
          status: 'new'
        };
      });

      await set(leadsRef, {
        ...existingLeads,
        ...newLeads
      });

      const importedCount = selectedFile.availableData.length;
      toast.success(`Successfully imported ${importedCount} leads (${selectedFile.data?.length || 0 - importedCount} skipped due to limit)`);
      onClose(importedCount);
    } catch (error) {
      console.error('Error importing leads:', error);
      toast.error('Failed to import leads');
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = () => {
    if (!selectedFile) {
      toast.error('No file selected');
      return;
    }

    // Final check (should always pass since we pre-filter)
    if (leadLimit > 0 && (currentLeadCount + (selectedFile.availableData?.length || 0)) > leadLimit) {
      setShowPlanModal(true);
      return;
    }

    importToFirebase();
  };

  useEffect(() => {
    if (isOpen && mode === 'import' && fileType === 'excel') {
      checkLeadLimits();
    }
  }, [isOpen, mode, fileType]);

  const checkLeadLimits = async () => {
    try {
      const adminId = localStorage.getItem('adminkey');
      if (!adminId) {
        toast.error('Authentication required');
        onClose();
        return;
      }

      const userRef = ref(database, `users/${adminId}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        setLeadLimit(userData.leadLimit || 0);
        
        const leadsRef = ref(database, `users/${adminId}/leads`);
        const leadsSnapshot = await get(leadsRef);
        setCurrentLeadCount(leadsSnapshot.exists() ? Object.keys(leadsSnapshot.val()).length : 0);
      }
    } catch (error) {
      console.error('Error checking lead limits:', error);
      toast.error('Failed to check lead limits');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      toast.error('Please upload a valid Excel file');
      return;
    }

    setIsLoading(true);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(firstSheet);

      // Calculate available leads based on limit
      const availableSlots = Math.max(0, leadLimit - currentLeadCount);
      const availableData = leadLimit > 0 ? jsonData.slice(0, availableSlots) : jsonData;
      const unavailableCount = leadLimit > 0 ? Math.max(0, jsonData.length - availableSlots) : 0;

      setSelectedFile({
        name: file.name,
        type: 'excel',
        size: `${(file.size / 1024).toFixed(2)} KB`,
        data: jsonData,
        availableData: availableData,
        previewData: jsonData.slice(0, 50) // Show first 50 rows for preview
      });

      setCurrentPage(1);

      if (unavailableCount > 0) {
        toast.warning(`${unavailableCount} leads will be skipped due to limit (${availableSlots} available slots)`);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('Failed to read Excel file');
    } finally {
      setIsLoading(false);
    }
  };

  // Pagination logic - now shows all data in preview but will only import availableData
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = selectedFile?.previewData?.slice(indexOfFirstRow, indexOfLastRow) || [];
  const totalPages = selectedFile?.previewData ? Math.ceil(selectedFile.previewData.length / rowsPerPage) : 0;

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const renderExcelPreview = () => {
    if (!selectedFile?.previewData?.length) {
      return (
        <div className="mt-4 p-4 text-center text-muted-foreground">
          No data available for preview
        </div>
      );
    }

    const columns = currentRows.length > 0 ? Object.keys(currentRows[0]) : [];
    const availableSlots = Math.max(0, leadLimit - currentLeadCount);
    const willImportCount = selectedFile.availableData?.length || 0;
    const willSkipCount = (selectedFile.data?.length || 0) - willImportCount;

    return (
      <div className="mt-4 neuro-inset p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
          <h4 className="text-sm font-medium">
            Preview (rows {indexOfFirstRow + 1}-{Math.min(indexOfLastRow, selectedFile.previewData.length)} 
            of {selectedFile.previewData.length})
          </h4>
          <div className="text-xs text-muted-foreground">
            <span className="text-green-500">Will import: {willImportCount}</span>
            {willSkipCount > 0 && (
              <span className="text-red-500 ml-2">Will skip: {willSkipCount}</span>
            )}
            <span className="block sm:inline sm:ml-2">Available slots: {availableSlots}</span>
          </div>
        </div>

        <div className="w-[1000px] overflow-x-auto border border-muted/20 rounded-md">
          <table className="min-w-full divide-y divide-muted/20">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((key) => (
                  <th 
                    key={key}
                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase whitespace-nowrap"
                  >
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/20">
              {currentRows.map((row, i) => {
                const isAvailable = selectedFile.availableData?.includes(row) ?? true;
                return (
                  <tr 
                    key={i} 
                    className={i % 2 === 0 ? 'bg-muted/5' : 'bg-background'}
                    style={!isAvailable ? { opacity: 0.6, backgroundColor: 'rgba(255, 0, 0, 0.05)' } : {}}
                  >
                    {columns.map((col) => (
                      <td
                        key={`${i}-${col}`}
                        className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap"
                      >
                        {String(row[col] || '-')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => paginate(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={() => onClose()}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[90vw] lg:max-w-[80vw] xl:max-w-[70vw] neuro border-none">
          {mode === 'import' && fileType === 'excel' && (
            <div className="text-xs text-muted-foreground mb-2 text-center">
              Current leads: {currentLeadCount}/{leadLimit} | 
              Available: {Math.max(0, leadLimit - currentLeadCount)}
              {leadLimit > 0 && currentLeadCount >= leadLimit && (
                <span className="text-red-500 font-medium"> (Limit Reached)</span>
              )}
            </div>
          )}
          
          <DialogHeader>
            <DialogTitle className="text-center sm:text-left">
              {mode === 'import' ? 'Import Excel File' : 'Export Data'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {mode === 'import' && !selectedFile && (
              <div className="neuro-inset p-6 flex flex-col items-center justify-center">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".xlsx,.xls,.csv"
                />
                <label 
                  htmlFor="file-upload" 
                  className="cursor-pointer w-full flex flex-col items-center space-y-2"
                >
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload Excel file</p>
                  <p className="text-xs text-muted-foreground">
                    Supports .xlsx, .xls, .csv files
                  </p>
                </label>
                {isLoading && (
                  <div className="w-full mt-4">
                    <div className="h-2 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-pulse" style={{ width: '100%' }}></div>
                    </div>
                    <p className="text-xs text-center mt-1">Processing file...</p>
                  </div>
                )}
              </div>
            )}

            {selectedFile && (
              <div className="space-y-4">
                <div className="p-3 rounded flex flex-col sm:flex-row items-center justify-between gap-2 bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
                    <div>
                      <p className="text-sm font-medium line-clamp-1">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedFile.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 bg-pulse rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {selectedFile.availableData?.length || 0} of {selectedFile.data?.length || 0} records will import
                    </span>
                  </div>
                </div>
                
                {fileType === 'excel' && renderExcelPreview()}
              </div>
            )}
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setSelectedFile(null);
                onClose();
              }}
              className="w-full sm:w-auto"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            {selectedFile && (
              <Button 
                onClick={handleConfirmImport}
                disabled={
                  !selectedFile || 
                  !selectedFile.availableData?.length ||
                  isImporting
                }
                className="w-full sm:w-auto"
              >
                {isImporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {selectedFile.availableData?.length || 0} Records
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlanModal 
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        currentCount={currentLeadCount}
        limit={leadLimit}
        requiredCount={selectedFile?.data?.length || 0}
      />
    </>
  );
};