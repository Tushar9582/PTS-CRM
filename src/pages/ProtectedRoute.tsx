// src/components/ProtectedRoute.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import PlanModal from '@/pages/PlanModal';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [trialEndTime, setTrialEndTime] = useState<number | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const checkTrialStatus = async () => {
      if (!user) return;
      
      try {
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          const userData = snapshot.val();
          const trialEnd = userData.trialEnd;
          
          if (trialEnd) {
            setTrialEndTime(trialEnd);
            
            // Check if trial has ended
            if (Date.now() >= trialEnd) {
              setShowPlanModal(true);
            }
          }
        }
      } catch (error) {
        console.error('Error checking trial status:', error);
      }
    };
    
    checkTrialStatus();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      {children}
      <PlanModal 
        isOpen={showPlanModal}
        onClose={handleSignOut}
        trialEndTime={trialEndTime || 0}
        isBlocking={true}
      />
    </>
  );
};