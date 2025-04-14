// src/lib/firebase.js (or your chosen path)

// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use later if needed
// https://firebase.google.com/docs/web/setup#available-libraries
// e.g. import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration (Copied from Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyBVIjO_f5GKTal8xpG-QA7aLtWX2A9skoI",
  authDomain: "crm-dashboard-2db5f.firebaseapp.com",
  projectId: "crm-dashboard-2db5f",
  storageBucket: "crm-dashboard-2db5f.appspot.com", // Corrected domain
  messagingSenderId: "668768143823",
  appId: "1:668768143823:web:ab8619b6ccb90de97e6aba"
  // measurementId is optional, add if you have it and need Analytics
};

// Initialize Firebase only if it hasn't been initialized yet
// This prevents errors during hot-reloading in development
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  console.log("Firebase initialized."); // Optional: Log initialization
} else {
  app = getApp(); // Use the existing app instance
  console.log("Firebase already initialized."); // Optional: Log existing instance usage
}


// Get Firestore instance
const db = getFirestore(app);

// Get Auth instance
const auth = getAuth(app);

// Get Google Auth Provider instance
const googleProvider = new GoogleAuthProvider();

// Export the instances for use in other parts of your app
export { db, auth, googleProvider };

// You can also export 'app' if needed elsewhere
// export default app;
