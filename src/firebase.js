import firebase from "firebase/app";
import "firebase/firestore";

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Initialize Firebase only if config is available
let firebaseApp;
try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    firebaseApp = firebase.initializeApp(firebaseConfig);
  } else {
    console.warn('Firebase config not found. Using fallback configuration.');
    // Fallback for development/demo
    firebaseApp = firebase.initializeApp({
      apiKey: "demo-key",
      authDomain: "demo.firebaseapp.com", 
      projectId: "demo-project",
      storageBucket: "demo.appspot.com",
      messagingSenderId: "123456789",
      appId: "demo-app"
    });
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
}

export { firebaseApp as firebase };