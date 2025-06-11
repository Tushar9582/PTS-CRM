
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, Bell, Shield, HelpCircle, Database, Palette
} from 'lucide-react';
import { ThemeSettings } from './ThemeSettings';
import { StorageSettings } from './StorageSettings';
import { ProfileSettings } from './ProfileSettings';
import { NotificationSettings } from './NotificationSettings';
import { HelpFAQs } from './HelpFAQs';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';

export const SettingsTabs = () => {
  const isMobile = useIsMobile();
  
  return (
    <Tabs defaultValue="profile" className="space-y-4">
      <TabsList className={`neuro border-none h-auto ${isMobile ? 'flex flex-wrap' : 'grid grid-cols-6'}`}>
        <TabsTrigger value="profile" className="data-[state=active]:neuro-inset py-2 px-4 flex items-center">
          <User className="h-4 w-4 mr-2" />
          {isMobile ? '' : 'Profile'}
        </TabsTrigger>
        {/* <TabsTrigger value="notifications" className="data-[state=active]:neuro-inset py-2 px-4 flex items-center">
          <Bell className="h-4 w-4 mr-2" />
          {isMobile ? '' : 'Notifications'}
        </TabsTrigger> */}
        <TabsTrigger value="appearance" className="data-[state=active]:neuro-inset py-2 px-4 flex items-center">
          <Palette className="h-4 w-4 mr-2" />
          {isMobile ? '' : 'Appearance'}
        </TabsTrigger>
        {/* <TabsTrigger value="storage" className="data-[state=active]:neuro-inset py-2 px-4 flex items-center">
          <Database className="h-4 w-4 mr-2" />
          {isMobile ? '' : 'Storage'}
        </TabsTrigger> */}
        <TabsTrigger value="security" className="data-[state=active]:neuro-inset py-2 px-4 flex items-center">
          <Shield className="h-4 w-4 mr-2" />
          {isMobile ? '' : 'Security'}
        </TabsTrigger>
        <TabsTrigger value="help" className="data-[state=active]:neuro-inset py-2 px-4 flex items-center">
          <HelpCircle className="h-4 w-4 mr-2" />
          {isMobile ? '' : 'Help & FAQs'}
        </TabsTrigger>
      </TabsList>

      {isMobile && (
        <div className="mb-2 text-center">
          <h2 className="text-sm font-medium">
            {
              {
                'profile': 'Profile Settings',
                // 'notifications': 'Notification Settings',
                'appearance': 'Appearance Settings',
                // 'storage': 'Storage Settings',
                'security': 'Security Settings',
                'help': 'Help & FAQs'
              }[document.querySelector('[data-state="active"][data-orientation="horizontal"]')?.getAttribute('value') || 'profile']
            }
          </h2>
        </div>
      )}

      <TabsContent value="profile">
        <ProfileSettings />
      </TabsContent>

      <TabsContent value="notifications">
        <NotificationSettings />
      </TabsContent>

      <TabsContent value="appearance">
        <ThemeSettings />
      </TabsContent>

      <TabsContent value="storage">
        <StorageSettings />
      </TabsContent>

      <TabsContent value="security">
        <div className="neuro border-none p-6">
          <h3 className="text-xl font-semibold mb-4">Security Settings</h3>
          <p className="text-muted-foreground">Configure your security preferences.</p>
          
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between p-4 neuro-inset rounded-md">
              <div>
                <h4 className="font-medium">Two-Factor Authentication</h4>
                <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
              </div>
              <Button variant="outline" className="neuro">Enable</Button>
            </div>

            <div className="flex items-center justify-between p-4 neuro-inset rounded-md">
              <div>
                <h4 className="font-medium">Login History</h4>
                <p className="text-sm text-muted-foreground">View your recent login activity</p>
              </div>
              <Button variant="outline" className="neuro">View</Button>
            </div>

            <div className="flex items-center justify-between p-4 neuro-inset rounded-md">
              <div>
                <h4 className="font-medium">Active Sessions</h4>
                <p className="text-sm text-muted-foreground">Manage your active sessions</p>
              </div>
              <Button variant="outline" className="neuro">Manage</Button>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="help">
        <HelpFAQs />
      </TabsContent>
    </Tabs>
  );
};
