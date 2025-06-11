import { format, addDays, subDays } from 'date-fns';

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed';
  source: string;
  assignedTo?: string;
  createdAt: string;
}

export interface Agent {
  lastLoggedIn: ReactNode;
  id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  assignedLeads: number;
  status: 'active' | 'inactive';
  createdAt: string;
  avatar?: string;
  birthDate: string; // Added birthDate property to fix the error
}

export interface Task {
  name: string | number | readonly string[];
  id: string;
  title: string;
  description: string;
  agentId: string;
  agentName: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low'; // Added priority property
}

export interface Meeting {
  id: string;
  title: string;
  startDate: string;
  startTime: string;
  duration: number;
  participants: string[];
  reminder: '5min' | '10min' | '15min';
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
}

export interface Deal {
  id: string;
  name: string;
  leadId: string;
  agentId: string;
  amount: number;
  status: 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  createdAt: string;
  closingDate: string;
  company: string; // Added company property
  description?: string; // Added description property
}

export const statusCounts = {
  leads: {
    new: 25,
    contacted: 18,
    qualified: 12,
    proposal: 8,
    negotiation: 5,
    closed: 10
  }
};

export const generateLeads = (count: number): Lead[] => {
  const statuses: Lead['status'][] = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed'];
  const sources = ['Website', 'Referral', 'Social Media', 'Email Campaign', 'Cold Call'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `lead-${i + 1}`,
    name: `Lead ${i + 1}`,
    company: `Company ${i + 1}`,
    email: `lead${i + 1}@example.com`,
    phone: `+1234567890${i}`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    source: sources[Math.floor(Math.random() * sources.length)],
    assignedTo: Math.random() > 0.3 ? `agent-${Math.floor(Math.random() * 5) + 1}` : undefined,
    createdAt: format(subDays(new Date(), Math.floor(Math.random() * 30)), 'yyyy-MM-dd')
  }));
};

export const generateAgents = (count: number): Agent[] => {
  // const roles: Agent['role'][] = ['senior', 'junior'];
  const statuses: Agent['status'][] = ['active', 'inactive'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `agent-${i + 1}`,
    name: `Agent ${i + 1}`,
    email: `agent${i + 1}@pulsecrm.com`,
    phone: `+1987654321${i}`,
    designation: `software developer`,
    assignedLeads: Math.floor(Math.random() * 15),
    status: statuses[Math.floor(Math.random() * statuses.length)],
    createdAt: format(subDays(new Date(), Math.floor(Math.random() * 60)), 'yyyy-MM-dd'),
    birthDate: format(subDays(new Date(), Math.floor(Math.random() * 365 * 30)), 'yyyy-MM-dd'), // Added default birthDate
  }));
};

export const generateTasks = (count: number): Task[] => {
  const statuses: Task['status'][] = ['pending', 'in_progress', 'completed'];
  const priorities: Task['priority'][] = ['high', 'medium', 'low']; // Added priorities
  
  return Array.from({ length: count }, (_, i) => {
    const startDate = format(addDays(new Date(), Math.floor(Math.random() * 10) - 5), 'yyyy-MM-dd');
    
    return {
      id: `task-${i + 1}`,
      title: `Task ${i + 1}`,
      description: `This is a description for task ${i + 1}`,
      agentId: `agent-${Math.floor(Math.random() * 5) + 1}`,
      agentName: `Agent ${Math.floor(Math.random() * 5) + 1}`,
      startDate,
      endDate: format(addDays(new Date(startDate), Math.floor(Math.random() * 5) + 1), 'yyyy-MM-dd'),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)], // Added priority
    };
  });
};

export const generateMeetings = (count: number): Meeting[] => {
  const statuses: Meeting['status'][] = ['scheduled', 'ongoing', 'completed', 'cancelled'];
  const reminders: Meeting['reminder'][] = ['5min', '10min', '15min'];
  
  return Array.from({ length: count }, (_, i) => {
    const startDate = format(addDays(new Date(), Math.floor(Math.random() * 14) - 7), 'yyyy-MM-dd');
    
    return {
      id: `meeting-${i + 1}`,
      title: `Meeting ${i + 1}`,
      startDate,
      startTime: `${Math.floor(Math.random() * 12) + 8}:${Math.random() > 0.5 ? '00' : '30'}`,
      duration: (Math.floor(Math.random() * 4) + 1) * 30, // 30, 60, 90, or 120 minutes
      participants: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, j) => `agent-${j + 1}`),
      reminder: reminders[Math.floor(Math.random() * reminders.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
    };
  });
};

