// src/components/LoginForm.tsx

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
import { FaGoogle, FaFacebook, FaYoutube, FaLinkedin, FaTwitter } from 'react-icons/fa';


// Encryption key management (Keep as is)
const getEncryptionKey = async (role: 'admin' | 'agent'): Promise<CryptoKey> => {
    const KEY_NAME = `pulse-crm-${role}-key`;

    try {
        const storedKey = localStorage.getItem(KEY_NAME);
        if (storedKey) {
            const keyData = JSON.parse(storedKey);
            return await crypto.subtle.importKey(
                'jwk',
                keyData,
                { name: 'AES-GCM' },
                true,
                ['encrypt', 'decrypt']
            );
        }

        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        const exportedKey = await crypto.subtle.exportKey('jwk', key);
        localStorage.setItem(KEY_NAME, JSON.stringify(exportedKey));

        return key;
    } catch (error) {
        console.error(`Error getting ${role} encryption key:`, error);
        throw error;
    }
};

export const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'agent'>('admin');
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const navigate = useNavigate();
    const auth = getAuth();

    // Custom toast function for centered messages
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'error') => {
        toast[type](message, {
            position: 'top-center',
            duration: 5000,
        });
    };

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
                        let adminId = '';
                        let isActive = false;

                        // Check if user is admin
                        if (users[user.uid]) {
                            userRole = 'admin';
                            adminId = user.uid;
                            isActive = users[user.uid].status === 'active';
                            userFound = true;
                        }
                        // If not admin, check if user is agent
                        else {
                            for (const [dbAdminId, adminData] of Object.entries(users)) {
                                const admin = adminData as any;
                                if (admin.agents && admin.agents[user.uid]) {
                                    userRole = 'agent';
                                    adminId = dbAdminId;
                                    isActive = admin.agents[user.uid].status === 'active';
                                    userFound = true;
                                    break;
                                }
                            }
                        }

                        if (userFound) {
                            if (!isActive) {
                                await auth.signOut();
                                localStorage.clear();
                                showToast('Your account is currently disabled. Please contact the super admin.'); // RE-ENABLED TOAST
                                return;
                            }

                            // Initialize encryption keys for the role
                            await getEncryptionKey(userRole as 'admin' | 'agent');

                            // Store user identifiers
                            localStorage.setItem('currentRole', userRole);
                            localStorage.setItem('adminId', adminId);

                            if (userRole === 'agent') {
                                localStorage.setItem('agentId', user.uid);
                            } else {
                                localStorage.removeItem('agentId');
                            }

                            navigate('/dashboard');
                        } else {
                            await auth.signOut();
                            localStorage.clear();
                            showToast('User not found in database');
                        }
                    }
                } catch (error) {
                    console.error('Auth state check error:', error);
                    showToast('Authentication check failed');
                }
            }
            setIsCheckingAuth(false);
        });

        return () => unsubscribe();
    }, [auth, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            showToast('Please enter email and password');
            return;
        }

        setIsLoading(true);

        try {
            // 1. Authenticate with Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Check user in Realtime Database
            const userRef = ref(database, 'users');
            const snapshot = await get(userRef);

            if (!snapshot.exists()) {
                await auth.signOut();
                throw new Error('User not found in database');
            }

            const users = snapshot.val();
            let userData: any = null;
            let isAdmin = false;
            let isActive = false;

            // 3. Check if user is admin
            if (users[user.uid]) {
                userData = users[user.uid];
                isAdmin = true;
                isActive = userData.status === 'active';
            }
            // 4. If not admin, check if agent
            else {
                for (const adminId in users) {
                    if (users[adminId].agents && users[adminId].agents[user.uid]) {
                        userData = users[adminId].agents[user.uid];
                        userData.adminId = adminId; // Store admin reference
                        isActive = userData.status === 'active';
                        break;
                    }
                }
            }

            // 5. Strict validation checks
            if (!userData) {
                await auth.signOut();
                throw new Error('User not found in database');
            }

            // Check active status first
            if (!isActive) {
                await auth.signOut();
                throw new Error('Your account is currently disabled. Please contact the super admin.');
            }

            const userRole = isAdmin ? 'admin' : 'agent';
            if (userRole !== role) {
                await auth.signOut();
                throw new Error(`Please login as ${userRole}`);
            }

            // 6. Only proceed if all checks passed
            await getEncryptionKey(userRole as 'admin' | 'agent');

            // Store user data
            localStorage.setItem('currentRole', userRole);
            localStorage.setItem('adminId', isAdmin ? user.uid : userData.adminId);
            localStorage.setItem('agentLimit', userData.agentLimit?.toString() || '0');
            localStorage.setItem('leadLimit', userData.leadLimit?.toString() || '0');


            if (userRole === 'agent') {
                localStorage.setItem('agentId', user.uid);
                showToast('Welcome back, Agent!', 'success');

                // Update last login
                const now = new Date().toLocaleString();
                await update(ref(database, `users/${userData.adminId}/agents/${user.uid}`), {
                    lastLogin: now
                });
            } else {
                localStorage.removeItem('agentId');
                showToast('Welcome back, Admin!', 'success');
            }

            // 7. FINAL STEP - Only navigate if everything succeeded
            navigate('/dashboard');

        } catch (error: any) {
            console.error('Login error:', error);
            let errorMessage = 'Login failed. Please check your credentials.';

            if (error.code === 'auth/user-not-found') {
                errorMessage = 'No user found with this email.';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect password.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            showToast(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    if (isCheckingAuth) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-secondary to-background">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col items-center gap-4"
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
                        className="text-lg font-medium text-gray-700 dark:text-gray-300"
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
                className="flex items-center justify-center min-h-screen bg-gradient-to-br from-secondary to-background dark:from-gray-900 dark:to-gray-800 p-4"
            >
                {/* Outer container for the combined login card */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, type: "spring", stiffness: 80 }}
                    className="flex flex-col lg:flex-row w-full max-w-5xl bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
                >
                    {/* Left side: Login Form */}
                    <div className="flex-1 p-8 flex flex-col justify-center lg:w-1/2">
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
                                    className="space-y-6 pt-6"
                                >
                                    <div className="space-y-2">
                                        <h2 className="text-3xl font-extrabold text-center text-gray-900 dark:text-white">Sign in</h2>
                                        <p className="text-sm text-muted-foreground text-center">
                                            to access your CRM Home
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label htmlFor="admin-email" className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">Email or mobile number</label>
                                            <Input
                                                id="admin-email"
                                                type="email"
                                                placeholder="Email address or mobile number"
                                                className="focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="admin-password" className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">Password</label>
                                            <Input
                                                id="admin-password"
                                                type="password"
                                                placeholder="••••••••"
                                                className="focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full bg-blue-600 text-white hover:bg-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Signing in...</span>
                                            </>
                                        ) : (
                                            'Next'
                                        )}
                                    </Button>

                                    {/* Social Login Section - Only for Admin */}
                                    <div className="relative flex items-center py-5">
                                        <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                                        <span className="flex-shrink mx-4 text-gray-500 dark:text-gray-400 text-sm">Sign in using</span>
                                        <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                                    </div>

                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                                        <Button
                                            variant="ghost"
                                            className="w-full aspect-square p-2 bg-white border border-gray-200 shadow-sm flex items-center justify-center rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
                                            onClick={() => showToast('Google login coming soon!', 'info')}
                                        >
                                            <FaGoogle className="h-6 w-6" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="w-full aspect-square p-2 bg-white border border-gray-200 shadow-sm flex items-center justify-center rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
                                            onClick={() => showToast('Facebook login coming soon!', 'info')}
                                        >
                                            <FaFacebook className="h-6 w-6" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="w-full aspect-square p-2 bg-white border border-gray-200 shadow-sm flex items-center justify-center rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
                                            onClick={() => showToast('YouTube login coming soon!', 'info')}
                                        >
                                            <FaYoutube className="h-6 w-6" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="w-full aspect-square p-2 bg-white border border-gray-200 shadow-sm flex items-center justify-center rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
                                            onClick={() => showToast('LinkedIn login coming soon!', 'info')}
                                        >
                                            <FaLinkedin className="h-6 w-6" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="w-full aspect-square p-2 bg-white border border-gray-200 shadow-sm flex items-center justify-center rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
                                            onClick={() => showToast('Twitter login coming soon!', 'info')}
                                        >
                                            <FaTwitter className="h-6 w-6" />
                                        </Button>
                                    </div>

                                    <div className="space-y-2 text-center text-sm">
                                        <p className="text-muted-foreground">
                                            Don't have an account?{' '}
                                            <Link to="/signup" className="text-blue-600 hover:underline dark:text-blue-400">
                                                Sign up
                                            </Link>
                                        </p>
                                        <p className="text-muted-foreground">
                                            Forgot your password?{' '}
                                            <Link to="/forgot-password" className="text-blue-600 hover:underline dark:text-blue-400">
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
                                    className="space-y-6 pt-6"
                                >
                                    <div className="space-y-2">
                                        <h2 className="text-3xl font-extrabold text-center text-gray-900 dark:text-white">Agent Login</h2>
                                        <p className="text-sm text-muted-foreground text-center">
                                            Access your agent dashboard
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label htmlFor="agent-email" className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">Email or mobile number</label>
                                            <Input
                                                id="agent-email"
                                                type="email"
                                                placeholder="Email address or mobile number"
                                                className="focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="agent-password" className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">Password</label>
                                            <Input
                                                id="agent-password"
                                                type="password"
                                                placeholder="••••••••"
                                                className="focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full bg-blue-600 text-white hover:bg-blue-700 transition-all duration-300 flex items-center justify-center gap-2"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Signing in...</span>
                                            </>
                                        ) : (
                                            'Next'
                                        )}
                                    </Button>

                                    <div className="space-y-2 text-center text-sm">
                                        <p className="text-muted-foreground">
                                            Don't have an account?{' '}
                                            <Link to="/signup" className="text-blue-600 hover:underline dark:text-blue-400">
                                                Sign up
                                            </Link>
                                        </p>
                                        <p className="text-muted-foreground">
                                            Forgot your password?{' '}
                                            <Link to="/forgot-password" className="text-blue-600 hover:underline dark:text-blue-400">
                                                Reset it here
                                            </Link>
                                        </p>
                                    </div>
                                </motion.form>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Vertical Dividing Line */}
                    <div className="hidden lg:flex w-px bg-gray-200 dark:bg-gray-700 h-auto"></div>

                    {/* Right side: Animated Illustration & Text */}
                    <div className="hidden lg:flex flex-col flex-1 items-center justify-center p-8 lg:w-1/2">
                        <motion.div
                            initial={{ x: 50, opacity: 0, scale: 0.9 }}
                            animate={{ x: 0, opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, type: "spring", stiffness: 80, delay: 0.3 }}
                            className="flex flex-col items-center justify-center text-center max-w-md mx-auto"
                        >
                            {/* Illustration */}
                            <div className="mb-6">
                                <div className="h-10 mx-auto lg:mx-0">
                                    <img
                                        src="https://www.pawartechnologyservices.com/images/log.png"
                                        alt="PTS CRM Logo"
                                        className="block dark:hidden h-full w-auto filter brightness-0" // Black in light mode
                                    />
                                    <img
                                        src="https://www.pawartechnologyservices.com/images/log.png"
                                        alt="PTS CRM Logo"
                                        className="hidden dark:block h-full w-auto filter brightness-0 invert" // White in dark mode
                                    />

                                </div>    </div>

                            {/* Heading */}
                            <motion.h2
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.6, delay: 0.7 }}
                                className="text-3xl font-bold text-gray-900 dark:text-white mb-4"
                            >
                                Streamline Your Lead Management
                            </motion.h2>

                            <motion.p
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.6, delay: 0.9 }}
                                className="text-gray-600 dark:text-gray-300 mb-8 max-w-prose"
                            >
                                Capture leads effortlessly, track interactions, schedule meetings, and automate follow-ups—all in one secure system. Never miss an opportunity with real-time updates and AI-powered insights.
                            </motion.p>




                        </motion.div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default LoginForm;