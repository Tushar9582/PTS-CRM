// importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
// importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// const firebaseConfig = {
//   apiKey: "YOUR_API_KEY",
//   authDomain: "YOUR_AUTH_DOMAIN",
//   projectId: "YOUR_PROJECT_ID",
//   storageBucket: "YOUR_STORAGE_BUCKET",
//   messagingSenderId: "YOUR_SENDER_ID",
//   appId: "YOUR_APP_ID"
// };

// firebase.initializeApp(firebaseConfig);
// const messaging = firebase.messaging();

// messaging.onBackgroundMessage((payload) => {
//   console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
//   const notificationTitle = payload.notification.title;
//   const notificationOptions = {
//     body: payload.notification.body,
//     icon: '/notification-icon.png'
//   };

//   self.registration.showNotification(notificationTitle, notificationOptions);
// });


// public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAuzGxddzJTYUAcXV7QQH-ep6qULJfWbh8",
  authDomain: "pts-crm-a3cae.firebaseapp.com",
  databaseURL: "https://pts-crm-a3cae-default-rtdb.firebaseio.com",
  projectId: "pts-crm-a3cae",
  storageBucket: "pts-crm-a3cae.firebasestorage.app",
  messagingSenderId: "431606697445",
  appId: "1:431606697445:web:715a36cd0ab5b2a69fb30c"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification.title || 'Notification';
  const notificationOptions = {
    body: payload.notification.body || '',
    icon: '/notification-icon.png' // Make sure this file exists
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
