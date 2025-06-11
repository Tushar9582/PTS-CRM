import { auth, database } from '../firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';

export const login = async (email: string, password: string, role: 'admin' | 'agent') => {
  try {
    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    if (role === 'admin') {
      // Verify admin in database
      const adminRef = ref(database, `users/${uid}`);
      const adminSnapshot = await get(adminRef);
      
      if (!adminSnapshot.exists()) {
        await signOut(auth);
        throw new Error('Admin account not found in database');
      }

      const adminData = adminSnapshot.val();
      if (adminData.role !== 'admin') {
        await signOut(auth);
        throw new Error('Role mismatch. Expected admin');
      }

      // Store admin data
      localStorage.setItem('adminKey', uid);
      localStorage.setItem('role', 'admin');
      return { user: userCredential.user, adminData };
    } else if(role == 'agent') {
      // Verify agent in database
      const agentsRef = ref(database, 'agents');
      const agentsSnapshot = await get(agentsRef);
      
      if (!agentsSnapshot.exists()) {
        await signOut(auth);
        throw new Error('No agents found in database');
      }

      let agentFound = false;
      let agentData = null;
      let adminKey = null;

      // Search through all agents
      agentsSnapshot.forEach((adminSnapshot) => {
        adminSnapshot.forEach((agentSnapshot) => {
          const agent = agentSnapshot.val();
          if (agent.email === email) {
            agentFound = true;
            agentData = agent;
            adminKey = adminSnapshot.key; // Store the admin key
          }
        });
      });

      if (!agentFound) {
        await signOut(auth);
        throw new Error('Agent not found under any admin account');
      }

      // Store both admin and agent keys
      localStorage.setItem('adminKey', adminKey);
      localStorage.setItem('agentKey', uid);
      localStorage.setItem('role', 'agent');
      return { user: userCredential.user, agentData, adminKey };
    }else{
        alert("Nothing Found")
    }
  } catch (error: any) {
    if (auth.currentUser) {
      await signOut(auth);
    }
    throw new Error(error.message || 'Login failed');
  }
};

export const checkAuthState = () => {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
};