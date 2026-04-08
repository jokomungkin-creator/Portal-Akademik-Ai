import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app;
try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export const auth = app ? getAuth(app) : null as any;
export const db = app ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : null as any;
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  if (!auth) throw new Error("Firebase Auth not initialized");
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error instanceof Error ? error.message : String(error));
    throw error;
  }
};

export const logout = () => auth ? signOut(auth) : Promise.resolve();
