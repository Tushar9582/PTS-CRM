import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { auth, database } from '../firebase';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, X, Eye, EyeOff } from 'lucide-react';
import PlanModal from '@/pages/PlanModel'; // Import the PlanModal component

export const SignupForm: React.FC = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'agent'>('admin');
  const [verificationSent, setVerificationSent] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [accountCreatedTime, setAccountCreatedTime] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    noSpaces: true,
  });

  const agentLimit = 2;
  const leadLimit = 500;
  const navigate = useNavigate();

  // Configure Google Auth Provider
  const googleAuthProvider = new GoogleAuthProvider();
  // Add scopes for better user experience
  googleAuthProvider.addScope('email');
  googleAuthProvider.addScope('profile');

  // Password validation function
  const validatePassword = (password: string) => {
    const errors = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      noSpaces: !/\s/.test(password),
    };
    setPasswordErrors(errors);
    return Object.values(errors).every(value => value === true);
  };

  useEffect(() => {
    if (password) {
      validatePassword(password);
    }
  }, [password]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !user.emailVerified && user.providerData[0]?.providerId !== 'google.com') {
        await signOut(auth);
        setCurrentUser(null);
        setVerificationSent(true);
        toast.error('Email not verified. Please verify your email.');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentUser && verificationSent) {
      interval = setInterval(async () => {
        await currentUser.reload();
        if (currentUser.emailVerified) {
          await set(ref(database, `users/${currentUser.uid}/emailVerified`), true);
          toast.success('Email verified successfully!');
          clearInterval(interval);
          navigate('/login');
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [currentUser, verificationSent, navigate]);

  // Check if trial period has expired (15 days)
  useEffect(() => {
    if (accountCreatedTime) {
      const checkTrialStatus = () => {
        const currentTime = Date.now();
        const trialEndTime = accountCreatedTime + (15 * 24 * 60 * 60 * 1000); // 15 days trial
        
        if (currentTime >= trialEndTime) {
          setShowPlanModal(true);
        }
      };
      
      // Check immediately
      checkTrialStatus();
      
      // Set up interval to check every hour
      const interval = setInterval(checkTrialStatus, 60 * 60 * 1000);
      
      return () => clearInterval(interval);
    }
  }, [accountCreatedTime]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      // Use signInWithPopup for all devices - it works on mobile too
      const result = await signInWithPopup(auth, googleAuthProvider);
      const user = result.user;
      
      // Check if user is new or existing using the database, not just the token response
      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);
      const isNewUser = !snapshot.exists();
      
      if (isNewUser) {
        // For new users, create a database entry
        const nameParts = user.displayName?.split(' ') || [];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        await set(ref(database, `users/${user.uid}`), {
          firstName,
          lastName,
          email: user.email,
          phoneNumber: user.phoneNumber || '', // Use phone number from Google if available
          role: 'admin', // Default role for Google signups
          leadLimit,
          agentLimit,
          emailVerified: true, // Google-authenticated users are automatically verified
          status: 'active',
          createdAt: Date.now(),
          provider: 'google', // Track signup method
          trialEnd: Date.now() + (15 * 24 * 60 * 60 * 1000), // 15 days trial
        });
        
        // Set account creation time for trial tracking
        setAccountCreatedTime(Date.now());
        
        toast.success('Account created with Google!');
        
        // Set a timeout to show the plan modal after 15 days
        setTimeout(() => {
          setShowPlanModal(true);
        }, 15 * 24 * 60 * 60 * 1000);
      } else {
        // For existing users, update last login time
        await set(ref(database, `users/${user.uid}/lastLogin`), Date.now());
      }
      
      // Redirect to dashboard after successful login
      navigate('/dashboard');
      
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      
      // Handle specific error cases
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in was canceled. Please try again.');
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Popup was blocked by your browser. Please allow popups for this site.');
      } else if (error.code === 'auth/network-request-failed') {
        toast.error('Network error. Please check your internet connection.');
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error('This domain is not authorized for Google sign-in.');
      } else {
        toast.error(error.message || 'Google sign in failed. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName || !lastName || !email || !phoneNumber || !password || !confirmPassword) {
      toast.error('Please fill all fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Validate password against policy
    if (!validatePassword(password)) {
      toast.error('Password does not meet the requirements');
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: `${firstName} ${lastName}`
      });

      await set(ref(database, `users/${user.uid}`), {
        firstName,
        lastName,
        email,
        phoneNumber,
        role,
        leadLimit,
        agentLimit,
        emailVerified: false,
        status: 'active',
        createdAt: Date.now(),
        provider: 'email', // Track signup method
        trialEnd: Date.now() + (15 * 24 * 60 * 60 * 1000), // 15 days trial
      });

      // Set account creation time for trial tracking
      setAccountCreatedTime(Date.now());

      await sendEmailVerification(user);
      setCurrentUser(user);
      setVerificationSent(true);

      toast.success('Account created! Please verify your email.');
      await signOut(auth);

    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Handle specific error cases
      if (error.code === 'auth/email-already-in-use') {
        toast.error('This email is already registered. Please try logging in.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address format.');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password is too weak. Please choose a stronger password.');
      } else if (error.code === 'auth/network-request-failed') {
        toast.error('Network error. Please check your internet connection.');
      } else {
        toast.error(error.message || 'Signup failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resendEmailVerification = async () => {
    if (currentUser) {
      try {
        await sendEmailVerification(currentUser);
        toast.success('Verification email resent');
      } catch (error: any) {
        toast.error('Failed to resend email');
      }
    }
  };

  const manuallyCheckVerification = async () => {
    if (currentUser) {
      await currentUser.reload();
      if (currentUser.emailVerified) {
        await set(ref(database, `users/${currentUser.uid}/emailVerified`), true);
        toast.success('Email verified');
        navigate('/login');
      } else {
        toast.error('Email not verified yet');
      }
    }
  };

  if (verificationSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-4 bg-gradient-to-br from-secondary to-background dark:from-gray-900 dark:to-gray-800">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full"
        >
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-4">Verify Your Email</h2>
          <p className="text-sm text-center text-muted-foreground mb-6">
            A verification email has been sent to <strong>{email}</strong>. <br />
            Please verify your email to continue.
          </p>
          <div className="flex flex-col space-y-3">
            <Button onClick={resendEmailVerification} className="w-full">
              Resend Email
            </Button>
            <Button 
              onClick={manuallyCheckVerification} 
              variant="outline" 
              className="w-full"
            >
              Manually Verified
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Once verified, you'll be redirected to login automatically.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center justify-center min-h-screen bg-gradient-to-br from-secondary to-background dark:from-gray-900 dark:to-gray-800 p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, type: "spring", stiffness: 80 }}
            className="flex flex-col lg:flex-row w-full max-w-5xl bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
          >
            <div className="flex-1 p-8 flex flex-col justify-center lg:w-1/2">
              <motion.form
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-extrabold text-center text-gray-900 dark:text-white">Create Account</h2>
                  <p className="text-sm text-muted-foreground text-center">
                    Join Pulse CRM to manage your customers
                  </p>
                  <p className="text-sm text-center text-blue-600 font-medium">
                    Start your 15-day free trial today!
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleGoogleSignIn}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2 border-gray-300 dark:border-gray-600"
                  disabled={isGoogleLoading}
                >
                  {isGoogleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <img 
                        src="https://www.google.com/favicon.ico" 
                        alt="Google logo" 
                        className="w-4 h-4"
                      />
                      <span>Sign up with Google</span>
                    </>
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-gray-800 px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="firstName" className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">First Name</label>
                      <Input
                        id="firstName"
                        placeholder="First Name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        className="focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="lastName" className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">Last Name</label>
                      <Input
                        id="lastName"
                        placeholder="Last Name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        className="focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">Email</label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">Phone Number</label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="Phone Number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                      className="focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600 pr-10"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                      
                      {/* Password policy requirements */}
                      {password && (
                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-xs">
                          <p className="font-medium mb-2">Password must contain:</p>
                          <ul className="space-y-1">
                            <li className={`flex items-center ${passwordErrors.minLength ? 'text-green-600' : 'text-red-600'}`}>
                              {passwordErrors.minLength ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                              At least 8 characters
                            </li>
                            <li className={`flex items-center ${passwordErrors.hasUppercase ? 'text-green-600' : 'text-red-600'}`}>
                              {passwordErrors.hasUppercase ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                              One uppercase letter
                            </li>
                            <li className={`flex items-center ${passwordErrors.hasLowercase ? 'text-green-600' : 'text-red-600'}`}>
                              {passwordErrors.hasLowercase ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                              One lowercase letter
                            </li>
                            <li className={`flex items-center ${passwordErrors.hasNumber ? 'text-green-600' : 'text-red-600'}`}>
                              {passwordErrors.hasNumber ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                              One number
                            </li>
                            <li className={`flex items-center ${passwordErrors.hasSpecialChar ? 'text-green-600' : 'text-red-600'}`}>
                              {passwordErrors.hasSpecialChar ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                              One special character (!@#$%^&* etc.)
                            </li>
                            <li className={`flex items-center ${passwordErrors.noSpaces ? 'text-green-600' : 'text-red-600'}`}>
                              {passwordErrors.noSpaces ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                              No spaces
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm Password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600 pr-10"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-red-600 text-xs mt-1">Passwords do not match</p>
                      )}
                    </div>
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
                      <span>Creating account...</span>
                    </>
                  ) : (
                    'Start Free Trial'
                  )}
                </Button>

                <div className="space-y-2 text-center text-sm">
                  <p className="text-muted-foreground">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-600 hover:underline dark:text-blue-400">
                      Login
                    </Link>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    By signing up, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </div>
              </motion.form>
            </div>

            <div className="hidden lg:flex w-px bg-gray-200 dark:bg-gray-700 h-auto"></div>

            <div className="hidden lg:flex flex-col flex-1 items-center justify-center p-8 lg:w-1/2 bg-gray-50 dark:bg-gray-700">
              <motion.div
                initial={{ x: 50, opacity: 0, scale: 0.9 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, type: "spring", stiffness: 80, delay: 0.3 }}
                className="w-full h-full flex items-center justify-center"
              >
                <img
                  src="/3.png"
                  alt="Signup Illustration"
                  className="w-full h-full object-cover rounded-lg shadow-md"
                />
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Plan Modal */}
      <PlanModal 
        isOpen={showPlanModal}
        onClose={() => {
          setShowPlanModal(false);
          signOut(auth);
          navigate('/');
        }}
        trialEndTime={accountCreatedTime ? accountCreatedTime + (15 * 24 * 60 * 60 * 1000) : 0}
        isBlocking={true}
      />
    </>
  );
};

export default SignupForm;