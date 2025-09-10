import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  BarChartBig,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  Bell,
  Sun,
  Moon,
  MessageSquare,
  Volume2,
  Volume1,
  Volume,
  VolumeX,
  Languages
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { NotificationDropdown } from '@/components/dashboard/NotificationDropdown';
import { MobileNavBar } from '@/components/mobile/MobileNavBar';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

// Encryption key - should match your encryption key
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8'; // 32 chars for AES-256

// Helper function to decrypt data using Web Crypto API
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
    return encryptedData; // Return original if decryption fails
  }
}

// Function to decrypt user data
async function decryptUser(userData: any): Promise<any> {
  const decryptedUser = { ...userData };
  
  // Decrypt each encrypted field
  if (userData.firstName) decryptedUser.firstName = await decryptData(userData.firstName);
  if (userData.lastName) decryptedUser.lastName = await decryptData(userData.lastName);
  if (userData.email) decryptedUser.email = await decryptData(userData.email);
  if (userData.phone) decryptedUser.phone = await decryptData(userData.phone);
  
  return decryptedUser;
}

// Function to decrypt agent data
async function decryptAgent(agentData: any): Promise<any> {
  const decryptedAgent = { ...agentData };
  
  // Decrypt each encrypted field
  if (agentData.name) decryptedAgent.name = await decryptData(agentData.name);
  if (agentData.email) decryptedAgent.email = await decryptData(agentData.email);
  if (agentData.phone) decryptedAgent.phone = await decryptData(agentData.phone);
  
  return decryptedAgent;
}

