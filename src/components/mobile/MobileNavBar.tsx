
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, Calendar, ListTodo, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const MobileNavBar: React.FC = () => {
  const { isAdmin } = useAuth();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border h-16 flex items-center justify-around z-50 md:hidden w-full">
      <NavLink 
        to="/dashboard" 
        className={({ isActive }) => `flex flex-col items-center justify-center w-1/5 h-full ${
          isActive ? 'text-pulse' : 'text-muted-foreground'
        }`}
      >
        <LayoutDashboard size={20} />
        <span className="text-xs mt-1">Home</span>
      </NavLink>
      
      <NavLink 
        to="/leads" 
        className={({ isActive }) => `flex flex-col items-center justify-center w-1/5 h-full ${
          isActive ? 'text-pulse' : 'text-muted-foreground'
        }`}
      >
        <FileText size={20} />
        <span className="text-xs mt-1">Leads</span>
      </NavLink>
      
      {isAdmin && (
        <NavLink 
          to="/agents" 
          className={({ isActive }) => `flex flex-col items-center justify-center w-1/5 h-full ${
            isActive ? 'text-pulse' : 'text-muted-foreground'
          }`}
        >
          <Users size={20} />
          <span className="text-xs mt-1">Agents</span>
        </NavLink>
      )}
      
      <NavLink 
        to="/tasks" 
        className={({ isActive }) => `flex flex-col items-center justify-center w-1/5 h-full ${
          isActive ? 'text-pulse' : 'text-muted-foreground'
        }`}
      >
        <ListTodo size={20} />
        <span className="text-xs mt-1">Tasks</span>
      </NavLink>
      
      <NavLink 
        to="/meetings" 
        className={({ isActive }) => `flex flex-col items-center justify-center w-1/5 h-full ${
          isActive ? 'text-pulse' : 'text-muted-foreground'
        }`}
      >
        <Calendar size={20} />
        <span className="text-xs mt-1">Meetings</span>
      </NavLink>

      <NavLink 
        to="/deals" 
        className={({ isActive }) => `flex flex-col items-center justify-center w-1/5 h-full ${
          isActive ? 'text-pulse' : 'text-muted-foreground'
        }`}
      >
        <Calendar size={20} />
        <span className="text-xs mt-1">Deals</span>
      </NavLink>
      
      <NavLink 
        to="/settings" 
        className={({ isActive }) => `flex flex-col items-center justify-center w-1/5 h-full ${
          isActive ? 'text-pulse' : 'text-muted-foreground'
        }`}
      >
        <Settings size={20} />
        <span className="text-xs mt-1">Settings</span>
      </NavLink>
    </div>
  );
};
