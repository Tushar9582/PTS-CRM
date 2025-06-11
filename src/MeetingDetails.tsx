import React, { useState, useEffect } from 'react';
import { database } from './firebase'; // Import your Firebase config
import { ref, onValue } from 'firebase/database';
import notificationSound from './assets/notification.mp3';
interface Meeting {
  id: string;
  startDate: string;
  startTime: string;
  title?: string;
  agenda?: string;
  location?: string;
}

const MeetingNotifier = () => {

  const adminId = localStorage.getItem('adminkey');
  const agentId = localStorage.getItem('agentkey');
  const [notifications, setNotifications] = useState<Meeting[]>([]);
  const [currentNotification, setCurrentNotification] = useState<Meeting | null>(null);

  useEffect(() => {
    const meetingsRef = ref(database, `users/${adminId}/meetingdetails`);
    
    const unsubscribe = onValue(meetingsRef, (snapshot) => {
      const meetingsData = snapshot.val();
      if (meetingsData) {
        const meetings: Meeting[] = Object.entries(meetingsData).map(([key, value]) => ({
          id: key,
          ...(value as Omit<Meeting, 'id'>)
        }));
        setNotifications(meetings);
      }
    });

    return () => unsubscribe();
  }, [adminId]);

  useEffect(() => {
    const checkUpcomingMeetings = () => {
      const now = new Date().getTime(); // Get timestamp in milliseconds
      
      notifications.forEach(meeting => {
        try {
          // Parse meeting date and time
          const [year, month, day] = meeting.startDate.split('-').map(Number);
          const [hours, minutes] = meeting.startTime.split(':').map(Number);
          
          const meetingDateTime = new Date(year, month - 1, day, hours, minutes).getTime();
          const notificationTime = meetingDateTime - (5 * 60 * 1000); // 5 minutes before in milliseconds
          
          // Check if current time is within 1 minute of notification time
          if (Math.abs(now - notificationTime) < 60000) {
            showNotification(meeting);
          }
        } catch (error) {
          console.error('Error processing meeting time:', error);
        }
      });
    };

    const interval = setInterval(checkUpcomingMeetings, 60000);
    checkUpcomingMeetings();

    return () => clearInterval(interval);
  }, [notifications]);

  const showNotification = (meeting: Meeting) => {
    const audio = new Audio(notificationSound);
    audio.play().catch(err => console.error("Error playing sound:", err));
    
    setCurrentNotification(meeting);
    
    const now = new Date().getTime();
    const [year, month, day] = meeting.startDate.split('-').map(Number);
    const [hours, minutes] = meeting.startTime.split(':').map(Number);
    const meetingDateTime = new Date(year, month - 1, day, hours, minutes).getTime();
    
    const duration = Math.min(
      5 * 60 * 1000, // 5 minutes max
      meetingDateTime - now // Time until meeting starts
    );
    
    setTimeout(() => {
      setCurrentNotification(null);
    }, duration);
  };

  const dismissNotification = () => {
    setCurrentNotification(null);
  };

  if (!currentNotification) return null;

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                   bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-80
                   animate-fade-in overflow-hidden">
      <div className="bg-blue-500 p-3 text-white">
        <h3 className="font-bold text-lg">Upcoming Meeting</h3>
        <p className="text-sm opacity-90">
          Starts in 5 minutes
        </p>
      </div>
      
      <div className="p-4 text-gray-800">
        <h4 className="font-semibold mb-1">{currentNotification.title || 'Meeting'}</h4>
        <p className="text-sm mb-2">{currentNotification.agenda || 'No agenda specified'}</p>
        <div className="flex items-center text-sm text-gray-500 mb-1">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {currentNotification.startDate} • {currentNotification.startTime}
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {currentNotification.location || 'Location not specified'}
        </div>
      </div>
      
      <div className="flex justify-end p-2 bg-gray-50">
        <button 
          onClick={dismissNotification}
          className="px-3 py-1 text-sm text-blue-500 hover:text-blue-700 focus:outline-none"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default MeetingNotifier;