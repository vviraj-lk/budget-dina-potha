import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export function readFirebaseConfig() {
  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) return null;
  return config;
}

export function getFirebase() {
  const config = readFirebaseConfig();
  if (!config) return null;
  const app = getApps()[0] || initializeApp(config);
  return { auth: getAuth(app), db: getFirestore(app) };
}

function signedInAccount(services, user) {
  if (!user?.email) {
    throw new Error('That account did not share an email address. Choose another account in the sign-in window.');
  }
  return {
    mode: 'cloud',
    uid: user.uid,
    email: user.email,
    name: user.displayName || '',
    db: services.db,
  };
}

export async function signOutCloud() {
  const services = getFirebase();
  if (services) await signOut(services.auth);
}

export async function signInWith(providerName) {
  const services = getFirebase();
  if (!services) {
    throw new Error('Add the Firebase web config in .env before using Google or Microsoft sign-in.');
  }
  const provider = providerName === 'microsoft' ? new OAuthProvider('microsoft.com') : new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });
  // Opens a separate window. Errors keep their Firebase code so the screen can explain them.
  const result = await signInWithPopup(services.auth, provider);
  return signedInAccount(services, result.user);
}
