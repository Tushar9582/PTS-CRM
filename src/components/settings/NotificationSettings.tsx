
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bell, Mail, MessageSquare, Phone, Calendar, UsersRound, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export const NotificationSettings: React.FC = () => {
  const [notifications, setNotifications] = useState({
    email_all: true,
    email_leads: true,
    email_meetings: true,
    email_deals: false,
    
    app_all: true,
    app_leads: true,
    app_tasks: true,
    app_meetings: true,
    app_deals: true,
    
    sms_all: false,
    sms_leads: false,
    sms_meetings: false,
    sms_deals: false,
  });

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications(prev => {
      const newSettings = { ...prev, [key]: !prev[key] };
      
      // If toggling an "all" switch, update related individual settings
      if (key === 'email_all') {
        newSettings.email_leads = newSettings.email_all;
        newSettings.email_meetings = newSettings.email_all;
        newSettings.email_deals = newSettings.email_all;
      } else if (key === 'app_all') {
        newSettings.app_leads = newSettings.app_all;
        newSettings.app_tasks = newSettings.app_all;
        newSettings.app_meetings = newSettings.app_all;
        newSettings.app_deals = newSettings.app_all;
      } else if (key === 'sms_all') {
        newSettings.sms_leads = newSettings.sms_all;
        newSettings.sms_meetings = newSettings.sms_all;
        newSettings.sms_deals = newSettings.sms_all;
      }
      
      return newSettings;
    });
  };

  const handleSave = () => {
    toast.success('Notification preferences saved');
  };

  return (
    <Card className="neuro border-none">
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>
          Configure how you want to be notified about important events.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-8">
          {/* Email Notifications */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-pulse" />
              <h3 className="text-lg font-medium">Email Notifications</h3>
            </div>
            
            <div className="space-y-3 pl-7">
              <div className="flex items-center justify-between">
                <Label htmlFor="email_all" className="cursor-pointer">All email notifications</Label>
                <Switch
                  id="email_all"
                  checked={notifications.email_all}
                  onCheckedChange={() => handleToggle('email_all')}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UsersRound className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="email_leads" className="cursor-pointer">New lead assignments</Label>
                </div>
                <Switch
                  id="email_leads"
                  checked={notifications.email_leads}
                  onCheckedChange={() => handleToggle('email_leads')}
                  disabled={notifications.email_all}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="email_meetings" className="cursor-pointer">Meeting reminders</Label>
                </div>
                <Switch
                  id="email_meetings"
                  checked={notifications.email_meetings}
                  onCheckedChange={() => handleToggle('email_meetings')}
                  disabled={notifications.email_all}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="email_deals" className="cursor-pointer">Deal status updates</Label>
                </div>
                <Switch
                  id="email_deals"
                  checked={notifications.email_deals}
                  onCheckedChange={() => handleToggle('email_deals')}
                  disabled={notifications.email_all}
                />
              </div>
            </div>
          </div>
          
          {/* App Notifications */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-pulse" />
              <h3 className="text-lg font-medium">In-App Notifications</h3>
            </div>
            
            <div className="space-y-3 pl-7">
              <div className="flex items-center justify-between">
                <Label htmlFor="app_all" className="cursor-pointer">All in-app notifications</Label>
                <Switch
                  id="app_all"
                  checked={notifications.app_all}
                  onCheckedChange={() => handleToggle('app_all')}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UsersRound className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="app_leads" className="cursor-pointer">New lead assignments</Label>
                </div>
                <Switch
                  id="app_leads"
                  checked={notifications.app_leads}
                  onCheckedChange={() => handleToggle('app_leads')}
                  disabled={notifications.app_all}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="app_tasks" className="cursor-pointer">Task reminders</Label>
                </div>
                <Switch
                  id="app_tasks"
                  checked={notifications.app_tasks}
                  onCheckedChange={() => handleToggle('app_tasks')}
                  disabled={notifications.app_all}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="app_meetings" className="cursor-pointer">Meeting reminders</Label>
                </div>
                <Switch
                  id="app_meetings"
                  checked={notifications.app_meetings}
                  onCheckedChange={() => handleToggle('app_meetings')}
                  disabled={notifications.app_all}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="app_deals" className="cursor-pointer">Deal status updates</Label>
                </div>
                <Switch
                  id="app_deals"
                  checked={notifications.app_deals}
                  onCheckedChange={() => handleToggle('app_deals')}
                  disabled={notifications.app_all}
                />
              </div>
            </div>
          </div>
          
          {/* SMS Notifications */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Phone className="h-5 w-5 text-pulse" />
              <h3 className="text-lg font-medium">SMS Notifications</h3>
            </div>
            
            <div className="space-y-3 pl-7">
              <div className="flex items-center justify-between">
                <Label htmlFor="sms_all" className="cursor-pointer">All SMS notifications</Label>
                <Switch
                  id="sms_all"
                  checked={notifications.sms_all}
                  onCheckedChange={() => handleToggle('sms_all')}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UsersRound className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="sms_leads" className="cursor-pointer">High priority leads</Label>
                </div>
                <Switch
                  id="sms_leads"
                  checked={notifications.sms_leads}
                  onCheckedChange={() => handleToggle('sms_leads')}
                  disabled={notifications.sms_all}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="sms_meetings" className="cursor-pointer">Urgent meeting changes</Label>
                </div>
                <Switch
                  id="sms_meetings"
                  checked={notifications.sms_meetings}
                  onCheckedChange={() => handleToggle('sms_meetings')}
                  disabled={notifications.sms_all}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="sms_deals" className="cursor-pointer">Deal closures</Label>
                </div>
                <Switch
                  id="sms_deals"
                  checked={notifications.sms_deals}
                  onCheckedChange={() => handleToggle('sms_deals')}
                  disabled={notifications.sms_all}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button onClick={handleSave} className="neuro hover:shadow-none transition-all duration-300">
          Save Preferences
        </Button>
      </CardFooter>
    </Card>
  );
};
