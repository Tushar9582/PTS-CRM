import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Camera, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { database } from '../../firebase';
import { ref, get, update } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export const ProfileSettings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    avatar: '/placeholder.svg',
    bio: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (!user) return;

        // Set basic user info from auth context
        setFormData(prev => ({
          ...prev,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || ''
        }));

        // Fetch additional profile data from database
        let userRef;
        const adminId = localStorage.getItem('adminkey');
        const agentId = localStorage.getItem('agentkey');

        if (user.role === 'admin') {
          // Original admin code remains unchanged
          userRef = ref(database, `users/${user.id}/usersdetails`);
        } else if (user.role === 'agent' && adminId) {
          // Enhanced agent handling
          const agentMainRef = ref(database, `users/${adminId}/agents/${user.id}`);
          const agentDetailsRef = ref(database, `users/${adminId}/agents/${user.id}/usersdetails`);
          
          const [agentSnapshot, detailsSnapshot] = await Promise.all([
            get(agentMainRef),
            get(agentDetailsRef)
          ]);

          if (agentSnapshot.exists()) {
            const agentData = agentSnapshot.val();
            const nameParts = agentData.name?.split(' ') || [];
            setFormData(prev => ({
              ...prev,
              firstName: nameParts[0] || '',
              lastName: nameParts.slice(1).join(' ') || '',
              phone: agentData.phone || '',
              email: agentData.email || user.email || ''
            }));
          }

          if (detailsSnapshot?.exists()) {
            const detailsData = detailsSnapshot.val();
            setFormData(prev => ({
              ...prev,
              avatar: detailsData.avatar || '/placeholder.svg',
              bio: detailsData.bio || '',
              phone: detailsData.phone || prev.phone
            }));
          }
          return;
        }

        // Original admin data fetching
        if (userRef) {
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const userData = snapshot.val();
            setFormData(prev => ({
              ...prev,
              phone: userData.phone || '',
              avatar: userData.avatar || '/placeholder.svg',
              bio: userData.bio || ''
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSave = async () => {
    if (!user) return;

    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error("Passwords don't match!");
      return;
    }

    try {
      setLoading(true);
      let updates: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        bio: formData.bio,
        email: formData.email
      };

      // Handle avatar upload
      if (avatarFile) {
        const storage = getStorage();
        const fileRef = storageRef(storage, `avatars/${user.id}/${avatarFile.name}`);
        await uploadBytes(fileRef, avatarFile);
        const downloadURL = await getDownloadURL(fileRef);
        updates.avatar = downloadURL;
      }

      // Determine the correct path based on user role
      let updatePath;
      const adminId = localStorage.getItem('adminkey');

      if (user.role === 'admin') {
        // Original admin update logic
        updatePath = `users/${user.id}/usersdetails`;
      } else if (user.role === 'agent' && adminId) {
        // Enhanced agent update logic
        updatePath = `users/${adminId}/agents/${user.id}/usersdetails`;
        
        // Update main agent data
        await update(ref(database, `users/${adminId}/agents/${user.id}`), {
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          phone: formData.phone,
          email: formData.email
        });
      } else {
        throw new Error('Invalid user role or missing admin ID');
      }

      // Update the database
      await update(ref(database, updatePath), updates);
      toast.success('Profile updated successfully');
      
      // Clear password fields
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormData({
            ...formData,
            avatar: event.target.result as string
          });
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

  if (loading && !formData.firstName) {
    return <div className="flex justify-center items-center h-64">Loading profile...</div>;
  }

  return (
    <Card className="neuro border-none">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          {user?.role === 'agent' ? 'Agent Profile' : 'Admin Profile'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex flex-col items-center space-y-2">
            <label htmlFor="avatar-upload" className="cursor-pointer">
              <Avatar className="h-24 w-24 relative group">
                <AvatarImage src={formData.avatar} alt={`${formData.firstName} ${formData.lastName}`} />
                <AvatarFallback className="text-2xl">
                  {formData.firstName?.charAt(0)}{formData.lastName?.charAt(0)}
                </AvatarFallback>
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="h-8 w-8 text-white" />
                </div>
              </Avatar>
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <span className="text-xs text-muted-foreground">Click to change</span>
          </div>
          
          <div className="space-y-4 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  First Name
                </Label>
                <Input 
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="neuro-inset focus:shadow-none"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lastName" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Last Name
                </Label>
                <Input 
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="neuro-inset focus:shadow-none"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <Input 
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="neuro-inset focus:shadow-none"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number
              </Label>
              <Input 
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="neuro-inset focus:shadow-none"
              />
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="bio">Professional Bio</Label>
          <textarea 
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            rows={4}
            className="w-full neuro-inset p-3 rounded-md focus:shadow-none focus:outline-none resize-none"
          />
        </div>

        {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Password
            </Label>
            <div className="relative">
              <Input 
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
                className="neuro-inset focus:shadow-none pr-10"
                placeholder="Enter new password"
              />
              <button 
                type="button"
                onClick={() => togglePasswordVisibility('password')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Confirm Password
            </Label>
            <div className="relative">
              <Input 
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleChange}
                className="neuro-inset focus:shadow-none pr-10"
                placeholder="Confirm new password"
              />
              <button 
                type="button"
                onClick={() => togglePasswordVisibility('confirmPassword')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div> */}
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={handleSave} 
          className="neuro hover:shadow-none transition-all duration-300"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </CardFooter>
    </Card>
  );
};