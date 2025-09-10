import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Agent } from '@/lib/mockData';
import { format, getYear, getMonth, getDate, setYear, setMonth, setDate } from 'date-fns';
import { Calendar as CalendarIcon, Eye, EyeOff, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { get, ref, set, query, orderByChild, equalTo } from 'firebase/database';
import { database, auth } from '../../firebase';
import { toast } from 'sonner';
import { createUserWithEmailAndPassword, sendEmailVerification, deleteUser } from 'firebase/auth';
import PlanModal from '@/pages/PlanModel';

const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8';

interface AgentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (agent: Agent) => void;
  agent?: Agent;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const countryCodes = [
  { code: '+1', country: 'US' },
  { code: '+91', country: 'India' },
  { code: '+44', country: 'UK' },
  { code: '+61', country: 'Australia' },
  { code: '+86', country: 'China' },
  { code: '+81', country: 'Japan' },
  { code: '+49', country: 'Germany' },
  { code: '+33', country: 'France' },
  { code: '+34', country: 'Spain' },
  { code: '+39', country: 'Italy' },
  { code: '+55', country: 'Brazil' },
  { code: '+52', country: 'Mexico' },
  { code: '+7', country: 'Russia' },
  { code: '+82', country: 'South Korea' },
  { code: '+65', country: 'Singapore' },
  { code: '+971', country: 'UAE' },
  { code: '+966', country: 'Saudi Arabia' },
  { code: '+27', country: 'South Africa' },
  { code: '+20', country: 'Egypt' },
  { code: '+234', country: 'Nigeria' },
];

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

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

async function encryptAgent(agent: Agent): Promise<Agent> {
  const encryptedAgent = { ...agent };
  
  encryptedAgent.name = await encryptData(agent.name);
  encryptedAgent.email = await encryptData(agent.email);
  encryptedAgent.phone = await encryptData(agent.phone);
  encryptedAgent.designation = await encryptData(agent.designation);
  if (agent.password) {
    encryptedAgent.password = await encryptData(agent.password);
  }
  if (agent.birthDate) {
    encryptedAgent.birthDate = await encryptData(agent.birthDate);
  }
  
  return encryptedAgent;
}

async function decryptAgent(agent: Agent): Promise<Agent> {
  const decryptedAgent = { ...agent };
  
  decryptedAgent.name = await decryptData(agent.name);
  decryptedAgent.email = await decryptData(agent.email);
  decryptedAgent.phone = await decryptData(agent.phone);
  decryptedAgent.designation = await decryptData(agent.designation);
  if (agent.password) {
    decryptedAgent.password = await decryptData(agent.password);
  }
  if (agent.birthDate) {
    decryptedAgent.birthDate = await decryptData(agent.birthDate);
  }
  
  return decryptedAgent;
}

export const AgentForm: React.FC<AgentFormProps> = ({ isOpen, onClose, onSubmit, agent }) => {
  const { user } = useAuth();
  const currentUser = localStorage.getItem('adminkey');
  const [isDecrypting, setIsDecrypting] = useState(false);

  const [formData, setFormData] = useState<Partial<Agent> & { password?: string; confirmPassword?: string; countryCode?: string }>({
    name: '',
    email: '',
    phone: '',
    designation: '',
    status: 'active',
    assignedLeads: 0,
    birthDate: '',
    password: '',
    confirmPassword: '',
    lastLogin: agent?.lastLogin || '',
    logoutTime: agent?.logoutTime || '',
    countryCode: '+1'
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [birthDate, setBirthDate] = useState<Date | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    noSpaces: true,
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const [designationError, setDesignationError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [pendingAgent, setPendingAgent] = useState<{agent: Agent, authUid: string} | null>(null);

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

  // Name validation function (no special characters, only letters and spaces)
  const validateName = (name: string) => {
    const nameRegex = /^[a-zA-Z\s]*$/;
    if (!nameRegex.test(name)) {
      setNameError('Name can only contain letters and spaces');
      return false;
    }
    if (name.length > 50) {
      setNameError('Name must be less than 50 characters');
      return false;
    }
    setNameError(null);
    return true;
  };

  // Designation validation function (no special characters, only letters, numbers and spaces)
  const validateDesignation = (designation: string) => {
    const designationRegex = /^[a-zA-Z0-9\s\-]*$/;
    if (!designationRegex.test(designation)) {
      setDesignationError('Designation can only contain letters, numbers, spaces, and hyphens');
      return false;
    }
    if (designation.length > 50) {
      setDesignationError('Designation must be less than 50 characters');
      return false;
    }
    setDesignationError(null);
    return true;
  };

  // Phone number validation function
  const validatePhone = (phone: string, countryCode: string) => {
    // Remove any non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Validate based on country code
    let isValid = false;
    let errorMessage = null;
    
    switch (countryCode) {
      case '+1': // US/Canada
        isValid = digitsOnly.length === 10;
        errorMessage = isValid ? null : 'US/Canada numbers must be 10 digits';
        break;
      case '+91': // India
        isValid = digitsOnly.length === 10;
        errorMessage = isValid ? null : 'Indian numbers must be 10 digits';
        break;
      case '+44': // UK
        isValid = digitsOnly.length === 10 || digitsOnly.length === 11;
        errorMessage = isValid ? null : 'UK numbers must be 10 or 11 digits';
        break;
      case '+61': // Australia
        isValid = digitsOnly.length === 9;
        errorMessage = isValid ? null : 'Australian numbers must be 9 digits';
        break;
      default:
        // Default validation for other countries
        isValid = digitsOnly.length >= 7 && digitsOnly.length <= 15;
        errorMessage = isValid ? null : 'Phone number must be between 7-15 digits';
    }
    
    setPhoneError(errorMessage);
    return isValid;
  };

  useEffect(() => {
    if (formData.password) {
      validatePassword(formData.password);
    }
  }, [formData.password]);

  useEffect(() => {
    if (agent) {
      const fetchAndDecryptAgent = async () => {
        setIsDecrypting(true);
        try {
          const decryptedAgent = await decryptAgent(agent);
          
          if (!user?.id) return;
          
          const agentRef = ref(database, `users/${user.id}/agents/${agent.id}/password`);
          const snapshot = await get(agentRef);
          
          // Extract country code from phone if it exists
          let countryCode = '+1';
          let phoneWithoutCode = decryptedAgent.phone || '';
          
          if (decryptedAgent.phone) {
            const foundCode = countryCodes.find(code => 
              decryptedAgent.phone?.startsWith(code.code)
            );
            
            if (foundCode) {
              countryCode = foundCode.code;
              phoneWithoutCode = decryptedAgent.phone.replace(foundCode.code, '').trim();
            }
          }
          
          setFormData({
            ...decryptedAgent,
            phone: phoneWithoutCode,
            countryCode: countryCode,
            password: snapshot.exists() ? await decryptData(snapshot.val()) : '',
            confirmPassword: snapshot.exists() ? await decryptData(snapshot.val()) : '',
            lastLogin: agent.lastLogin || '',
            logoutTime: agent.logoutTime || ''
          });
          
          if (decryptedAgent.birthDate) {
            setBirthDate(new Date(decryptedAgent.birthDate));
          }
        } catch (error) {
          console.error('Error decrypting agent:', error);
          setFormData({
            ...agent,
            phone: '',
            countryCode: '+1',
            password: '',
            confirmPassword: '',
            lastLogin: agent.lastLogin || '',
            logoutTime: agent.logoutTime || ''
          });
        } finally {
          setIsDecrypting(false);
        }
      };

      fetchAndDecryptAgent();
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        designation: '',
        status: 'active',
        assignedLeads: 0,
        birthDate: '',
        password: '',
        confirmPassword: '',
        lastLogin: '',
        logoutTime: '',
        countryCode: '+1'
      });
      setBirthDate(undefined);
      setVerificationSent(false);
      setPendingAgent(null);
    }
  }, [agent, isOpen, user?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'name') {
      validateName(value);
    }
    
    if (name === 'designation') {
      validateDesignation(value);
    }
    
    if (name === 'phone') {
      // Only allow numbers in phone field
      const numericValue = value.replace(/\D/g, '');
      setFormData(prev => ({
        ...prev,
        [name]: numericValue
      }));
      
      if (formData.countryCode) {
        validatePhone(numericValue, formData.countryCode);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Validate phone when country code changes
    if (field === 'countryCode' && formData.phone) {
      validatePhone(formData.phone, value);
    }
  };

  const handleBirthDateChange = (date?: Date) => {
    setBirthDate(date);
    if (date) {
      setFormData(prev => ({
        ...prev,
        birthDate: format(date, 'yyyy-MM-dd')
      }));
    }
    // Close calendar after selecting a date
    setCalendarOpen(false);
  };

  const adminId = localStorage.getItem('role') === 'agent' 
    ? localStorage.getItem('adminKey')
    : currentUser;

  const isDateValidFor18Plus = (date: Date): boolean => {
    const today = new Date();
    const minDate = new Date();
    minDate.setFullYear(today.getFullYear() - 18);
    return date <= minDate;
  };

  const generateYears = (from: number, to: number) => {
    const years = [];
    for (let i = to; i >= from; i--) {
      years.push(i);
    }
    return years;
  };

  const checkAgentExists = async (email: string): Promise<boolean> => {
    if (!user?.id) return false;
    
    try {
      const encryptedEmail = await encryptData(email);
      
      const agentsRef = ref(database, `users/${user.id}/agents`);
      const emailQuery = query(agentsRef, orderByChild('email'), equalTo(encryptedEmail));
      const snapshot = await get(emailQuery);
      
      return snapshot.exists();
    } catch (error) {
      console.error('Error checking agent existence:', error);
      return false;
    }
  };

  const sendVerificationEmail = async (authUid: string, email: string) => {
    try {
      // Get the current user
      const user = auth.currentUser;
      
      if (user && user.uid === authUid) {
        await sendEmailVerification(user);
        setVerificationSent(true);
        toast.success('Verification email sent to agent');
        return true;
      } else {
        // Sign in with the agent's credentials to send verification
        // Note: This is a workaround and not recommended for production
        // In a real app, you should use a cloud function to send verification emails
        toast.info('Please ask the agent to verify their email from the sign-in page');
        return true;
      }
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      toast.error('Failed to send verification email');
      return false;
    }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting || isDecrypting) return;

    if (!user?.id) {
      toast.error('You must be logged in to manage agents');
      return;
    }

    if (!formData.email || !formData.name || !formData.designation) {
      toast.error('Name, email, and designation are required');
      return;
    }

    // Validate name
    if (!validateName(formData.name)) {
      toast.error('Name contains invalid characters or is too long');
      return;
    }

    // Validate designation
    if (!validateDesignation(formData.designation)) {
      toast.error('Designation contains invalid characters or is too long');
      return;
    }

    // Validate phone
    if (formData.phone && formData.countryCode && !validatePhone(formData.phone, formData.countryCode)) {
      toast.error('Phone number is invalid');
      return;
    }

    if (!agent) {
      if (!formData.password) {
        toast.error('Password is required for new agents');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      // Validate password against policy
      if (!validatePassword(formData.password)) {
        toast.error('Password does not meet the requirements');
        return;
      }
    }

    setIsSubmitting(true);
    setAuthError(null);

    try {
      if (!agent) {
        const agentExists = await checkAgentExists(formData.email);
        if (agentExists) {
          toast.error('An agent with this email already exists');
          setIsSubmitting(false);
          return;
        }
      }

      if (!agent) {
        const agentLimitRef = ref(database, `users/${adminId}/agentLimit`);
        const agentsRef = ref(database, `users/${adminId}/agents`);

        const [limitSnap, agentsSnap] = await Promise.all([
          get(agentLimitRef),
          get(agentsRef),
        ]);

        const agentLimit = limitSnap.exists() ? Number(limitSnap.val()) : 0;
        const currentAgentCount = agentsSnap.exists() 
          ? Object.keys(agentsSnap.val()).length 
          : 0;

        if (currentAgentCount >= agentLimit) {
          setIsSubmitting(false);
          setShowModal(true);
          onClose();
          return;
        }
      }

      let authUid = agent?.authUid;

      if (!agent && !verificationSent) {
        try {
          // Create user in Firebase Auth
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            formData.email,
            formData.password!
          );
          authUid = userCredential.user.uid;
          
          // Send verification email
          const emailSent = await sendVerificationEmail(authUid, formData.email);
          
          if (emailSent) {
            // Store the pending agent data to be saved after verification
            const fullPhoneNumber = formData.countryCode && formData.phone 
              ? `${formData.countryCode} ${formData.phone}` 
              : formData.phone || '';

            const newAgent: Agent = {
              id: authUid,
              authUid: authUid,
              name: formData.name || '',
              email: formData.email || '',
              phone: fullPhoneNumber,
              designation: formData.designation || '',
              password: formData.password,
              status: (formData.status as Agent['status']) || 'active',
              assignedLeads: formData.assignedLeads || 0,
              birthDate: formData.birthDate || '',
              createdAt: format(new Date(), 'yyyy-MM-dd'),
              lastUpdated: format(new Date(), 'yyyy-MM-dd'),
              lastLogin: '',
              logoutTime: '',
              emailVerified: false
            };

            setPendingAgent({ agent: newAgent, authUid });
            setIsSubmitting(false);
            return;
          } else {
            // Delete the user if verification email failed
            if (authUid) {
              const user = auth.currentUser;
              if (user && user.uid === authUid) {
                await deleteUser(user);
              }
            }
            setIsSubmitting(false);
            return;
          }
        } catch (error: any) {
          console.error('Auth error:', error);
          let errorMessage = 'Failed to create auth account';
          
          if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Email already in use';
          } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters';
          }
          
          setAuthError(errorMessage);
          toast.error(errorMessage);
          setIsSubmitting(false);
          return;
        }
      }

      // If verification was already sent, create the agent in database
      if (verificationSent && pendingAgent) {
        const encryptedAgent = await encryptAgent(pendingAgent.agent);

        const agentRef = ref(database, `users/${user.id}/agents/${pendingAgent.authUid}`);
        await set(agentRef, encryptedAgent);

        toast.success('Agent created successfully');
        onSubmit(pendingAgent.agent);
        onClose();
        setVerificationSent(false);
        setPendingAgent(null);
      } else if (agent) {
        // For editing existing agent
        const fullPhoneNumber = formData.countryCode && formData.phone 
          ? `${formData.countryCode} ${formData.phone}` 
          : formData.phone || '';

        const updatedAgent: Agent = {
          id: agent.id,
          authUid: agent.authUid,
          name: formData.name || '',
          email: formData.email || '',
          phone: fullPhoneNumber,
          designation: formData.designation || '',
          password: formData.password,
          status: (formData.status as Agent['status']) || 'active',
          assignedLeads: formData.assignedLeads || 0,
          birthDate: formData.birthDate || '',
          createdAt: agent.createdAt,
          lastUpdated: format(new Date(), 'yyyy-MM-dd'),
          lastLogin: formData.lastLogin || agent.lastLogin || '',
          logoutTime: formData.logoutTime || agent.logoutTime || '',
          emailVerified: agent.emailVerified || false
        };

        const encryptedAgent = await encryptAgent(updatedAgent);

        const agentRef = ref(database, `users/${user.id}/agents/${agent.id}`);
        await set(agentRef, encryptedAgent);

        toast.success('Agent updated successfully');
        onSubmit(updatedAgent);
        onClose();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(`Failed to ${agent ? 'update' : 'create'} agent`);
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    isDecrypting,
    user,
    agent,
    formData,
    adminId,
    onSubmit,
    onClose,
    verificationSent,
    pendingAgent
  ]);

  if (isDecrypting) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px] neuro border-none">
          <div className="flex justify-center items-center h-32">
            Decrypting agent data...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] neuro border-none max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agent ? 'Edit Agent' : 'Add New Agent'}</DialogTitle>
        </DialogHeader>
        {authError && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-center">
            {authError}
          </div>
        )}
        {verificationSent && (
          <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded-md text-center">
            Verification email sent. Please ask the agent to verify their email before proceeding.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              name="name"
              className="neuro-inset focus:shadow-none"
              value={formData.name}
              onChange={handleChange}
              required
              maxLength={50}
              disabled={verificationSent && !agent}
            />
            {nameError && (
              <p className="text-red-600 text-xs mt-1">{nameError}</p>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                className="neuro-inset focus:shadow-none"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={verificationSent && !agent}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <div className="flex gap-2">
                <Select 
                  value={formData.countryCode}
                  onValueChange={(value) => handleSelectChange('countryCode', value)}
                  disabled={verificationSent && !agent}
                >
                  <SelectTrigger className="w-[90px] neuro-inset focus:shadow-none">
                    <SelectValue placeholder="+1" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] overflow-y-auto">
                    {countryCodes.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.code} ({country.country})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="phone"
                  name="phone"
                  className="neuro-inset focus:shadow-none flex-1"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder="1234567890"
                  disabled={verificationSent && !agent}
                />
              </div>
              {phoneError && (
                <p className="text-red-600 text-xs mt-1">{phoneError}</p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="birthDate">Birth Date </Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !birthDate && "text-muted-foreground"
                  )}
                  disabled={verificationSent && !agent}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {birthDate ? format(birthDate, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2 z-50" align="start">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const currentDate = birthDate || new Date();
                        const newYear = getYear(currentDate) - 1;
                        const newDate = setYear(currentDate, newYear);
                        if (isDateValidFor18Plus(newDate)) {
                          handleBirthDateChange(newDate);
                        }
                      }}
                      disabled={getYear(birthDate || new Date()) <= new Date().getFullYear() - 120}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Select
                      value={birthDate ? getYear(birthDate).toString() : (new Date().getFullYear() - 18).toString()}
                      onValueChange={(value) => {
                        const newYear = parseInt(value);
                        const currentDate = birthDate || new Date();
                        const newDate = setYear(currentDate, newYear);
                        if (isDateValidFor18Plus(newDate)) {
                          handleBirthDateChange(newDate);
                        }
                      }}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto">
                        {generateYears(new Date().getFullYear() - 120, new Date().getFullYear() - 18).map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const currentDate = birthDate || new Date();
                        const newYear = getYear(currentDate) + 1;
                        const newDate = setYear(currentDate, newYear);
                        if (isDateValidFor18Plus(newDate)) {
                          handleBirthDateChange(newDate);
                        }
                      }}
                      disabled={getYear(birthDate || new Date()) >= new Date().getFullYear() - 18}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <Select
                    value={birthDate ? getMonth(birthDate).toString() : getMonth(new Date()).toString()}
                    onValueChange={(value) => {
                      const newMonth = parseInt(value);
                      const currentDate = birthDate || new Date();
                      const newDate = setMonth(currentDate, newMonth);
                      if (isDateValidFor18Plus(newDate)) {
                        handleBirthDateChange(newDate);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month, index) => {
                        const currentDate = birthDate || new Date();
                        const isFutureMonth = 
                          getYear(currentDate) === new Date().getFullYear() - 18 && 
                          index > getMonth(new Date());
                        return (
                          <SelectItem 
                            key={month} 
                            value={index.toString()}
                            disabled={isFutureMonth}
                          >
                            {month}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ 
                      length: getDaysInMonth(
                        getYear(birthDate || new Date()),
                        getMonth(birthDate || new Date())
                      ) 
                    }, (_, i) => {
                      const day = i + 1;
                      const currentDate = birthDate || new Date();
                      const selectedDate = new Date(
                        getYear(currentDate),
                        getMonth(currentDate),
                        day
                      );
                      const isFutureDate = !isDateValidFor18Plus(selectedDate);
                      const isCurrentDay = birthDate && getDate(birthDate) === day;
                      
                      return (
                        <Button
                          key={day}
                          variant={isCurrentDay ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            if (!isFutureDate) {
                              handleBirthDateChange(setDate(currentDate, day));
                            }
                          }}
                          className={cn(
                            "h-8 w-8 p-0",
                            isFutureDate && "opacity-50 cursor-not-allowed"
                          )}
                          disabled={isFutureDate}
                        >
                          {day}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <div className="flex justify-end pt-2 border-t">
                    <Button 
                      type="button" 
                      size="sm" 
                      onClick={() => setCalendarOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {!agent && (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">Password {!agent ? '*' : ''}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className="neuro-inset focus:shadow-none pr-10"
                    value={formData.password || ''}
                    onChange={handleChange}
                    required={!agent}
                    disabled={verificationSent}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={verificationSent}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
                
                {/* Password policy requirements */}
                {formData.password && (
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
                      <li className={`flex itemsCenter ${passwordErrors.hasSpecialChar ? 'text-green-600' : 'text-red-600'}`}>
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
                <Label htmlFor="confirmPassword">
                  {!agent ? 'Confirm Password *' : 'Confirm Password'}
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    className="neuro-inset focus:shadow-none pr-10"
                    value={formData.confirmPassword || ''}
                    onChange={handleChange}
                    required={!agent}
                    disabled={verificationSent}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={verificationSent}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-red-600 text-xs mt-1">Passwords do not match</p>
                )}
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="designation">Designation *</Label>
              <Input
                id="designation"
                name="designation"
                className="neuro-inset focus:shadow-none"
                value={formData.designation}
                onChange={handleChange}
                required
                maxLength={50}
                disabled={verificationSent && !agent}
              />
              {designationError && (
                <p className="text-red-600 text-xs mt-1">{designationError}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select 
                value={formData.status}
                onValueChange={(value) => handleSelectChange('status', value)}
                disabled={verificationSent && !agent}
              >
                <SelectTrigger className="neuro-inset focus:shadow-none">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter className="pt-4">
            <Button 
              type="button"
              variant="outline"
              onClick={onClose}
              className="neuro hover:shadow-none transition-all duration-300"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="neuro hover:shadow-none transition-all duration-300"
              disabled={isSubmitting || isDecrypting || !!nameError || !!designationError || !!phoneError}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {verificationSent ? 'Completing...' : (agent ? 'Updating...' : 'Creating...')}
                </span>
              ) : verificationSent ? (
                'Complete Registration'
              ) : (
                agent ? 'Update Agent' : 'Add Agent'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <PlanModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </Dialog>
  );
};