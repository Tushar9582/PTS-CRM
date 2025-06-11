import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, get, update } from 'firebase/database';
import { signInWithEmailAndPassword, getAuth, onAuthStateChanged } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'agent'>('admin');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const auth = getAuth();

  // Check auth state on component mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = ref(database, 'users');
          const snapshot = await get(userRef);
          
          if (snapshot.exists()) {
            const users = snapshot.val();
            let userFound = false;
            let userRole = '';

            for (const [dbAdminId, adminData] of Object.entries(users)) {
              const admin = adminData as any;
              
              if (dbAdminId === user.uid) {
                userRole = 'admin';
                userFound = true;
                break;
              }
              
              if (admin.agents) {
                for (const [agentId, agentData] of Object.entries(admin.agents)) {
                  if (agentId === user.uid) {
                    userRole = 'agent';
                    userFound = true;
                    break;
                  }
                }
              }
              if (userFound) break;
            }

            if (userFound) {
              if (!isLoading) {
                localStorage.setItem('adminKey', userFound.adminId);
                if (userRole === 'agent') {
                  localStorage.setItem('agentKey', user.uid);
                } else {
                  localStorage.removeItem('agentKey');
                }
                navigate('/dashboard');
              }
            } else {
              await auth.signOut();
              localStorage.clear();
            }
          }
        } catch (error) {
          console.error('Auth state check error:', error);
        }
      }
      setIsCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [auth, navigate, isLoading]);

 const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }
  
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
  
      const userRef = ref(database, 'users');
      const snapshot = await get(userRef);
  
      if (snapshot.exists()) {
        const users = snapshot.val();
        let userFound = false;
        let userRole = '';
        let adminId = '';
        let agentLimit = 0;
        let leadLimit = 0;
  
        for (const [dbAdminId, adminData] of Object.entries(users)) {
          const admin = adminData as any;
  
          if (dbAdminId === user.uid) {
            userRole = 'admin';
            adminId = dbAdminId;
            agentLimit = admin.agentLimit || 0;
            leadLimit = admin.leadLimit || 0;
            userFound = true;
            break;
          }
  
          if (admin.agents) {
            for (const [agentId, agentData] of Object.entries(admin.agents)) {
              if (agentId === user.uid) {
                userRole = 'agent';
                adminId = dbAdminId;
                agentLimit = admin.agentLimit || 0;
                leadLimit = admin.leadLimit || 0;
                userFound = true;
                break;
              }
            }
          }
          if (userFound) break;
        }
  
        if (!userFound) {
          await auth.signOut();
          throw new Error('User not found in database');
        }
  
        if (userRole !== role) {
          await auth.signOut();
          throw new Error(`Please login as ${userRole} instead of ${role}`);
        }
  
        localStorage.setItem('adminKey', adminId);
        localStorage.setItem('agentLimit', agentLimit.toString());
        localStorage.setItem('leadLimit', leadLimit.toString());
  
        if (userRole === 'admin') {
          localStorage.removeItem('agentKey');
          toast.success('Welcome back, Admin!');
        } else {
          localStorage.setItem('agentKey', user.uid);
          toast.success('Welcome back, Agent!');
  
          // ✅ Update last login date only for agent
          const now = new Date();
          const formattedDate = now.toLocaleString(); // You can customize format if needed
          const agentRef = ref(database, `users/${adminId}/agents/${user.uid}`);
          await update(agentRef, {
            lastLogin: formattedDate
          });
        }
  
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed. Please check your credentials.';
      if (error.code === 'auth/user-not-found') errorMessage = 'No user found with this email.';
      else if (error.code === 'auth/wrong-password') errorMessage = 'Incorrect password.';
      else if (error.message.includes('Please login as')) errorMessage = error.message;
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center ">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-4 mt-20"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="text-primary"
          >
            <Loader2 className="w-12 h-12" />
          </motion.div>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg font-medium"
          >
            Checking authentication...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex items-center justify-center min-h-screen"
      >
        <div className="w-full max-w-md p-4">
          <Tabs defaultValue="admin" className="w-full" onValueChange={(value) => setRole(value as 'admin' | 'agent')}>
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="admin">Admin</TabsTrigger>
                <TabsTrigger value="agent">Agent</TabsTrigger>
              </TabsList>
            </motion.div>
            
            <TabsContent value="admin">
              <motion.form
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                onSubmit={handleSubmit}
                className="neuro p-6 space-y-12"
              >
                 <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-center text-pulse">Admin Login</h2>
                  <p className="text-sm text-muted-foreground text-center">
                    Access your admin dashboard
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="admin-email" className="text-sm font-medium">Email</label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@pulsecrm.com"
                      className="neuro-inset focus:shadow-none"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="admin-password" className="text-sm font-medium">Password</label>
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="••••••••"
                      className="neuro-inset focus:shadow-none"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full neuro hover:shadow-none transition-all duration-300"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Logging in...</span>
                    </div>
                  ) : (
                    'Login as Admin'
                  )}
                </Button>
                
                <div className="space-y-2 text-center">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-pulse hover:underline">
                      Sign up
                    </Link>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Forgot your password?{' '}
                    <Link to="/forgot-password" className="text-pulse hover:underline">
                      Reset it here
                    </Link>
                  </p>
                </div>
              </motion.form>
            </TabsContent>
            
            <TabsContent value="agent">
              <motion.form
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                onSubmit={handleSubmit}
                className="neuro p-6 space-y-12"
              >
                 <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-center text-pulse">Agent Login</h2>
                  <p className="text-sm text-muted-foreground text-center">
                    Access your agent dashboard
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="agent-email" className="text-sm font-medium">Email</label>
                    <Input
                      id="agent-email"
                      type="email"
                      placeholder="agent@pulsecrm.com"
                      className="neuro-inset focus:shadow-none"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="agent-password" className="text-sm font-medium">Password</label>
                    <Input
                      id="agent-password"
                      type="password"
                      placeholder="••••••••"
                      className="neuro-inset focus:shadow-none"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full neuro hover:shadow-none transition-all duration-300"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Logging in...</span>
                    </div>
                  ) : (
                    'Login as Agent'
                  )}
                </Button>
                
                <div className="space-y-2 text-center">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-pulse hover:underline">
                      Sign up
                    </Link>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Forgot your password?{' '}
                    <Link to="/forgot-password" className="text-pulse hover:underline">
                      Reset it here
                    </Link>
                  </p>
                </div>
              </motion.form>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LoginForm;