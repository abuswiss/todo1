import firebase from "firebase/app";
import "firebase/firestore";

// Initialize Firebase with placeholder config for demo purposes
// In production, you would use real Firebase credentials
const firebaseConfig = firebase.initializeApp({
  apiKey: "demo-api-key",
  authDomain: "demo-project.firebaseapp.com",
  databaseURL: "https://demo-project.firebaseio.com",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "demo-app-id",
});

// For demo purposes, we'll use a mock Firestore implementation
// This prevents errors during build while maintaining component compatibility
const mockFirestore = {
  collection: (collectionName) => ({
    add: (data) => Promise.resolve({ id: 'mock-id-' + Date.now() }),
    where: () => ({
      get: () => Promise.resolve({ 
        docs: [
          {
            id: 'sample-task-1',
            data: () => ({
              task: 'Welcome to your AI-powered todo app!',
              projectId: '1',
              date: '',
              priority: 'medium',
              archived: false,
              userId: 'demo-user',
              aiEnhanced: true,
              metadata: {
                originalInput: 'Welcome to your AI-powered todo app!',
                aiParsed: {
                  taskName: 'Welcome to your AI-powered todo app!',
                  category: 'general',
                  priority: 'medium',
                  confidence: 0.9
                }
              }
            })
          }
        ]
      })
    }),
    doc: (docId) => ({
      update: (data) => Promise.resolve(),
      delete: () => Promise.resolve()
    })
  }),
  FieldValue: {
    serverTimestamp: () => new Date()
  }
};

// Create a mock firebase object that matches the expected interface
const mockFirebase = {
  firestore: () => mockFirestore,
  ...mockFirestore
};

export { mockFirebase as firebase };