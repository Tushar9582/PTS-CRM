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
  onAuthStateChanged
} from 'firebase/auth';
import { getDatabase, ref, set, get, update } from 'firebase/database';

// Encryption key (should be stored securely in production)
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8'; // 32 chars for AES-256

// Encryption utility functions
async function encryptData(data: string): Promise<string> {
  if (!data) return data;
  
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(data);
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ENCRYPTION_KEY),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encodedData
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedData: string): Promise<string> {
  if (!encryptedData) return encryptedData;
  
  try {
    const decoder = new TextDecoder();
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(ENCRYPTION_KEY),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedData;
  }
}

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
  apiKey: "AIzaSyAuzGxddzJTYUAcXV7QQH-ep6qULJfWbh8",
  authDomain: "pts-crm-a3cae.firebaseapp.com",
  databaseURL: "https://pts-crm-a3cae-default-rtdb.firebaseio.com",
  projectId: "pts-crm-a3cae",
  storageBucket: "pts-crm-a3cae.firebasestorage.app",
  messagingSenderId: "431606697445",
  appId: "1:431606697445:web:715a36cd0ab5b2a69fb30c",
  measurementId: "G-F6BPMDT4NH"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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

  const setAgentAuthState = async (firebaseUser: FirebaseUser, agentData: {firstName: string, lastName: string, parentAdminId: string}) => {
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
              try {
                const decryptedEmail = await decryptData(agentData.email);
                if (decryptedEmail === email) {
                  return {
                    firstName: await decryptData(agentData.firstName),
                    lastName: await decryptData(agentData.lastName),
                    parentAdminId: adminId
                  };
                }
              } catch (error) {
                console.error('Error decrypting agent data:', error);
                continue;
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
      
      await sendEmailVerification(firebaseUser);
      
      await set(ref(database, `users/${firebaseUser.uid}`), {
        firstName,
        lastName,
        email,
        role,
        createdAt: new Date().toISOString(),
        leadLimit,
        agentLimit,
        emailVerified: false
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
      
      const lastSent = localStorage.getItem(`lastVerificationSent_${user.uid}`);
      if (lastSent) {
        const lastSentTime = parseInt(lastSent, 10);
        const now = Date.now();
        const cooldownPeriod = 60 * 1000;
        
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
      await auth.currentUser?.reload();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('No user is currently signed in');
      }
      
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
      await applyActionCode(auth, oobCode);
      
      const user = auth.currentUser;
      if (user) {
        await update(ref(database, `users/${user.uid}`), {
          emailVerified: true
        });
        
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
    const role = localStorage.getItem('userRole');
    const adminId = localStorage.getItem('adminkey');
    const agentId = localStorage.getItem('agentkey');

    try {
      await signOut(auth);
      clearAuthState();
      navigate('/login');

      if(role === 'agent' && adminId && agentId){
        const logoutRef = ref(database, `users/${adminId}/agents/${agentId}`);
        const now = new Date().toLocaleString();
        try {
          await update(logoutRef, {
            logoutTime: now
          });
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