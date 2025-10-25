
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDDjVN4TKHXtq05ly0VJWkZAyAyXhjKqww",
  authDomain: "cash-book-manager---cbm.firebaseapp.com",
  projectId: "cash-book-manager---cbm",
  storageBucket: "cash-book-manager---cbm.firebasestorage.app",
  messagingSenderId: "704541704831",
  appId: "1:704541704831:web:2368067c011bbf1706354a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider };
