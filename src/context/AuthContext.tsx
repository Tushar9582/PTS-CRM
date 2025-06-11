import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  User as FirebaseUser, 
  UserCredential,
  sendEmailVerification,
  applyActionCode,
  checkActionCode,
  verifyBeforeUpdateEmail
} from 'firebase/auth';
import { getDatabase, ref, set, get, update } from 'firebase/database';

type UserRole = 'admin' | 'agent' | null;

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  parentAdminId?: string;
  name: string;
  emailVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: UserRole) => Promise<UserCredential>;
  signup: (firstName: string, lastName: string, email: string, password: string, role: UserRole, leadLimit: string, agentLimit: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isAgent: boolean;
  sendVerificationEmail: (email: string) => Promise<void>;
  checkEmailVerification: (email: string) => Promise<boolean>;
  verifyEmail: (oobCode: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const firebaseConfig = {
  apiKey: "AIzaSyDNLOemKph8QXlzj8br6IAXL6tzTGxXMg8",
  authDomain: "pts-lms-e82cf.firebaseapp.com",
  databaseURL: "https://pts-lms-e82cf-default-rtdb.firebaseio.com",
  projectId: "pts-lms-e82cf",
  storageBucket: "pts-lms-e82cf.firebasestorage.app",
  messagingSenderId: "392587751138",
  appId: "1:392587751138:web:0c8efa50032c998a6238bb",
  measurementId: "G-HH35ZQX74J"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey') || user?.uid;
  const role = localStorage.getItem('userRole');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        await handleUserAuth(firebaseUser);
      } else {
        clearAuthState();
      }
    });
    return unsubscribe;
  }, []);

  const handleUserAuth = async (firebaseUser: FirebaseUser) => {
    const agentCheck = await checkIfAgentExists(firebaseUser.email || '');
    if (agentCheck) {
      setAgentAuthState(firebaseUser, agentCheck);
      return;
    }

    const userRef = ref(database, `users/${firebaseUser.uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      const userData = snapshot.val();
      setUser({
        id: firebaseUser.uid,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: firebaseUser.email || '',
        role: userData.role,
        emailVerified: firebaseUser.emailVerified,
        name: ''
      });
      
      localStorage.setItem('userRole', userData.role || '');
      if (userData.role === 'admin') {
        localStorage.setItem('adminkey', firebaseUser.uid);
      }
    }
  };

  const setAgentAuthState = (firebaseUser: FirebaseUser, agentData: {firstName: string, lastName: string, parentAdminId: string}) => {
    setUser({
      id: firebaseUser.uid,
      firstName: agentData.firstName,
      lastName: agentData.lastName,
      email: firebaseUser.email || '',
      role: 'agent',
      parentAdminId: agentData.parentAdminId,
      emailVerified: firebaseUser.emailVerified,
      name: ''
    });
    localStorage.setItem('userRole', 'agent');
    localStorage.setItem('agentkey', firebaseUser.uid);
    localStorage.setItem('adminkey', agentData.parentAdminId);
  };

  const clearAuthState = () => {
    setUser(null);
    localStorage.removeItem('userRole');
    localStorage.removeItem('adminkey');
    localStorage.removeItem('agentkey');
  };

  const checkIfAgentExists = async (email: string) => {
    try {
      const adminsRef = ref(database, 'users');
      const snapshot = await get(adminsRef);
      
      if (snapshot.exists()) {
        for (const [adminId, adminData] of Object.entries(snapshot.val()) as [string, any][]) {
          if (adminData.agents) {
            for (const [agentId, agentData] of Object.entries(adminData.agents) as [string, any][]) {
              if (agentData.email === email) {
                return {
                  firstName: agentData.firstName,
                  lastName: agentData.lastName,
                  parentAdminId: adminId
                };
              }
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error checking for agent:', error);
      return null;
    }
  };

  const signup = async (firstName: string, lastName: string, email: string, password: string, role: UserRole, leadLimit: string, agentLimit: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Send verification email immediately after signup
      await sendEmailVerification(firebaseUser);
      
      await set(ref(database, `users/${firebaseUser.uid}`), {
        firstName,
        lastName,
        email,
        role,
        createdAt: new Date().toISOString(),
        leadLimit,
        agentLimit,
        emailVerified: false // Initially false until verified
      });

      setUser({
        id: firebaseUser.uid,
        firstName,
        lastName,
        email,
        role,
        emailVerified: false,
        name: ''
      });

    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const sendVerificationEmail = async (email: string) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user is currently signed in');
      }
      
      // Check when last verification was sent
      const lastSent = localStorage.getItem(`lastVerificationSent_${user.uid}`);
      if (lastSent) {
        const lastSentTime = parseInt(lastSent, 10);
        const now = Date.now();
        const cooldownPeriod = 60 * 1000; // 1 minute cooldown
        
        if (now - lastSentTime < cooldownPeriod) {
          throw new Error('Please wait before requesting another verification email');
        }
      }
      
      await sendEmailVerification(user);
      localStorage.setItem(`lastVerificationSent_${user.uid}`, Date.now().toString());
      
    } catch (error: any) {
      if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many verification requests. Please try again later.');
      }
      throw new Error(error.message || 'Failed to send verification email');
    }
  };

  const checkEmailVerification = async (email: string): Promise<boolean> => {
    try {
      // Reload the user to get fresh email verification status
      await auth.currentUser?.reload();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('No user is currently signed in');
      }
      
      // Also check our database for consistency
      const userRef = ref(database, `users/${currentUser.uid}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        return currentUser.emailVerified && (userData.emailVerified === true);
      }
      
      return currentUser.emailVerified;
    } catch (error: any) {
      console.error('Error checking email verification:', error);
      throw new Error(error.message || 'Failed to check email verification status');
    }
  };

  const verifyEmail = async (oobCode: string) => {
    try {
      // Verify the action code
      await applyActionCode(auth, oobCode);
      
      // Update email verification status in database
      const user = auth.currentUser;
      if (user) {
        await update(ref(database, `users/${user.uid}`), {
          emailVerified: true
        });
        
        // Reload user to get fresh data
        await handleUserAuth(user);
      }
    } catch (error: any) {
      throw new Error(error.message || 'Email verification failed');
    }
  };

  const resendVerificationEmail = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user is currently signed in');
      }
      await sendEmailVerification(user);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to resend verification email');
    }
  };
  

  const login = async (email: string, password: string, role: UserRole): Promise<UserCredential> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Check if email is verified
      if (!firebaseUser.emailVerified) {
        await auth.signOut();
        throw new Error('Please verify your email before logging in. Check your inbox for the verification link.');
      }
      
      if (role === 'agent') {
        const agentCheck = await checkIfAgentExists(email);
        if (!agentCheck) {
          await auth.signOut();
          throw new Error('Agent not found under any admin account');
        }
      } else {
        const userRef = ref(database, `users/${userCredential.user.uid}`);
        const snapshot = await get(userRef);
        
        if (!snapshot.exists()) {
          await auth.signOut();
          throw new Error('User not found');
        }
  
        const userData = snapshot.val();
        if (userData.role !== role) {
          await auth.signOut();
          throw new Error(`Invalid role. Expected ${role} but found ${userData.role}`);
        }
  
        if (userData.email !== email) {
          await auth.signOut();
          throw new Error('Email mismatch in database');
        }
      }
  
      return userCredential;
    } catch (error: any) {
      if (auth.currentUser) {
        await auth.signOut();
      }
      throw new Error(error.message || 'Login failed');
    }
  };

  const logout = async () => {


    try {
      await signOut(auth);
      clearAuthState();
      navigate('/login');

      if(role == 'agent'){
        const logoutRef = ref(database, `users/${adminId}/agents/${agentId}`);
        const now = new Date().toLocaleString(); // or toISOString()
        try {
          await update(logoutRef, {
            logoutTime: now
          });
          localStorage.clear()
        } catch (error) {
          console.error('Failed to update logout time:', error);
        }
      }
     


    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const value = {
    user,
    login,
    signup,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isAgent: user?.role === 'agent',
    sendVerificationEmail,
    checkEmailVerification,
    verifyEmail,
    resendVerificationEmail
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};