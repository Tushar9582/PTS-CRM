import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDatabase, ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useAuth } from '@/context/AuthContext';
import { format, subMonths, parseISO, startOfYear, eachMonthOfInterval, addMonths } from 'date-fns';
import { Button } from '@/components/ui/button';

interface ChartSelectorProps {
  className?: string;
  leadsCount: number;
  callsCount: number;
  meetingsCount: number;
}

interface ChartData {
  month: string;
  count: number;
}

interface StatusData {
  status: string;
  count: number;
}

interface LeadData {
  id: string;
  createdAt: string;
  status: string;
}

export const ChartSelector: React.FC<ChartSelectorProps> = ({ 
  className, 
  leadsCount,
  callsCount,
  meetingsCount 
}) => {
  const { isAdmin, user } = useAuth();
  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey') || user?.uid;
  const userId = isAdmin ? adminId : agentId;

  const [chartType, setChartType] = useState('bar');
  const [dataType, setDataType] = useState('leads');
  const [timeRange, setTimeRange] = useState('monthly');
  const [chartData, setChartData] = useState<Record<string, ChartData[]>>({
    leads: [],
    meetings: [],
    calls: []
  });
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [showStatusChart, setShowStatusChart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentAgentRange, setCurrentAgentRange] = useState<{from: number, to: number} | null>(null);

  const COLORS = ['#9b87f5', '#1EAEDB', '#7E69AB', '#33C3F0', '#F97316'];
  const STATUS_COLORS: Record<string, string> = {
    new: '#9b87f5',
    contacted: '#1EAEDB',
    qualified: '#33C3F0',
    proposal: '#7E69AB',
    negotiation: '#F97316',
    closed: '#10B981'
  };

  useEffect(() => {
    if (!adminId) return;

    const fetchData = () => {
      setLoading(true);

      // Fetch leads data
      const leadsRef = ref(database, `users/${adminId}/leads`);
      onValue(leadsRef, (snapshot) => {
        const leadsData = snapshot.val();
        const allLeads: LeadData[] = [];
        
        if (leadsData) {
          Object.keys(leadsData).forEach((leadId) => {
            allLeads.push({
              id: leadId,
              createdAt: leadsData[leadId].createdAt,
              status: leadsData[leadId].status || 'unknown'
            });
          });
        }

        // Sort by creation date
        allLeads.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        if (isAdmin) {
          // Admin sees all leads
          const leadsByMonth = groupDataByMonth(allLeads, 'createdAt');
          setChartData(prev => ({
            ...prev,
            leads: leadsByMonth
          }));
          calculateStatusData(allLeads);
        } else {
          // Agent sees sliced leads
          if (!agentId) return;

          const agentRef = ref(database, `users/${adminId}/agents/${agentId}`);
          onValue(agentRef, (agentSnapshot) => {
            const agentData = agentSnapshot.val();
            
            // Get the position range (1-based index)
            const fromPosition = parseInt(agentData?.from || 'nan');
            const toPosition = parseInt(agentData?.to || '0');
            
            // Validate range
            const safeFrom = Math.max(1, fromPosition);
            const safeTo = Math.min(allLeads.length, toPosition);
            
            setCurrentAgentRange({ from: safeFrom, to: safeTo });

            // Slice the array (using 0-based index)
            const slicedLeads = allLeads.slice(safeFrom - 1, safeTo);
            
            const leadsByMonth = groupDataByMonth(slicedLeads, 'createdAt');
            setChartData(prev => ({
              ...prev,
              leads: leadsByMonth
            }));
            calculateStatusData(slicedLeads);
          });
        }
      });

      // Fetch meetings data
      let meetingsRef;
      if (isAdmin) {
        meetingsRef = ref(database, `users/${adminId}/meetingdetails`);
      } else {
        meetingsRef = ref(database, `users/${adminId}/agents/${agentId}/meetingdetails`);
      }

      onValue(meetingsRef, (snapshot) => {
        const meetingsData = snapshot.val();
        const meetingsByMonth = groupDataByMonth(meetingsData, 'startDate');
        setChartData(prev => ({
          ...prev,
          meetings: meetingsByMonth
        }));
      });

      // Fetch calls data
      const callsRef = ref(database, `users/${userId}/leads`);
      onValue(callsRef, (snapshot) => {
        const leadsData = snapshot.val();
        let allCalls: any[] = [];

        if (leadsData) {
          Object.keys(leadsData).forEach((leadId) => {
            const callsForLeadRef = ref(database, `users/${userId}/leads/${leadId}/calls`);
            onValue(callsForLeadRef, (callsSnapshot) => {
              const callsData = callsSnapshot.val();
              if (callsData) {
                Object.keys(callsData).forEach(callId => {
                  allCalls.push(callsData[callId]);
                });
              }
            });
          });
        }

        const callsByMonth = groupDataByMonth(allCalls, 'dateTime');
        setChartData(prev => ({
          ...prev,
          calls: callsByMonth
        }));
        setLoading(false);
      });
    };

    fetchData();
  }, [userId, isAdmin, adminId, agentId]);

  const calculateStatusData = (leads: LeadData[]) => {
    const statusCounts: Record<string, number> = {};
    leads.forEach(lead => {
      statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
    });

    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count
    }));

    setStatusData(statusData);
  };

  const groupDataByMonth = (data: any, dateField: string): ChartData[] => {
    if (!data || (Array.isArray(data) && data.length === 0)) return [];

    const now = new Date();
    const nextMonth = addMonths(now, 1);
    const startDate = subMonths(now, 5); // Show last 6 months + next month
    const endDate = nextMonth;
    
    const allMonths = eachMonthOfInterval({
      start: startDate,
      end: endDate
    }).map(date => format(date, 'MMM yyyy'));

    const items = Array.isArray(data) ? 
      data : 
      Object.keys(data).map(key => ({ ...data[key], id: key }));

    const countsByMonth: Record<string, number> = allMonths.reduce((acc, month) => {
      acc[month] = 0;
      return acc;
    }, {} as Record<string, number>);

    items.forEach(item => {
      if (!item[dateField]) return;
      
      try {
        const date = parseISO(item[dateField]);
        const month = format(date, 'MMM yyyy');
        
        if (allMonths.includes(month)) {
          countsByMonth[month]++;
        }
      } catch (error) {
        console.error(`Error parsing date for ${dateField}:`, item[dateField], error);
      }
    });

    return allMonths.map(month => ({
      month,
      count: countsByMonth[month]
    }));
  };

  const getChartData = () => {
    const data = chartData[dataType as keyof typeof chartData];
    return timeRange === 'yearly' ? 
      getFullYearData(data) : 
      data; // Already filtered to show last 6 months + next month
  };

  const getFullYearData = (monthlyData: ChartData[]): ChartData[] => {
    // Get current year
    const currentYear = new Date().getFullYear();
    const allMonths = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(currentYear, i, 1);
      return format(date, 'MMM yyyy');
    });

    // Create a map of existing data for quick lookup
    const dataMap = monthlyData.reduce((acc, item) => {
      acc[item.month] = item.count;
      return acc;
    }, {} as Record<string, number>);

    // Return data for all 12 months, filling in zeros for missing months
    return allMonths.map(month => ({
      month,
      count: dataMap[month] || 0
    }));
  };

  const renderBarChart = () => {
    if (dataType === 'leads' && showStatusChart) {
      // Status-wise bar chart for leads
      return (
        <BarChart data={statusData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="status" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar 
            dataKey="count"
            name="Leads by Status"
            fill="#9b87f5"
            radius={[4, 4, 0, 0]}
          >
            {statusData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={STATUS_COLORS[entry.status] || '#8884d8'} 
              />
            ))}
          </Bar>
        </BarChart>
      );
    } else {
      // Time-based bar chart for all data types
      return (
        <BarChart data={getChartData()}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" fill="#9b87f5" radius={[4, 4, 0, 0]} />
        </BarChart>
      );
    }
  };

  if (loading) {
    return (
      <div className={`neuro p-6 ${className} flex items-center justify-center`}>
        <div className="animate-pulse text-muted-foreground">Loading chart data...</div>
      </div>
    );
  }

  return (
    <div className={`neuro p-6 ${className}`}>
      {/* Agent range information */}
      {!isAdmin && currentAgentRange && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Showing leads {currentAgentRange.from} to {currentAgentRange.to} in your assigned range
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <h2 className="text-lg font-semibold">Analytics Overview</h2>
        <div className="flex flex-wrap gap-2">
          <Select
            defaultValue="leads"
            onValueChange={(value) => {
              setDataType(value);
              if (value !== 'leads') setShowStatusChart(false);
            }}
          >
            <SelectTrigger className="w-[120px] neuro-inset focus:shadow-none text-sm">
              <SelectValue placeholder="Data Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="leads">Leads ({leadsCount})</SelectItem>
              <SelectItem value="meetings">Meetings ({meetingsCount})</SelectItem>
              <SelectItem value="calls">Calls ({callsCount})</SelectItem>
            </SelectContent>
          </Select>

          <Select
            defaultValue="monthly"
            onValueChange={(value) => setTimeRange(value)}
          >
            <SelectTrigger className="w-[120px] neuro-inset focus:shadow-none text-sm">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">7 Months</SelectItem>
              <SelectItem value="yearly">12 Months</SelectItem>
            </SelectContent>
          </Select>

          {dataType === 'leads' && (
            <Button
              variant="outline"
              className="text-sm h-9"
              onClick={() => setShowStatusChart(!showStatusChart)}
            >
              {showStatusChart ? 'Show Timeline' : 'Show by Status'}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="bar" onValueChange={(value) => setChartType(value)}>
        <TabsList className="mb-6">
          <TabsTrigger value="bar">Bar Chart</TabsTrigger>
          <TabsTrigger value="line">Line Chart</TabsTrigger>
          <TabsTrigger value="pie">Pie Chart</TabsTrigger>
        </TabsList>

        <TabsContent value="bar" className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderBarChart()}
          </ResponsiveContainer>
        </TabsContent>

        <TabsContent value="line" className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={getChartData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#9b87f5"
                activeDot={{ r: 8 }}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </TabsContent>

        <TabsContent value="pie" className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dataType === 'leads' ? statusData : getChartData()}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                nameKey={dataType === 'leads' ? 'status' : 'month'}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {(dataType === 'leads' ? statusData : getChartData()).map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={dataType === 'leads' ? 
                      (STATUS_COLORS[entry.status] || '#8884d8') : 
                      COLORS[index % COLORS.length]} 
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </TabsContent>
      </Tabs>
    </div>
  );
};