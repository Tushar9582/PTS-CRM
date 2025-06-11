import React, { useState } from 'react';
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
  User,
  Bell
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { NotificationDropdown } from '@/components/dashboard/NotificationDropdown';
import { MobileNavBar } from '@/components/mobile/MobileNavBar';
import { useIsMobile } from '@/hooks/use-mobile';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // User details
  const userName = user?.firstName || 'User';
  const userEmail = user?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();
  const userRole = user?.role === 'admin' ? 'Admin' : 'agent';

  // Menu items configuration
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

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden"> {/* Changed min-h-screen to h-screen and added overflow-hidden */}
      {/* Sidebar - Desktop */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:block hidden`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                P
              </div>
              <h2 className="text-lg font-semibold">PTS - CRM</h2>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>
          
          <Separator />
          
          {/* Navigation Menu */}
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
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
          
          <Separator />
          
          {/* User Profile Section */}
          <div className="p-4">
            <div className="flex items-center space-x-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.photoURL} alt={userName} />
                <AvatarFallback className="bg-blue-100 text-blue-600">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName}</p>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">{userRole}</span>
                  <span className="text-xs text-gray-400">•</span>
                  <div className="group relative">
                    <span className="text-xs text-gray-500 truncate max-w-[100px] inline-block">
                      {userEmail.split('@')[0]}@...
                    </span>
                    <div className="absolute hidden group-hover:block bg-white p-2 rounded shadow-lg border border-gray-200 z-10 min-w-[200px]">
                      <p className="text-xs text-gray-700">{userEmail}</p>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Log out"
              >
                <LogOut size={18} />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden"> {/* Changed min-h-screen to h-screen and added overflow-hidden */}
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6 shrink-0"> {/* Added shrink-0 */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-gray-500 hover:text-gray-700"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </Button>
            <h1 className="ml-4 text-lg font-semibold lg:text-xl">
              {userName}'s Workspace
            </h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <NotificationDropdown />
            
            {/* User Profile Dropdown */}
            <div className="relative group">
              <Button
                variant="ghost"
                className="flex items-center space-x-2 hover:bg-gray-100"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.photoURL} alt={userName} />
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-sm font-medium">
                {user.firstName } ({ user.role.toLocaleUpperCase()})
                </span>
              </Button>
              
              <div className="absolute right-0 mt-2 w-56 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 hidden group-hover:block">
                <div className="py-1">
                  <div className="px-4 py-2">
                    <p className="text-sm font-medium">{userName}</p>
                    <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                  </div>
                  <Separator />
                  {/* <button
                    onClick={() => navigate('/settings')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Your Profile
                  </button> */}
                  <button
                    onClick={() => navigate('/settings')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Account Settings
                  </button>
                  <Separator />
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - Now scrollable */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 md:pb-6"> {/* Only this part scrolls */}
          {children}
        </main>
        
        {/* Mobile Bottom Navigation */}
        {isMobile && <MobileNavBar />}
      </div>
    </div>
  );
};

export default DashboardLayout;