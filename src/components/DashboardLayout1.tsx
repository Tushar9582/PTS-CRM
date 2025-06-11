import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  BarChartBig,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Phone,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { NotificationDropdown } from '@/components/dashboard/NotificationDropdown';
import { MobileNavBar } from '@/components/mobile/MobileNavBar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { format } from 'date-fns';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface ScheduledEvent {
  id: string;
  title: string;
  type: 'meeting' | 'call' | 'task';
  startTime: string;
  endTime?: string;
  description?: string;
  path: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const agentName = localStorage.getItem('agentName');
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduledEvent[]>([]);
  const [activeNotification, setActiveNotification] = useState<ScheduledEvent | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  // User details
  const userName = user?.firstName || agentName || 'User';
  const userEmail = user?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();
  const userRole = user?.role === 'admin' ? 'Admin' : 'Agent';

  // Set localStorage items
  useEffect(() => {
    if (user) {
      localStorage.setItem('adminId', user.role === 'admin' ? user.uid : user.adminId || '');
      localStorage.setItem('currentRole', userRole);
      localStorage.setItem('agentId', user.uid);
    }
  }, [user, userRole]);

  // Mock function to simulate fetching events - replace with your actual data fetching
  useEffect(() => {
    const checkForEvents = () => {
      // This is mock data - replace with your actual data fetching logic
      const mockEvents: ScheduledEvent[] = [
        {
          id: '1',
          title: 'Meeting with Client',
          type: 'meeting',
          startTime: new Date(Date.now() + 10000).toISOString(), // 10 seconds from now
          description: 'Quarterly review meeting',
          path: '/meetings/1'
        },
        {
          id: '2',
          title: 'Call with Prospect',
          type: 'call',
          startTime: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
          description: 'Product demo call',
          path: '/leads/2'
        }
      ];

      const now = new Date();
      const filteredEvents = mockEvents.filter(event => {
        const eventTime = new Date(event.startTime).getTime();
        const timeDiff = (eventTime - now.getTime()) / (1000 * 60); // in minutes
        return timeDiff > 0 && timeDiff <= 5; // Within next 5 minutes
      });

      setUpcomingEvents(filteredEvents);
    };

    // Initial check
    checkForEvents();

    // Set up interval to check every minute
    const intervalId = setInterval(checkForEvents, 60000);

    // Cleanup
    return () => clearInterval(intervalId);
  }, []);

  // Show notifications when events are upcoming
  useEffect(() => {
    if (upcomingEvents.length > 0) {
      const nextEvent = upcomingEvents[0];
      setActiveNotification(nextEvent);
      setShowNotification(true);
      
      const eventTime = new Date(nextEvent.startTime).getTime();
      const now = new Date().getTime();
      const timeUntilEvent = eventTime - now;
      
      const timeoutId = setTimeout(() => {
        setShowNotification(false);
        setUpcomingEvents(prev => prev.filter(e => e.id !== nextEvent.id));
      }, Math.min(timeUntilEvent, 5 * 60 * 1000));
      
      return () => clearTimeout(timeoutId);
    }
  }, [upcomingEvents]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: FileText, label: 'Leads', path: '/leads' },
    ...(user?.role === 'admin' ? [
      { icon: Users, label: 'Agents', path: '/agents' },
      { icon: BarChartBig, label: 'Assign Leads', path: '/assignLeads' }
    ] : []),
    { icon: FileText, label: 'Tasks', path: '/tasks' },
    { icon: Calendar, label: 'Meetings', path: '/meetings' },
    { icon: BarChartBig, label: 'Deals', path: '/deals' },
    { icon: Settings, label: 'Settings', path: '/settings' }
  ];

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-5 w-5" />;
      case 'meeting': return <Calendar className="h-5 w-5" />;
      case 'task': return <CheckCircle className="h-5 w-5" />;
      default: return <Clock className="h-5 w-5" />;
    }
  };

  const handleNotificationAction = () => {
    if (activeNotification) {
      navigate(activeNotification.path);
      setShowNotification(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:block hidden`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                P
              </div>
              <h2 className="text-lg font-semibold dark:text-white">PTS - CRM</h2>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X size={20} />
            </button>
          </div>
          
          <Separator className="dark:bg-gray-700" />
          
          <div className="flex-1 py-4 overflow-y-auto">
            <nav className="px-2 space-y-1">
              {menuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2.5 rounded-lg transition-all ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
          
          <Separator className="dark:bg-gray-700" />
          
          <div className="p-4">
            <div className="flex items-center space-x-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.photoURL} alt={userName} />
                <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate dark:text-white">{userName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userEmail}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label="Log out"
              >
                <LogOut size={18} />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="mr-2 text-gray-500 dark:text-gray-400 lg:hidden"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-semibold lg:text-xl dark:text-white">
              {userName}'s Workspace
            </h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
            
            <NotificationDropdown />
            
            <div className="relative group">
              <Button
                variant="ghost"
                className="flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.photoURL} alt={userName} />
                  <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-sm font-medium dark:text-white">
                  {userName} ({user?.role?.toUpperCase()})
                </span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 md:pb-6 bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
        
        {/* Mobile Bottom Navigation */}
        {isMobile && <MobileNavBar />}
      </div>

      {/* Notification Dialog */}
      <Dialog open={showNotification} onOpenChange={setShowNotification}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              {activeNotification && getEventIcon(activeNotification.type)}
              <DialogTitle>
                {activeNotification?.title || 'Upcoming Event'}
              </DialogTitle>
            </div>
            <DialogDescription>
              {activeNotification?.description || 'You have an upcoming event'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 opacity-70" />
              <span className="text-sm">
                {activeNotification && format(new Date(activeNotification.startTime), 'MMMM d, yyyy h:mm a')}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotification(false)}>
              Dismiss
            </Button>
            <Button onClick={handleNotificationAction}>
              {activeNotification?.type === 'call' ? 'Start Call' : 
               activeNotification?.type === 'meeting' ? 'Join Meeting' : 'View Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardLayout;