import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Label } from '@radix-ui/react-label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ref, onValue, off, update } from 'firebase/database';
import { database } from '../firebase';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  email: string;
  status: string;
  from?: string;
  to?: string;
}

interface LeadRange {
  from: number;
  to: number;
}

export const AssignLeads = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leadRanges, setLeadRanges] = useState<Record<string, { from: string; to: string }>>({});
  const adminId = localStorage.getItem('adminkey');
  const [currentPage, setCurrentPage] = useState(1);
  const [agentsPerPage] = useState(5);
  const [leadStats, setLeadStats] = useState({
    totalLeads: 0,
    assignedLeads: 0,
    remainingLeads: 0,
    uniqueRangesCount: 0
  });

  // Helper function to parse lead range string to numbers
  const parseLeadRange = (from: string, to: string): LeadRange | null => {
    const fromNum = parseInt(from.replace(/\D/g, ''));
    const toNum = parseInt(to.replace(/\D/g, ''));
    return !isNaN(fromNum) && !isNaN(toNum) ? { from: fromNum, to: toNum } : null;
  };

  // Helper function to count unique assigned leads
  const countUniqueAssignedLeads = (agents: Agent[]): { total: number, uniqueRanges: number } => {
    const assignedRanges = new Set<string>();
    let total = 0;

    agents.forEach(agent => {
      if (agent.from && agent.to) {
        const range = parseLeadRange(agent.from, agent.to);
        if (range) {
          const rangeKey = `${range.from}-${range.to}`;
          if (!assignedRanges.has(rangeKey)) {
            assignedRanges.add(rangeKey);
            total += range.to - range.from + 1;
          }
        }
      }
    });

    return { total, uniqueRanges: assignedRanges.size };
  };

  // Fetch agents and calculate lead statistics
  useEffect(() => {
    if (!adminId) return;

    const agentsRef = ref(database, `users/${adminId}/agents`);
    const leadsRef = ref(database, `users/${adminId}/leads`);

    const fetchData = () => {
      // First get total leads count
      onValue(leadsRef, (leadsSnapshot) => {
        const totalLeads = leadsSnapshot.size || 0;
        
        // Then get agents and calculate assigned leads
        onValue(agentsRef, (agentsSnapshot) => {
          const agentsData: Agent[] = [];
          const ranges: Record<string, { from: string; to: string }> = {};

          agentsSnapshot.forEach((childSnapshot) => {
            const agent = childSnapshot.val();
            agentsData.push({
              id: childSnapshot.key || '',
              name: agent.name,
              email: agent.email,
              status: agent.status,
              from: agent.from || '',
              to: agent.to || ''
            });

            ranges[childSnapshot.key || ''] = {
              from: agent.from || '',
              to: agent.to || ''
            };
          });

          const { total: assignedLeads, uniqueRanges } = countUniqueAssignedLeads(agentsData);

          setLeadStats({
            totalLeads,
            assignedLeads,
            remainingLeads: Math.max(0, totalLeads - assignedLeads),
            uniqueRangesCount: uniqueRanges
          });

          setAgents(agentsData);
          setLeadRanges(ranges);
        });
      });
    };

    fetchData();

    return () => {
      off(agentsRef);
      off(leadsRef);
    };
  }, [adminId]);

  // Filter active agents
  const activeAgents = agents.filter(a => a.status === 'active');

  // Get current agents for pagination
  const indexOfLastAgent = currentPage * agentsPerPage;
  const indexOfFirstAgent = indexOfLastAgent - agentsPerPage;
  const currentAgents = activeAgents.slice(indexOfFirstAgent, indexOfLastAgent);
  const totalPages = Math.ceil(activeAgents.length / agentsPerPage);

  // Change page
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

  // Reset to first page when agents change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeAgents.length]);

  const handleRangeChange = (agentId: string, field: 'from' | 'to', value: string) => {
    setLeadRanges(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        [field]: value
      }
    }));
  };

  const assignLeads = async (agentId: string) => {
    try {
      if (!adminId) throw new Error('Admin ID missing');
      
      const agent = agents.find(a => a.id === agentId);
      if (!agent) throw new Error('Agent not found');
      
      const { from, to } = leadRanges[agentId] || { from: '', to: '' };
      
      if (!from || !to) {
        throw new Error('Both from and to values are required');
      }

      // Validate range
      const range = parseLeadRange(from, to);
      if (!range || range.from > range.to) {
        throw new Error('Invalid lead range');
      }

      // Update the agent in Firebase
      const agentRef = ref(database, `users/${adminId}/agents/${agentId}`);
      await update(agentRef, { from, to });

      // Recalculate lead statistics after update
      const updatedAgents = agents.map(a => 
        a.id === agentId ? { ...a, from, to } : a
      );
      const { total: assignedLeads, uniqueRanges } = countUniqueAssignedLeads(updatedAgents);

      setLeadStats(prev => ({
        totalLeads: prev.totalLeads,
        assignedLeads,
        remainingLeads: Math.max(0, prev.totalLeads - assignedLeads),
        uniqueRangesCount: uniqueRanges
      }));

      // Update local state
      setAgents(updatedAgents);

      toast.success(`Lead range ${from} to ${to} assigned to ${agent.name}`);
    } catch (error) {
      console.error('Error assigning leads:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to assign lead range');
    }
  };

  return (
    <div className="space-y-6">
      {/* Lead Assignment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-muted/50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Leads</h3>
          <p className="text-2xl font-bold">{leadStats.totalLeads}</p>
        </div>
        <div className="bg-muted/50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Assigned Leads</h3>
          <p className="text-2xl font-bold">{leadStats.assignedLeads}</p>
          <p className="text-xs text-muted-foreground">Unique count</p>
        </div>
        <div className="bg-muted/50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Remaining Leads</h3>
          <p className="text-2xl font-bold">{leadStats.remainingLeads}</p>
        </div>
        <div className="bg-muted/50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Unique Ranges</h3>
          <p className="text-2xl font-bold">{leadStats.uniqueRangesCount}</p>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <div className="overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Agent</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">From Lead</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">To Lead</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Current Range</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {currentAgents.map((agent) => (
                <tr key={agent.id} className="hover:bg-muted/20">
                  <td className="p-3">
                    <div className="flex items-center">
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">{agent.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <Input
                      type="text"
                      placeholder="Lead 001"
                      value={leadRanges[agent.id]?.from || ''}
                      onChange={(e) => handleRangeChange(agent.id, 'from', e.target.value)}
                      className="neuro-inset focus:shadow-none w-full"
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="text"
                      placeholder="Lead 100"
                      value={leadRanges[agent.id]?.to || ''}
                      onChange={(e) => handleRangeChange(agent.id, 'to', e.target.value)}
                      className="neuro-inset focus:shadow-none w-full"
                    />
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {agent.from && agent.to 
                      ? `${agent.from} - ${agent.to}`
                      : 'Not assigned'}
                  </td>
                  <td className="p-3">
                    <Button
                      onClick={() => assignLeads(agent.id)}
                      className="neuro hover:shadow-none transition-all duration-300"
                      disabled={!leadRanges[agent.id]?.from || !leadRanges[agent.id]?.to}
                    >
                      {agent.from ? 'Update' : 'Assign'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination for Desktop */}
        {activeAgents.length > 0 && (
          <div className="flex items-center justify-between px-2 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {indexOfFirstAgent + 1}-{Math.min(indexOfLastAgent, activeAgents.length)} of {activeAgents.length} agents
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prevPage}
                disabled={currentPage === 1}
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
                >
                  {number}
                </Button>
              ))}
              
              <Button
                variant="outline"
                size="sm"
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {currentAgents.map((agent) => (
          <div 
            key={agent.id} 
            className="rounded-xl p-4 bg-white dark:bg-gray-800 
                      shadow-[inset_5px_5px_10px_rgba(0,0,0,0.05),inset_-5px_-5px_10px_rgba(255,255,255,0.8)]
                      dark:shadow-[inset_5px_5px_10px_rgba(0,0,0,0.3),inset_-5px_-5px_10px_rgba(75,85,99,0.3)]"
          >
            <div className="flex items-center mb-4">
              <Avatar className="h-10 w-10 mr-3">
                <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-medium">{agent.name}</h3>
                <p className="text-sm text-muted-foreground">{agent.email}</p>
                {agent.from && agent.to && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Current: {agent.from} - {agent.to}
                  </p>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>From Lead</Label>
                <Input
                  type="text"
                  placeholder="Lead 001"
                  value={leadRanges[agent.id]?.from || ''}
                  onChange={(e) => handleRangeChange(agent.id, 'from', e.target.value)}
                  className="neuro-inset focus:shadow-none w-full"
                />
              </div>
              
              <div className="space-y-1">
                <Label>To Lead</Label>
                <Input
                  type="text"
                  placeholder="Lead 100"
                  value={leadRanges[agent.id]?.to || ''}
                  onChange={(e) => handleRangeChange(agent.id, 'to', e.target.value)}
                  className="neuro-inset focus:shadow-none w-full"
                />
              </div>
              
              <Button
                onClick={() => assignLeads(agent.id)}
                className="w-full neuro hover:shadow-none transition-all duration-300 mt-2"
                disabled={!leadRanges[agent.id]?.from || !leadRanges[agent.id]?.to}
              >
                {agent.from ? 'Update Range' : 'Assign Range'}
              </Button>
            </div>
          </div>
        ))}

        {/* Pagination for Mobile */}
        {activeAgents.length > 0 && (
          <div className="flex flex-col items-center gap-4 px-2 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {indexOfFirstAgent + 1}-{Math.min(indexOfLastAgent, activeAgents.length)} of {activeAgents.length} agents
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prevPage}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                  let pageNumber;
                  if (totalPages <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 2) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 1) {
                    pageNumber = totalPages - 2 + i;
                  } else {
                    pageNumber = currentPage - 1 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNumber}
                      variant={currentPage === pageNumber ? "default" : "outline"}
                      size="sm"
                      onClick={() => paginate(pageNumber)}
                      className="h-8 w-8 p-0"
                    >
                      {/* {number} */}
                    </Button>
                  );
                })}
                
                {totalPages > 3 && currentPage < totalPages - 1 && (
                  <span className="px-1">...</span>
                )}
                
                {totalPages > 3 && currentPage < totalPages - 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => paginate(totalPages)}
                    className="h-8 w-8 p-0"
                  >
                    {totalPages}
                  </Button>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};