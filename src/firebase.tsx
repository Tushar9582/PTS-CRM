// firebase.js

// Import necessary Firebase services
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database"; // Realtime Database
import { getMessaging } from 'firebase/messaging';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDNLOemKph8QXlzj8br6IAXL6tzTGxXMg8",
  authDomain: "pts-lms-e82cf.firebaseapp.com",
  databaseURL: "https://pts-lms-e82cf-default-rtdb.firebaseio.com",
  projectId: "pts-lms-e82cf",
  storageBucket: "pts-lms-e82cf.firebasestorage.app",
  messagingSenderId: "392587751138",
  appId: "1:392587751138:web:0c8efa50032c998a6238bb",
  measurementId: "G-HH35ZQX74J"
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
