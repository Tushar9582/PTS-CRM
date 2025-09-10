// firebase.js

// Import necessary Firebase services
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database"; // Realtime Database
import { getMessaging } from 'firebase/messaging';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAuzGxddzJTYUAcXV7QQH-ep6qULJfWbh8",
  authDomain: "pts-crm-a3cae.firebaseapp.com",
  databaseURL: "https://pts-crm-a3cae-default-rtdb.firebaseio.com",
  projectId: "pts-crm-a3cae",
  storageBucket: "pts-crm-a3cae.firebasestorage.app",
  messagingSenderId: "431606697445",
  appId: "1:431606697445:web:715a36cd0ab5b2a69fb30c",
  measurementId: "G-F6BPMDT4NH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase Authentication and Realtime Database
const auth = getAuth(app);
const database = getDatabase(app);
const messaging = getMessaging(app);

// Export the services for use in your app
export { app, analytics, auth, database,messaging };
