import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  // Set persistence
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('Firebase persistence set to LOCAL');
    })
    .catch((error) => {
      console.error('Error setting persistence:', error);
    });
    
  db = getFirestore(app);
} else {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

export { auth, db, onAuthStateChanged };