type Language = 'en' | 'hi' | 'es' | 'fr' | 'mr';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const voiceMessages = {
  en: {
    welcome: "Welcome to the Lead Management System! Easily track, manage, and convert leads with our streamlined platform designed to boost your sales efficiency and growth. Here's how to use the system:",
    dashboard: "The dashboard shows your key metrics including total leads, conversions, and upcoming tasks.",
    leads: "In the Leads section, you can manage all potential customers, track interactions, and update statuses. You can also import and export leads, and directly initiate calls and messages to your leads.",
    tasks: "The Tasks section helps organize follow-ups and important activities with reminders and due dates.",
    meetings: "Schedule and manage meetings with leads using the calendar integration.",
    deals: "Track potential deals through different stages in the sales pipeline.",
    agents: "As an admin, you can manage your sales team members and assign leads.",
    settings: "Customize system settings to match your workflow and preferences.",
    help: "You can ask me about any section of the system. Just click the corresponding button."
  },
  hi: {
    welcome: "लीड मैनेजमेंट सिस्टम में आपका स्वागत है! आसानी से लीड्स को ट्रैक, प्रबंधित और परिवर्तित करें, हमारे सुव्यवस्थित प्लेटफॉर्म के साथ जो आपकी बिक्री दक्षता और विकास को बढ़ावा देने के लिए डिज़ाइन किया गया है। सिस्टम का उपयोग करने का तरीका यहां बताया गया है:",
    dashboard: "डैशबोर्ड आपके प्रमुख मेट्रिक्स जैसे कुल लीड, रूपांतरण और आगामी कार्य दिखाता है।",
    leads: "लीड्स सेक्शन में, आप सभी संभावित ग्राहकों को प्रबंधित कर सकते हैं, इंटरैक्शन ट्रैक कर सकते हैं और स्थिति अपडेट कर सकते हैं। आप लीड्स को आयात और निर्यात भी कर सकते हैं, और सीधे अपने लीड्स को कॉल और संदेश भेज सकते हैं।",
    tasks: "टास्क्स सेक्शन रिमाइंडर और ड्यू डेट के साथ फॉलो-अप और महत्वपूर्ण गतिविधियों को व्यवस्थित करने में मदद करता है।",
    meetings: "कैलेंडर इंटीग्रेशन का उपयोग करके लीड के साथ मीटिंग शेड्यूल करें और प्रबंधित करें.",
    deals: "बिक्री पाइपलाइन में विभिन्न चरणों के माध्यम से संभावित डील को ट्रैक करें.",
    agents: "एडमिन के रूप में, आप अपनी सेल्स टीम के सदस्यों को प्रबंधित कर सकते हैं और लीड असाइन कर सकते हैं.",
    settings: "अपने वर्कफ़्लो और प्राथमिकताओं से मेल खाने के लिए सिस्टम सेटिंग्स को कस्टमाइज़ करें.",
    help: "आप मुझसे सिस्टम के किसी भी सेक्शन के बारे में पूछ सकते हैं। बस संबंधित बटन पर क्लिक करें."
  },
  es: {
    welcome: "¡Bienvenido al Sistema de Gestión de Leads! Fácilmente rastree, administre y convierta leads con nuestra plataforma optimizada diseñada para aumentar su eficiencia de ventas y crecimiento. Así es como se usa el sistema:",
    dashboard: "El panel muestra sus métricas clave, incluidos los leads totales, las conversiones y las tareas próximas.",
    leads: "En la sección Leads, puede administrar todos los clientes potenciales, rastrear interacciones y actualizar estados. También puede importar y exportar leads, e iniciar llamadas y mensajes directamente a sus leads.",
    tasks: "La sección Tareas ayuda a organizar seguimientos y actividades importantes con recordatorios y fechas de vencimiento.",
    meetings: "Programe y administre reuniones con leads usando la integración del calendario.",
    deals: "Realice un seguimiento de los posibles acuerdos a través de las diferentes etapas en el pipeline de ventas.",
    agents: "Como administrador, puede gestionar los miembros de su equipo de ventas y asignar leads.",
    settings: "Personalice la configuración del sistema para que coincida con su flujo de trabajo y preferencias.",
    help: "Puede preguntarme sobre cualquier sección del sistema. Simplemente haga clic en el botón correspondiente."
  },
  fr: {
    welcome: "Bienvenue dans le système de gestion des leads ! Suivez, gérez et convertissez facilement les leads avec notre plateforme rationalisée conçue para mejorar votre efficacité commerciale et votre croissance. Voici comment utiliser le système:",
    dashboard: "Le tableau de bord affiche vos principales métriques, y compris le nombre total de prospects, les conversions et les tâches à venir.",
    leads: "Dans la section Prospects, vous pouvez gérer tous les clients potentiels, suivre les interactions et mettre à jour les statuts. Vous pouvez également importer et exporter des prospects, et initier directement des appels y mensajes à vos prospects.",
    tasks: "La section Tâches aide à organiser les relances et les activités importantes avec des rappels et des dates d'échéance.",
    meetings: "Planifiez et gérez des réunions avec des prospects en utilisant l'intégration du calendrier.",
    deals: "Suivez les affaires potentielles à travers les différentes étapes du pipeline de vente.",
    agents: "En tant qu'administrateur, vous pouvez gérer les membres de votre équipe commerciale et attribuer des prospects.",
    settings: "Personnalisez les paramètres du système para qu'ils correspondent à votre flux de travail et à vos préférences.",
    help: "Vous pouvez me poser des questions sur n'importe quelle section du système. Il suffit de clic sur le bouton correspondant."
  },
  mr: {
    welcome: "लीड मॅनेजमेंट सिस्टममध्ये आपले स्वागत आहे! सहजपणे लीड्स ट्रॅक, व्यवस्थापित आणि रूपांतरित करा, आमच्या सुव्यवस्थित प्लॅटफॉर्मसह जे आपल्या विक्री कार्यक्षमता आणि वाढीसाठी डिझाइन केलेले आहे. सिस्टम कसे वापरायचे ते येथे आहे:",
    dashboard: "डॅशबोर्डमध्ये एकूण लीड्स, कन्व्हर्जन्स आणि आगामी कार्ये यासह आपली मुख्य मेट्रिक्स दाखवली जातात.",
    leads: "लीड्स विभागात, आपण सर्व संभाव्य ग्राहकांना व्यवस्थापित करू शकता, संवाद ट्रॅक करू शकता आणि स्थिती अपडेट करू शकता. आपण लीड्स आयात आणि निर्यात देखील करू शकता आणि थेट आपल्या लीड्सला कॉल आणि संदेश पाठवू शकता.",
    tasks: "टास्क्स विभाग रिमाइंडर्स आणि ड्यू डेट्ससह फॉलो-अप आणि महत्त्वाच्या क्रियाकलापांचे आयोजन करण्यास मदत करतो.",
    meetings: "कॅलेंडर एकत्रीकरण वापरून लीडसह बैठकीचे वेळापत्रक तयार करा आणि व्यवस्थापित करा.",
    deals: "विक्री पाइपलाइनमधील विविध टप्प्यांमधून संभाव्य डील ट्रॅक करा.",
    agents: "अॅडमिन म्हणून, आपण आपल्या विक्री संघाच्या सदस्यांचे व्यवस्थापन करू शकता आणि लीड्स नियुक्त करू शकता.",
    settings: "आपल्या वर्कफ्लो आणि प्राधान्यांशी जुळण्यासाठी सिस्टम सेटिंग्ज सानुकूलित करा.",
    help: "तुम्ही सिस्टमच्या कोणत्याही विभागाबद्दल मला विचारू शकता. फक्त संबंधित बटणावर क्लिक करा."
  }
};

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user: encryptedUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [volume, setVolume] = useState(80);
  const [user, setUser] = useState<any>(null);
  const [agentName, setAgentName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Decrypt user data on component mount
  useEffect(() => {
    const decryptUserData = async () => {
      try {
        setLoading(true);
        if (encryptedUser) {
          const decrypted = await decryptUser(encryptedUser);
          setUser(decrypted);
          
          // If this is an agent, decrypt the agent name from localStorage
          if (decrypted.role === 'agent') {
            const encryptedAgentName = localStorage.getItem('agentName');
            if (encryptedAgentName) {
              const decryptedAgentName = await decryptData(encryptedAgentName);
              setAgentName(decryptedAgentName);
            }
          }
        }
      } catch (error) {
        console.error('Error decrypting user data:', error);
      } finally {
        setLoading(false);
      }
    };

    decryptUserData();
  }, [encryptedUser]);

  // Load voices when component mounts
  useEffect(() => {
    const handleVoicesChanged = () => {
      setVoicesLoaded(true);
    };

    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
      
      // Some browsers need this to populate voices initially
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoicesLoaded(true);
      }
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Get appropriate volume icon based on volume level
  const getVolumeIcon = () => {
    if (volume === 0) return <VolumeX size={16} />;
    if (volume < 30) return <Volume size={16} />;
    if (volume < 70) return <Volume1 size={16} />;
    return <Volume2 size={16} />;
  };

  // Speak the given text
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in your browser.');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language based on selection
    utterance.lang = selectedLanguage === 'mr' ? 'hi-IN' : `${selectedLanguage}-${selectedLanguage.toUpperCase()}`;
    
    // Set voice based on language
    const voices = window.speechSynthesis.getVoices();
    let preferredVoice;
    
    // For Marathi, we'll use Hindi voices as they're more likely to be available
    if (selectedLanguage === 'mr') {
      preferredVoice = voices.find(voice => 
        voice.lang.startsWith('hi-IN') && 
        voice.name.includes('Female')
      ) || 
      voices.find(voice => voice.lang.startsWith('hi-IN'));
    } else {
      preferredVoice = voices.find(voice => 
        voice.lang.startsWith(selectedLanguage) && 
        voice.name.includes('Female'
      )) || 
      voices.find(voice => voice.lang.startsWith(selectedLanguage));
    }
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    // Configure speech properties with volume control
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = volume / 100; // Convert 0-100 to 0-1
    
    utterance.onstart = () => {
      setIsSpeaking(true);
      setCurrentMessage(text);
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentMessage('');
    };
    
    utterance.onerror = (event) => {
      console.error('SpeechSynthesis error:', event);
      setIsSpeaking(false);
      setCurrentMessage('');
    };
    
    window.speechSynthesis.speak(utterance);
  };

  // Stop speaking
  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setCurrentMessage('');
  };

  // Speak welcome message and system overview
  const speakSystemOverview = () => {
    const messages = voiceMessages[selectedLanguage];
    const fullMessage = [
      messages.welcome,
      messages.dashboard,
      messages.leads,
      messages.tasks,
      messages.meetings,
      messages.deals,
      ...(user?.role === 'admin' ? [messages.agents] : []),
      messages.settings,
      messages.help
    ].join(' ');
    
    speak(fullMessage);
  };

  // Speak information about a specific section
  const speakSectionInfo = (section: string) => {
    const messages = voiceMessages[selectedLanguage];
    const sectionKey = section.toLowerCase() as keyof typeof messages;
    const message = messages[sectionKey] || 
      `Information about ${section} is not available in ${selectedLanguage}`;
    speak(message);
  };

  // User details (using decrypted data)
  const userName = user?.firstName || agentName || 'User';
  const userEmail = user?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();
  const userRole = user?.role === 'admin' ? 'Admin' : 'Agent';

  // Menu items configuration
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: FileText, label: 'Leads', path: '/leads' },
    ...(user?.role === 'admin' ? [
      { icon: Users, label: 'Agents', path: '/agents' },
      { icon: BarChartBig, label: 'Assign Leads', path: '/assignLeads' }
    ] : []),
    { icon: FileText, label: 'Tasks', path: '/tasks' },
    { icon: Calendar, label: 'Meetings', path: '/meetings' },
    { icon: BarChartBig, label: 'Deals', path: '/deals' },
    { icon: Settings, label: 'Settings', path: '/settings' }
  ];

  // Toggle theme
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:block hidden`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                P
              </div>
              <h2 className="text-lg font-semibold dark:text-white">PTS - CRM</h2>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X size={20} />
            </button>
          </div>
          
          <Separator className="dark:bg-gray-700" />
          
          {/* Navigation Menu */}
          <div className="flex-1 py-4 overflow-y-auto">
            <nav className="px-2 space-y-1">
              {menuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2.5 rounded-lg transition-all ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
          
          <Separator className="dark:bg-gray-700" />
          
          {/* User Profile Section */}
          <div className="p-4">
            <div className="flex items-center space-x-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.photoURL} alt={userName} />
                <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate dark:text-white">{userName}</p>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{userRole}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                  <div className="group relative">
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[100px] inline-block">
                      {userEmail.split('@')[0]}@...
                    </span>
                    <div className="absolute hidden group-hover:block bg-white dark:bg-gray-800 p-2 rounded shadow-lg border border-gray-200 dark:border-gray-700 z-10 min-w-[200px]">
                      <p className="text-xs text-gray-700 dark:text-gray-300">{userEmail}</p>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label="Log out"
              >
                <LogOut size={18} />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center">
            {/* Hide hamburger button when navbar is present */}
            {!isMobile && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mr-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 lg:hidden"
              >
                <Menu size={20} />
              </button>
            )}
            <h1 className="ml-0 text-lg font-semibold lg:text-xl dark:text-white">
              {userName}'s Workspace
            </h1>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* AI Assistant Button with Language Selector */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={isSpeaking ? "default" : "outline"}
                  size="sm"
                  className="hidden md:flex items-center gap-2"
                  disabled={isSpeaking || !voicesLoaded}
                >
                  {isSpeaking ? (
                    <Volume2 className="animate-pulse" size={16} />
                  ) : (
                    <MessageSquare size={16} />
                  )}
                  <span>LMS Assistant</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4">
                <div className="space-y-4">
                  {/* Language and Volume Controls */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Languages size={16} />
                        Language
                      </label>
                      <Select
                        value={selectedLanguage}
                        onValueChange={(value) => setSelectedLanguage(value as Language)}
                        disabled={isSpeaking}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="hi">Hindi</SelectItem>
                          <SelectItem value="mr">Marathi</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        {getVolumeIcon()}
                        Volume
                      </label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[volume]}
                          onValueChange={([value]) => setVolume(value)}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                          disabled={isSpeaking}
                        />
                        <span className="text-xs w-8 text-right">{volume}%</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* System Overview Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={speakSystemOverview}
                    disabled={isSpeaking}
                  >
                    <Volume2 size={16} className="mr-2" />
                    System Overview
                  </Button>
                  
                  {/* Section Info Buttons in 2-column grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {menuItems.map((item) => (
                      <Button
                        key={item.path}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => speakSectionInfo(item.label)}
                        disabled={isSpeaking}
                      >
                        <item.icon size={16} className="mr-2" />
                        {item.label} 
                      </Button>
                    ))}
                  </div>
                  
                  {/* Stop Button */}
                  {isSpeaking && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full mt-2"
                      onClick={stopSpeaking}
                    >
                      Stop Speaking
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
            
            <NotificationDropdown />
            
            {/* User Profile Dropdown */}
            <div className="relative group">
              <Button
                variant="ghost"
                className="flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.photoURL} alt={userName} />
                  <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-sm font-medium dark:text-white">
                  {userName} ({user?.role?.toUpperCase()})
                </span>
              </Button>
              
              <div className="absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 hidden group-hover:block border border-gray-200 dark:border-gray-700">
                <div className="py-1">
                  <div className="px-4 py-2">
                    <p className="text-sm font-medium dark:text-white">{userName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userEmail}</p>
                  </div>
                  <Separator className="dark:bg-gray-700" />
                  {/* <button
                    onClick={() => navigate('/profile')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Your Profile
                  </button> */}
                  <button
                    onClick={() => navigate('/settings')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Profile Settings
                  </button>
                  <Separator className="dark:bg-gray-700" />
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 md:pb-6 bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
        
        {/* Mobile Bottom Navigation */}
        {isMobile && (
          <MobileNavBar>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={isSpeaking ? "default" : "ghost"}
                  size="icon"
                  className={isSpeaking ? "animate-pulse" : ""}
                  disabled={isSpeaking || !voicesLoaded}
                >
                  {isSpeaking ? (
                    <Volume2 size={20} />
                  ) : (
                    <MessageSquare size={20} />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4">
                <div className="space-y-4">
                  {/* Language and Volume Controls */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Languages size={16} />
                        Language
                      </label>
                      <Select
                        value={selectedLanguage}
                        onValueChange={(value) => setSelectedLanguage(value as Language)}
                        disabled={isSpeaking}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="hi">Hindi</SelectItem>
                          <SelectItem value="mr">Marathi</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        {getVolumeIcon()}
                        Volume
                      </label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[volume]}
                          onValueChange={([value]) => setVolume(value)}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                          disabled={isSpeaking}
                        />
                        <span className="text-xs w-8 text-right">{volume}%</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* System Overview Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={speakSystemOverview}
                    disabled={isSpeaking}
                  >
                    <Volume2 size={16} className="mr-2" />
                    System Overview
                  </Button>
                  
                  {/* Section Info Buttons in 2-column grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {menuItems.map((item) => (
                      <Button
                        key={item.path}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => speakSectionInfo(item.label)}
                        disabled={isSpeaking}
                      >
                        <item.icon size={16} className="mr-2" />
                        {item.label} Info
                      </Button>
                    ))}
                  </div>
                  
                  {/* Stop Button */}
                  {isSpeaking && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full mt-2"
                      onClick={stopSpeaking}
                    >
                      Stop Speaking
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </MobileNavBar>
        )}
        {/* Current Message Indicator (floating) */}
        {isSpeaking && (
          <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-w-xs z-50">
            <div className="flex items-start gap-2">
              <Volume2 className="mt-0.5 flex-shrink-0 animate-pulse" size={16} />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {currentMessage.length > 100 
                  ? `${currentMessage.substring(0, 100)}...` 
                  : currentMessage}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={stopSpeaking}
              >
                Stop
              </Button>
              <div className="flex items-center gap-2 w-24">
                {getVolumeIcon()}
                <Slider
                  value={[volume]}
                  onValueChange={([value]) => setVolume(value)}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardLayout;