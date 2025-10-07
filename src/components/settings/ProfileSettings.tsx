import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Camera, Mail, Phone, Lock, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { database } from '../../firebase';
import { ref, get, update } from 'firebase/database';

// Encryption configuration
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8'; // 32 chars for AES-256
const ENCRYPTION_IV_LENGTH = 12; // 12 bytes for AES-GCM IV

// Country codes with flags and dial codes
const COUNTRY_CODES = [
  { code: 'US', dialCode: '+1', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'IN', dialCode: '+91', name: 'India', flag: '🇮🇳' },
  { code: 'AU', dialCode: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: 'CA', dialCode: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: 'DE', dialCode: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', dialCode: '+33', name: 'France', flag: '🇫🇷' },
  { code: 'JP', dialCode: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: 'BR', dialCode: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: 'CN', dialCode: '+86', name: 'China', flag: '🇨🇳' },
  { code: 'RU', dialCode: '+7', name: 'Russia', flag: '🇷🇺' },
  { code: 'MX', dialCode: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: 'ZA', dialCode: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: 'AE', dialCode: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'SG', dialCode: '+65', name: 'Singapore', flag: '🇸🇬' },
];

// Function to get country flag from country code
const getCountryFlag = (countryCode: string): string => {
  const country = COUNTRY_CODES.find(c => c.dialCode === countryCode);
  return country ? country.flag : '🇺🇸'; // Default to US flag
};

// Improved decryption function
async function decryptData(encryptedData: string): Promise<string> {
  try {
    if (!encryptedData || typeof encryptedData !== 'string') {
      return encryptedData;
    }

    // Check if data looks like it might be encrypted
    const mightBeEncrypted = encryptedData.length >= 24 && 
                            /^[A-Za-z0-9+/=]+$/.test(encryptedData);
    
    if (!mightBeEncrypted) {
      return encryptedData;
    }

    // Convert from base64
    const binaryString = atob(encryptedData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Extract IV and ciphertext
    if (bytes.length < ENCRYPTION_IV_LENGTH) {
      throw new Error('Data too short to contain IV');
    }
    const iv = bytes.slice(0, ENCRYPTION_IV_LENGTH);
    const ciphertext = bytes.slice(ENCRYPTION_IV_LENGTH);

    // Import key
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(ENCRYPTION_KEY),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedData; // Return original if decryption fails
  }
}

// Decrypt agent data with all possible field variations
async function decryptAgentData(data: any): Promise<any> {
  if (!data) return data;

  const result: any = { ...data };
  const fields = [
    'firstName', 'lastName', 'email', 'phone', 'bio', 'avatar', 'countryCode',
    'name', 'encryptedName', 'encryptedFirstName', 'encryptedLastName',
    'encryptedEmail', 'encryptedPhone', 'encryptedBio', 'encryptedAvatar', 'encryptedCountryCode'
  ];

  // Decrypt all possible fields
  await Promise.all(fields.map(async (field) => {
    if (data[field]) {
      try {
        const decrypted = await decryptData(data[field]);
        if (decrypted !== data[field]) {
          // Store in both formats (original and decrypted)
          const cleanField = field.replace(/^encrypted/, '');
          result[cleanField] = decrypted;
          result[field] = decrypted;
        }
      } catch (error) {
        console.error(`Error decrypting ${field}:`, error);
      }
    }
  }));

  // Handle name field if firstName/lastName not available
  if (result.name && !result.firstName) {
    const [firstName, ...lastName] = result.name.split(' ');
    result.firstName = firstName || '';
    result.lastName = lastName.join(' ') || '';
  }

  return result;
}

export const ProfileSettings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionErrors, setDecryptionErrors] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    countryCode: '+1',
    phone: '',
    avatar: '/placeholder.svg',
    bio: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (!user) return;

        console.log('Fetching profile data for user:', user.id, 'Role:', user.role);

        // Start with auth context data
        const initialData = {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          countryCode: '+1',
          phone: '',
          avatar: '/placeholder.svg',
          bio: '',
          password: '',
          confirmPassword: ''
        };

        setFormData(initialData);

        const adminId = localStorage.getItem('adminkey');
        const agentId = localStorage.getItem('agentkey');
        const errors: string[] = [];

        if (user.role === 'admin') {
          console.log('Admin profile loading...');
          
          // Admin path - no encryption
          try {
            const userRef = ref(database, `users/${user.id}/usersdetails`);
            const snapshot = await get(userRef);
            
            if (snapshot.exists()) {
              const userData = snapshot.val();
              console.log('Admin profile data found:', userData);
              
              setFormData(prev => ({
                ...prev,
                firstName: userData.firstName || prev.firstName,
                lastName: userData.lastName || prev.lastName,
                email: userData.email || prev.email,
                phone: userData.phone || prev.phone,
                countryCode: userData.countryCode || prev.countryCode,
                avatar: userData.avatar || prev.avatar,
                bio: userData.bio || prev.bio
              }));
            } else {
              console.log('No admin profile data found, using auth context data');
              // If no profile data exists, create initial profile with auth data
              await update(ref(database, `users/${user.id}/usersdetails`), {
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                phone: '',
                countryCode: '+1',
                avatar: '/placeholder.svg',
                bio: '',
                createdAt: new Date().toISOString()
              });
            }
          } catch (error) {
            console.error('Error loading admin profile:', error);
            errors.push('Failed to load admin profile data');
          }
        } else if (user.role === 'agent' && adminId) {
          // Agent path - needs decryption
          setIsDecrypting(true);
          setDecryptionErrors([]);
          
          try {
            console.log('Loading agent profile for admin:', adminId, 'agent:', user.id);
            
            const [agentSnapshot, detailsSnapshot] = await Promise.all([
              get(ref(database, `users/${adminId}/agents/${user.id}`)),
              get(ref(database, `users/${adminId}/agents/${user.id}/usersdetails`))
            ]);

            let agentData = {};
            let detailsData = {};

            if (agentSnapshot.exists()) {
              agentData = await decryptAgentData(agentSnapshot.val());
              console.log('Decrypted agent data:', agentData);
            }

            if (detailsSnapshot?.exists()) {
              detailsData = await decryptAgentData(detailsSnapshot.val());
              console.log('Decrypted agent details:', detailsData);
            }

            // Merge data with details taking precedence
            const mergedData = { ...agentData, ...detailsData };

            setFormData(prev => ({
              ...prev,
              firstName: mergedData.firstName || prev.firstName,
              lastName: mergedData.lastName || prev.lastName,
              email: mergedData.email || prev.email,
              countryCode: mergedData.countryCode || prev.countryCode,
              phone: mergedData.phone || prev.phone,
              avatar: mergedData.avatar || prev.avatar,
              bio: mergedData.bio || prev.bio
            }));

          } catch (error) {
            console.error('Decryption error:', error);
            errors.push('Failed to decrypt some profile data');
          } finally {
            setIsDecrypting(false);
            if (errors.length > 0) {
              setDecryptionErrors(errors);
            }
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        toast.error('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  // Encryption function for saving data
  const encryptData = async (data: string): Promise<string> => {
    if (!data) return data;
    
    try {
      const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_IV_LENGTH));
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(ENCRYPTION_KEY),
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(data)
      );
      
      // Combine IV and encrypted data
      const combined = new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      return data;
    }
  };

  // Validate phone number format
  const validatePhoneNumber = (phone: string): boolean => {
    // Remove any non-digit characters
    const cleanedPhone = phone.replace(/\D/g, '');
    
    // Check if it's exactly 10 digits
    if (cleanedPhone.length !== 10) {
      setPhoneError('Phone number must be exactly 10 digits');
      return false;
    }
    
    // Check if it starts with a valid digit (not 0)
    if (cleanedPhone.startsWith('0')) {
      setPhoneError('Phone number cannot start with 0');
      return false;
    }
    
    setPhoneError('');
    return true;
  };

  const handleSave = async () => {
    if (!user) return;

    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error("Passwords don't match!");
      return;
    }

    // Validate phone number if provided
    if (formData.phone && !validatePhoneNumber(formData.phone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      const adminId = localStorage.getItem('adminkey');

      // Handle avatar upload - store as base64 in Realtime Database
      let avatarUrl = formData.avatar;
      if (avatarFile) {
        // Validate file type
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validImageTypes.includes(avatarFile.type)) {
          toast.error('Please select a valid image file (JPEG, JPG, PNG, GIF, WEBP)');
          setLoading(false);
          return;
        }

        // Validate file size (max 5MB)
        if (avatarFile.size > 5 * 1024 * 1024) {
          toast.error('Image size should be less than 5MB');
          setLoading(false);
          return;
        }

        // Convert to base64 for storage in Realtime Database
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            avatarUrl = e.target.result as string;
          }
        };
        reader.readAsDataURL(avatarFile);
        
        // Wait for the file to be read
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('Saving profile data for user:', user.id, 'Role:', user.role);

      if (user.role === 'admin') {
        // Admin update (unencrypted)
        const adminUpdates = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          countryCode: formData.countryCode,
          bio: formData.bio,
          email: formData.email,
          avatar: avatarUrl,
          updatedAt: new Date().toISOString()
        };

        console.log('Saving admin data:', adminUpdates);
        
        await update(ref(database, `users/${user.id}/usersdetails`), adminUpdates);
        
        // Also update the main user node for quick access
        await update(ref(database, `users/${user.id}`), {
          email: formData.email,
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          updatedAt: new Date().toISOString()
        });

      } else if (user.role === 'agent' && adminId) {
        // Agent update (encrypted)
        const encryptedUpdates = {
          firstName: await encryptData(formData.firstName),
          lastName: await encryptData(formData.lastName),
          email: await encryptData(formData.email),
          countryCode: await encryptData(formData.countryCode),
          phone: await encryptData(formData.phone),
          bio: await encryptData(formData.bio),
          avatar: await encryptData(avatarUrl),
          name: await encryptData(`${formData.firstName} ${formData.lastName}`.trim())
        };

        console.log('Saving encrypted agent data');

        // Prepare all updates
        const updates: Record<string, any> = {
          [`users/${adminId}/agents/${user.id}/encryptedName`]: encryptedUpdates.name,
          [`users/${adminId}/agents/${user.id}/encryptedEmail`]: encryptedUpdates.email,
          [`users/${adminId}/agents/${user.id}/encryptedPhone`]: encryptedUpdates.phone,
          [`users/${adminId}/agents/${user.id}/encryptedCountryCode`]: encryptedUpdates.countryCode,
          [`users/${adminId}/agents/${user.id}/updatedAt`]: new Date().toISOString(),
          [`users/${adminId}/agents/${user.id}/usersdetails`]: {
            encryptedFirstName: encryptedUpdates.firstName,
            encryptedLastName: encryptedUpdates.lastName,
            encryptedEmail: encryptedUpdates.email,
            encryptedPhone: encryptedUpdates.phone,
            encryptedCountryCode: encryptedUpdates.countryCode,
            encryptedBio: encryptedUpdates.bio,
            encryptedAvatar: encryptedUpdates.avatar,
            updatedAt: new Date().toISOString()
          }
        };

        await update(ref(database), updates);
      }

      toast.success('Profile updated successfully');
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      setAvatarFile(null); // Reset avatar file after save
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      // Only allow digits and limit to 10 characters
      const cleanedValue = value.replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({
        ...prev,
        [name]: cleanedValue
      }));
      
      // Validate as user types
      if (cleanedValue) {
        validatePhoneNumber(cleanedValue);
      } else {
        setPhoneError('');
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleCountryCodeChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      countryCode: value
    }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validImageTypes.includes(file.type)) {
        toast.error('Please select a valid image file (JPEG, JPG, PNG, GIF, WEBP)');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      
      setAvatarFile(file);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormData(prev => ({
            ...prev,
            avatar: event.target.result as string
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const togglePasswordVisibility = (field: 'password' | 'confirmPassword') => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else {
      setShowConfirmPassword(!showConfirmPassword);
    }
  };

  if (loading || isDecrypting) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm sm:text-base">{isDecrypting ? 'Decrypting profile data...' : 'Loading profile...'}</p>
        {decryptionErrors.length > 0 && (
          <div className="text-yellow-600 text-xs sm:text-sm mt-2 text-center px-4">
            Note: Some data may not display correctly
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="neuro border-none w-full max-w-4xl mx-auto">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-lg sm:text-xl md:text-2xl">Profile Settings</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          {user?.role === 'agent' ? 'Agent Profile' : 'Admin Profile'}
        </CardDescription>
      </CardHeader>
      
      {decryptionErrors.length > 0 && (
        <div className="mx-4 sm:mx-6 mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-3 sm:p-4 rounded-r-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-xs sm:text-sm font-medium text-yellow-800">Data Notice</h3>
              <div className="mt-1 text-xs sm:text-sm text-yellow-700">
                <p>Some profile data couldn't be decrypted properly. Contact support if information appears incorrect.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
        {/* Avatar and Basic Info Section */}
        <div className="flex flex-col items-center sm:items-start sm:flex-row gap-4 sm:gap-6">
          {/* Avatar Upload Section */}
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <label htmlFor="avatar-upload" className="cursor-pointer">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 relative group">
                <AvatarImage src={formData.avatar} alt={`${formData.firstName} ${formData.lastName}`} />
                <AvatarFallback className="text-lg sm:text-xl md:text-2xl">
                  {formData.firstName?.charAt(0)}{formData.lastName?.charAt(0)}
                </AvatarFallback>
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
              </Avatar>
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/jpeg, image/jpg, image/png, image/gif, image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <span className="text-xs text-muted-foreground text-center max-w-[140px] sm:max-w-none">
              Click to change<br />(JPEG, JPG, PNG, GIF, WEBP)<br />Max 5MB
            </span>
          </div>
          
          {/* Basic Info Form */}
          <div className="space-y-3 sm:space-y-4 flex-1 w-full">
            {/* Name Fields */}
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="flex items-center gap-2 text-xs sm:text-sm">
                  <User className="h-3 w-3 sm:h-4 sm:w-4" />
                  First Name
                </Label>
                <Input 
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="neuro-inset focus:shadow-none text-sm sm:text-base h-9 sm:h-10"
                  placeholder="Enter first name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lastName" className="flex items-center gap-2 text-xs sm:text-sm">
                  <User className="h-3 w-3 sm:h-4 sm:w-4" />
                  Last Name
                </Label>
                <Input 
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="neuro-inset focus:shadow-none text-sm sm:text-base h-9 sm:h-10"
                  placeholder="Enter last name"
                />
              </div>
            </div>
            
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-xs sm:text-sm">
                <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
                Email Address
              </Label>
              <Input 
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="neuro-inset focus:shadow-none text-sm sm:text-base h-9 sm:h-10"
                placeholder="your.email@example.com"
              />
            </div>
            
            {/* Phone Field with Country Code */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2 text-xs sm:text-sm">
                <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                Phone Number
              </Label>
              <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 items-stretch xs:items-center">
                {/* Country Code Selector */}
                <div className="w-full xs:w-auto">
                  <Select value={formData.countryCode} onValueChange={handleCountryCodeChange}>
                    <SelectTrigger className="w-full xs:w-[140px] neuro-inset h-9 sm:h-10 text-sm">
                      <div className="flex items-center gap-2 w-full">
                        <span className="text-base sm:text-lg flex-shrink-0">{getCountryFlag(formData.countryCode)}</span>
                        <span className="text-xs sm:text-sm font-medium truncate">{formData.countryCode}</span>
                        <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 ml-auto flex-shrink-0" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-h-60 w-[280px] sm:w-[320px]">
                      {COUNTRY_CODES.map((country) => (
                        <SelectItem key={country.code} value={country.dialCode} className="py-2 sm:py-3 text-sm">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className="text-base sm:text-lg flex-shrink-0">{country.flag}</span>
                            <span className="font-medium text-xs sm:text-sm">{country.dialCode}</span>
                            <span className="text-muted-foreground text-xs sm:text-sm flex-1 truncate">{country.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Phone Input */}
                <div className="flex-1 relative">
                  <Input 
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="neuro-inset focus:shadow-none text-sm sm:text-base h-9 sm:h-10 pr-12"
                    placeholder="1234567890"
                    maxLength={10}
                  />
                  {formData.phone && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {formData.phone.length}/10
                    </div>
                  )}
                </div>
              </div>
              {phoneError && (
                <p className="text-xs text-red-500 mt-1">{phoneError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter 10-digit phone number without country code
              </p>
            </div>
          </div>
        </div>
        
        {/* Bio Section */}
        <div className="space-y-2">
          <Label htmlFor="bio" className="text-xs sm:text-sm">Professional Bio</Label>
          <textarea 
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            rows={3}
            className="w-full neuro-inset p-3 rounded-md focus:shadow-none focus:outline-none resize-none text-sm sm:text-base min-h-[80px]"
            placeholder="Tell us about yourself and your professional background..."
          />
        </div>

        {/* Password Section - Commented out as per original
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2 text-xs sm:text-sm">
              <Lock className="h-3 w-3 sm:h-4 sm:w-4" />
              Password
            </Label>
            <div className="relative">
              <Input 
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
                className="neuro-inset focus:shadow-none pr-10 text-sm sm:text-base h-9 sm:h-10"
                placeholder="Enter new password"
              />
              <button 
                type="button"
                onClick={() => togglePasswordVisibility('password')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" /> : <Eye className="h-3 w-3 sm:h-4 sm:w-4" />}
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="flex items-center gap-2 text-xs sm:text-sm">
              <Lock className="h-3 w-3 sm:h-4 sm:w-4" />
              Confirm Password
            </Label>
            <div className="relative">
              <Input 
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleChange}
                className="neuro-inset focus:shadow-none pr-10 text-sm sm:text-base h-9 sm:h-10"
                placeholder="Confirm new password"
              />
              <button 
                type="button"
                onClick={() => togglePasswordVisibility('confirmPassword')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" /> : <Eye className="h-3 w-3 sm:h-4 sm:w-4" />}
              </button>
            </div>
          </div>
        </div> */}
      </CardContent>
      
      <CardFooter className="px-4 sm:px-6 pb-4 sm:pb-6">
        <Button 
          onClick={handleSave} 
          className="neuro hover:shadow-none transition-all duration-300 w-full sm:w-auto text-sm sm:text-base h-9 sm:h-10 px-4 sm:px-8"
          disabled={loading || isDecrypting || !!phoneError}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </CardFooter>
    </Card>
  );
};