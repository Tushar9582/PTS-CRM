import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, Shield, HelpCircle, Palette, Mail, CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import { ThemeSettings } from './ThemeSettings';
import { ProfileSettings } from './ProfileSettings';
import { HelpFAQs } from './HelpFAQs';
import { useIsMobile } from '@/hooks/use-mobile';
import { Switch } from "@/components/ui/switch";
import { database } from '../../firebase';
import { ref, onValue, update } from 'firebase/database';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8';
const ENCRYPTION_IV_LENGTH = 12;

async function decryptData(encryptedData: string): Promise<string> {
  try {
    if (!encryptedData || typeof encryptedData !== 'string') return encryptedData;
    const mightBeEncrypted = encryptedData.length >= 24 && /^[A-Za-z0-9+/=]+$/.test(encryptedData);
    if (!mightBeEncrypted) return encryptedData;
    const binaryString = atob(encryptedData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    if (bytes.length < ENCRYPTION_IV_LENGTH) throw new Error('Data too short to contain IV');
    const iv = bytes.slice(0, ENCRYPTION_IV_LENGTH);
    const ciphertext = bytes.slice(ENCRYPTION_IV_LENGTH);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(ENCRYPTION_KEY),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedData;
  }
}

async function decryptAgent(agentData: any): Promise<any> {
  if (!agentData) return agentData;
  const decryptedAgent: any = { ...agentData };
  const fieldsToDecrypt = ['name', 'email', 'encryptedName', 'encryptedEmail'];
  await Promise.all(fieldsToDecrypt.map(async (field) => {
    if (decryptedAgent[field]) {
      try {
        const decryptedValue = await decryptData(decryptedAgent[field]);
        if (decryptedValue !== decryptedAgent[field]) {
          const cleanField = field.replace(/^encrypted/, '');
          decryptedAgent[cleanField] = decryptedValue;
        }
      } catch (error) {
        console.error(`Error decrypting ${field}:`, error);
      }
    }
  }));
  return decryptedAgent;
}

interface Agent {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
}

export const SettingsTabs = () => {
  const isMobile = useIsMobile();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [decryptionErrors, setDecryptionErrors] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminStatus = () => {
      const adminKey = localStorage.getItem('adminkey');
      if (!adminKey) {
        toast.error('User not authenticated');
        navigate('/login');
        return;
      }
      const userRole = localStorage.getItem('userRole');
      setIsAdmin(userRole === 'admin');
    };
    checkAdminStatus();
  }, [navigate]);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const fetchAgents = async () => {
      try {
        const adminKey = localStorage.getItem('adminkey');
        if (!adminKey) {
          toast.error('User not authenticated');
          setLoading(false);
          return;
        }

        const agentsRef = ref(database, `users/${adminKey}/agents`);
        const unsubscribe = onValue(agentsRef, async (snapshot) => {
          const agentsData = snapshot.val();
          if (agentsData) {
            const decryptedAgents: Agent[] = [];
            const errors: string[] = [];
            for (const [id, agentData] of Object.entries(agentsData)) {
              try {
                const decryptedAgent = await decryptAgent(agentData);
                decryptedAgents.push({
                  id,
                  name: decryptedAgent.name || 'No Name',
                  email: decryptedAgent.email || 'No Email',
                  status: decryptedAgent.status || 'inactive'
                });
              } catch (error) {
                console.error(`Error decrypting agent ${id}:`, error);
                errors.push(`Agent ${id}: Partial data may be encrypted`);
                decryptedAgents.push({
                  id,
                  name: (agentData as any).name || 'No Name',
                  email: (agentData as any).email || 'No Email',
                  status: (agentData as any).status || 'inactive'
                });
              }
            }
            setAgents(decryptedAgents);
            if (errors.length > 0) setDecryptionErrors(errors);
          } else {
            setAgents([]);
          }
          setLoading(false);
        });
        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching agents:', error);
        toast.error('Failed to fetch agents');
        setLoading(false);
      }
    };
    fetchAgents();
  }, [isAdmin]);

  const handleStatusChange = async (agentId: string, newStatus: 'active' | 'inactive') => {
    try {
      const adminKey = localStorage.getItem('adminkey');
      if (!adminKey) {
        toast.error('User not authenticated');
        return;
      }
      const agentRef = ref(database, `users/${adminKey}/agents/${agentId}`);
      await update(agentRef, {
        status: newStatus,
        lastUpdated: new Date().toISOString()
      });
      setAgents(agents.map(agent => 
        agent.id === agentId ? { ...agent, status: newStatus } : agent
      ));
      toast.success(`Agent ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error updating agent status:', error);
      toast.error('Failed to update agent status');
    }
  };

  const tabs = [
    { value: 'profile', icon: User, label: 'Profile' },
    { value: 'appearance', icon: Palette, label: 'Appearance' },
    ...(isAdmin ? [{ value: 'agents', icon: Shield, label: 'Agents' }] : []),
    { value: 'help', icon: HelpCircle, label: 'Help' }
  ];

  return (
    <Tabs defaultValue="profile" className="w-full">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <TabsList className={`w-full neuro border-none rounded-none ${isMobile ? 'flex' : 'grid'}`} 
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => (
            <TabsTrigger 
              key={tab.value}
              value={tab.value}
              className={`py-1 px-3 flex items-center justify-center gap-2
                data-[state=active]:neuro-inset data-[state=active]:shadow-none
                rounded-none border-b-2 border-transparent data-[state=active]:border-primary
                ${isMobile ? 'flex-1 min-w-0' : ''}`}
            >
              <tab.icon className="h-3 w-3" />
              {!isMobile && <span>{tab.label}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <div className="p-4 md:p-6">
        {isMobile && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              {{
                'profile': 'Profile Settings',
                'appearance': 'Appearance Settings',
                'agents': 'Agents Management',
                'help': 'Help Center'
              }[document.querySelector('[data-state="active"][data-orientation="horizontal"]')?.getAttribute('value') || 'profile']}
            </h2>
          </div>
        )}

        <TabsContent value="profile">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="appearance">
          <ThemeSettings />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="agents">
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold">Agents Management</h3>
                <p className="text-muted-foreground">Manage your active and inactive agents</p>
              </div>
              
              {decryptionErrors.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
                  <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Decryption Notice</h3>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        Some agent data couldn't be decrypted properly. Information may appear incomplete.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : agents.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Shield className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">No agents found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between p-4 neuro rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          agent.status === 'active' 
                            ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400' 
                            : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                        }`}>
                          {agent.status === 'active' ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <XCircle className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium">{agent.name}</h4>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            {agent.email}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={agent.status === 'active'}
                        onCheckedChange={(checked) => 
                          handleStatusChange(agent.id, checked ? 'active' : 'inactive')
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="help">
          <HelpFAQs />
        </TabsContent>
      </div>
    </Tabs>
  );
};