export const generateDeals = (count: number): Deal[] => {
  const statuses: Deal['status'][] = ['proposal', 'negotiation', 'closed_won', 'closed_lost'];
  
  return Array.from({ length: count }, (_, i) => {
    const createdAt = format(subDays(new Date(), Math.floor(Math.random() * 30)), 'yyyy-MM-dd');
    
    return {
      id: `deal-${i + 1}`,
      name: `Deal ${i + 1}`,
      leadId: `lead-${Math.floor(Math.random() * 20) + 1}`,
      agentId: `agent-${Math.floor(Math.random() * 5) + 1}`,
      amount: Math.floor(Math.random() * 10000) + 1000,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      createdAt,
      closingDate: format(addDays(new Date(createdAt), Math.floor(Math.random() * 30) + 15), 'yyyy-MM-dd'),
      company: `Company ${Math.floor(Math.random() * 20) + 1}`, // Added company
      description: Math.random() > 0.3 ? `Description for deal ${i + 1}` : undefined, // Added description
    };
  });
};

export const mockLeads = generateLeads(20);
export const mockAgents = generateAgents(5).map((agent, index) => ({
  ...agent,
  avatar: index % 2 === 0 ? `/images/avatar-${index + 1}.png` : undefined // Added avatar urls
}));
export const mockTasks = generateTasks(10);
export const mockMeetings = generateMeetings(8);
export const mockDeals = generateDeals(12);

export const dashboardStats = {
  totalLeads: mockLeads.length,
  totalAgents: mockAgents.filter(a => a.status === 'active').length,
  todaysCalls: Math.floor(Math.random() * 10) + 5,
  upcomingCalls: Math.floor(Math.random() * 15) + 10,
  todaysMeetings: mockMeetings.filter(m => m.startDate === format(new Date(), 'yyyy-MM-dd')).length,
  upcomingMeetings: mockMeetings.filter(m => new Date(m.startDate) > new Date()).length,
};

export const chartData = {
  leads: {
    monthly: [
      { month: 'Jan', count: 32 },
      { month: 'Feb', count: 28 },
      { month: 'Mar', count: 35 },
      { month: 'Apr', count: 40 },
      { month: 'May', count: 38 },
      { month: 'Jun', count: 45 },
    ],
    yearly: [
      { month: 'Jan', count: 32 },
      { month: 'Feb', count: 28 },
      { month: 'Mar', count: 35 },
      { month: 'Apr', count: 40 },
      { month: 'May', count: 38 },
      { month: 'Jun', count: 45 },
      { month: 'Jul', count: 47 },
      { month: 'Aug', count: 50 },
      { month: 'Sep', count: 48 },
      { month: 'Oct', count: 52 },
      { month: 'Nov', count: 55 },
      { month: 'Dec', count: 60 },
    ],
  },
  deals: {
    monthly: [
      { month: 'Jan', count: 10 },
      { month: 'Feb', count: 15 },
      { month: 'Mar', count: 12 },
      { month: 'Apr', count: 18 },
      { month: 'May', count: 20 },
      { month: 'Jun', count: 22 },
    ],
    yearly: [
      { month: 'Jan', count: 10 },
      { month: 'Feb', count: 15 },
      { month: 'Mar', count: 12 },
      { month: 'Apr', count: 18 },
      { month: 'May', count: 20 },
      { month: 'Jun', count: 22 },
      { month: 'Jul', count: 25 },
      { month: 'Aug', count: 28 },
      { month: 'Sep', count: 24 },
      { month: 'Oct', count: 30 },
      { month: 'Nov', count: 32 },
      { month: 'Dec', count: 35 },
    ],
  },
  meetings: {
    monthly: [
      { month: 'Jan', count: 5 },
      { month: 'Feb', count: 8 },
      { month: 'Mar', count: 7 },
      { month: 'Apr', count: 10 },
      { month: 'May', count: 12 },
      { month: 'Jun', count: 15 },
    ],
    yearly: [
      { month: 'Jan', count: 5 },
      { month: 'Feb', count: 8 },
      { month: 'Mar', count: 7 },
      { month: 'Apr', count: 10 },
      { month: 'May', count: 12 },
      { month: 'Jun', count: 15 },
      { month: 'Jul', count: 16 },
      { month: 'Aug', count: 18 },
      { month: 'Sep', count: 14 },
      { month: 'Oct', count: 20 },
      { month: 'Nov', count: 22 },
      { month: 'Dec', count: 25 },
    ],
  }
};
