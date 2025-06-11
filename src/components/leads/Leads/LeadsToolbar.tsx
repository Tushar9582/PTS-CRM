import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Download, Upload } from 'lucide-react';

interface LeadsToolbarProps {
  isAddingLead: boolean;
  setIsAddingLead: (value: boolean) => void;
  userRole: string | null;
  selectedStatus: string | null;
  setSelectedStatus: (value: string | null) => void;
  selectedSource: string | null;
  setSelectedSource: (value: string | null) => void;
  allStatuses: string[];
  allSources: string[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  showBackupLeads: boolean;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  resetFilters: () => void;
  applyFilters: () => void;
}

export const LeadsToolbar: React.FC<LeadsToolbarProps> = ({
  isAddingLead,
  setIsAddingLead,
  userRole,
  selectedStatus,
  setSelectedStatus,
  selectedSource,
  setSelectedSource,
  allStatuses,
  allSources,
  searchTerm,
  setSearchTerm,
  showBackupLeads,
  onExport,
  onImport,
  resetFilters,
  applyFilters,
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center mb-4">
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        {!showBackupLeads && (
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
                    }}
                  >
                    <SelectTrigger className="w-full neuro-inset focus:shadow-none">
                      <SelectValue placeholder="All sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sources</SelectItem>
                      {allSources.map(source => (
                        <SelectItem key={source} value={source}>{source}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              onClick={onExport}
              title="Export leads"
            >
              <Download className="h-4 w-4" />
            </Button>
            {!showBackupLeads && (
              <>
                <input 
                  type="file" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={onImport} 
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
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
    </div>
  );
};