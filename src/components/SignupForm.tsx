
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
} from 'firebase/auth';
import { ref, set } from 'firebase/database';
import ReCAPTCHA from 'react-google-recaptcha';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export const SignupForm: React.FC = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'agent'>('admin');
  const [verificationSent, setVerificationSent] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const agentLimit = 2;
  const leadLimit = 500;
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !user.emailVerified) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      toast.error('Please fill all fields');
      return;
    }

    if (!captchaVerified) {
      toast.error('Please verify reCAPTCHA');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
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
        role,
        leadLimit,
        agentLimit,
        emailVerified: false,
        status: 'active',
        createdAt: new Date().toISOString()
      });

      await sendEmailVerification(user);
      setCurrentUser(user);
      setVerificationSent(true);

      toast.success('Account created! Please verify your email.');
      await signOut(auth);

    } catch (error: any) {
      toast.error(error.message || 'Signup failed');
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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex items-center justify-center min-h-screen bg-gradient-to-br from-secondary to-background dark:from-gray-900 dark:to-gray-800 p-4"
      >
        {/* Outer container for the combined signup card */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 80 }}
          className="flex flex-col lg:flex-row w-full max-w-5xl bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
        >
          {/* Left side: Signup Form */}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">Password</label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">Confirm Password</label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                  </div>
                </div>

                <div className="flex justify-center pt-2">
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey="6LfcvEQrAAAAAGZk6NDz1q1HaYuJCO--BHzGeTOh"
                    onChange={() => setCaptchaVerified(true)}
                    onExpired={() => setCaptchaVerified(false)}
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
                    <span>Creating account...</span>
                  </>
                ) : (
                  'Sign Up'
                )}
              </Button>

              <div className="space-y-2 text-center text-sm">
                <p className="text-muted-foreground">
                  Already have an account?{' '}
                  <Link to="/login" className="text-blue-600 hover:underline dark:text-blue-400">
                    Login
                  </Link>
                </p>
              </div>
            </motion.form>
          </div>

          {/* Vertical Dividing Line */}
          <div className="hidden lg:flex w-px bg-gray-200 dark:bg-gray-700 h-auto"></div>

          {/* Right side: Image */}
          <div className="hidden lg:flex flex-col flex-1 items-center justify-center p-8 lg:w-1/2 bg-gray-50 dark:bg-gray-700">
            <motion.div
              initial={{ x: 50, opacity: 0, scale: 0.9 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, type: "spring", stiffness: 80, delay: 0.3 }}
              className="w-full h-full flex items-center justify-center"
            >
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTDUVs58vM-moa0ODPnnuQV4iwmSOWTDJgbBA&s"
                alt="Signup Illustration"
                className="w-full h-full object-cover rounded-lg shadow-md"
              />
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SignupForm;