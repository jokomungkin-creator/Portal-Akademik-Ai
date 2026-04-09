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

// Add custom parameters to provider if needed
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const signInWithGoogle = async () => {
  if (!auth) {
    const msg = "Firebase Auth tidak terinisialisasi. Periksa konfigurasi Firebase Anda.";
    console.error(msg);
    throw new Error(msg);
  }
  
  try {
    // Selalu gunakan signInWithPopup untuk pengalaman terbaik di Vercel & AI Studio
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Error signing in with Google:", error.code, error.message);
    
    if (error.code === 'auth/unauthorized-domain') {
      const currentDomain = window.location.hostname;
      alert(`Domain "${currentDomain}" belum terdaftar di Firebase Console.\n\nSilakan tambahkan "${currentDomain}" ke "Authorized Domains" di Firebase Console > Authentication > Settings.`);
    }
    
    throw error;
  }
};

export const logout = () => auth ? signOut(auth) : Promise.resolve();
