
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './services/firebase';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BusinessPage from './pages/BusinessPage';
import CashBookPage from './pages/CashBookPage';
import { LoadingIcon } from './components/icons';

function App() {
  const [user, loading, error] = useAuthState(auth);

  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const checkAndCreateUserDoc = async () => {
        const docSnap = await getDoc(userDocRef);
        if (!docSnap.exists()) {
          try {
            await setDoc(userDocRef, {
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              createdAt: serverTimestamp(),
            });
          } catch (e) {
            console.error("Error creating user document:", e);
          }
        }
      };
      checkAndCreateUserDoc();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <LoadingIcon className="h-12 w-12 text-teal-600" />
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/" element={user ? <DashboardPage /> : <Navigate to="/login" />} />
        <Route path="/business/:businessId" element={user ? <BusinessPage /> : <Navigate to="/login" />} />
        <Route path="/business/:businessId/cashbook/:cashbookId" element={user ? <CashBookPage /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
