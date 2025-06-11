import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthLayout } from "@/components/AuthLayout";
import { AIAssistant } from "@/components/common/AIAssistant";
import { useEffect, useState } from "react";
import ProtectedRoute from './components/ProtectedRoute';


// Pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Agents from "./pages/Agents";
import Tasks from "./pages/Tasks";
import Meetings from "./pages/Meetings";
import Deals from "./pages/Deals";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import SignupForm from "./components/SignupForm";
import { AssignLeads } from "./components/AssignLeads";
import AssignedLeadsPage from "./pages/AssignedLeadsPage";
import ForgotPassword from "./components/ForgetPassword";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignupForm />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      
      {/* Protected routes */}
      <Route path="/dashboard" element={
        <AuthLayout>
          <Dashboard />
        </AuthLayout>
      } />
        <Route path="/leads" element={
        <AuthLayout>
          <Leads />
        </AuthLayout>
      } />

      <Route path="/assignLeads" element={
        <AuthLayout>
          <AssignedLeadsPage />
        </AuthLayout>
      } />
      
      <Route path="/agents" element={
        <AuthLayout>
          <Agents />
        </AuthLayout>
      } />
      
      <Route path="/tasks" element={
        <AuthLayout>
          <Tasks />
        </AuthLayout>
      } />
      
      <Route path="/meetings" element={
        <AuthLayout>
          <Meetings />
        </AuthLayout>
      } />
      
      <Route path="/deals" element={
        <AuthLayout>
          <Deals />
        </AuthLayout>
      } />
      
      <Route path="/settings" element={
        <AuthLayout>
          <Settings />
        </AuthLayout>
      } />
      
      <Route path="*" element={<NotFound />} />
      
      {/* Other protected routes remain the same */}
    </Routes>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <AuthWrapper>
                <AppRoutes />
              </AuthWrapper>
              {/* AI Assistant - only show when authenticated */}
              <AIAssistant />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;