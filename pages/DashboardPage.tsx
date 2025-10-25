
import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { Business } from '../types';
import Modal from '../components/Modal';
import { LoadingIcon, LogoutIcon, PlusIcon } from '../components/icons';

const DashboardPage: React.FC = () => {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchBusinesses = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const q = query(collection(db, 'businesses'), where('members', 'array-contains', user.uid));
        const querySnapshot = await getDocs(q);
        const userBusinesses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
        setBusinesses(userBusinesses);
      } catch (error) {
        console.error("Error fetching businesses:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBusinesses();
  }, [user]);

  const handleCreateBusiness = async () => {
    if (!newBusinessName.trim() || !user) return;
    setIsCreating(true);
    try {
      const businessData = {
        name: newBusinessName,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        members: [user.uid],
      };
      const businessDocRef = await addDoc(collection(db, 'businesses'), businessData);
      
      const memberDocRef = doc(db, 'businesses', businessDocRef.id, 'members', user.uid);
      await setDoc(memberDocRef, {
        email: user.email,
        role: 'owner'
      });

      const newBusiness = { id: businessDocRef.id, ...businessData, createdAt: new Date() } as unknown as Business
      setBusinesses([...businesses, newBusiness]);
      setNewBusinessName('');
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error creating business:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <>
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">My Businesses</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600 hidden sm:block">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
              title="Logout"
            >
              <LogoutIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Business
            </button>
          </div>
          {loading ? (
            <div className="text-center">
              <LoadingIcon className="h-8 w-8 text-teal-600 mx-auto" />
            </div>
          ) : businesses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {businesses.map(business => (
                <div key={business.id}
                  onClick={() => navigate(`/business/${business.id}`)}
                  className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                >
                  <div className="p-5">
                    <h3 className="text-lg font-medium text-gray-900 truncate">{business.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Created on: {business.createdAt ? new Date(business.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center bg-white p-12 rounded-lg shadow">
              <h3 className="text-xl font-medium text-gray-900">No businesses yet</h3>
              <p className="mt-2 text-sm text-gray-500">Get started by creating your first business.</p>
              <div className="mt-6">
                <button
                  onClick={() => setIsModalOpen(true)}
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                >
                  <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                  Create Business
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create a New Business">
        <div>
          <label htmlFor="business-name" className="block text-sm font-medium text-gray-700">Business Name</label>
          <div className="mt-1">
            <input
              type="text"
              name="business-name"
              id="business-name"
              className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="e.g., My Awesome Startup"
              value={newBusinessName}
              onChange={(e) => setNewBusinessName(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-5 sm:mt-6">
          <button
            type="button"
            className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-teal-600 text-base font-medium text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:text-sm disabled:bg-teal-400"
            onClick={handleCreateBusiness}
            disabled={isCreating || !newBusinessName.trim()}
          >
            {isCreating ? <LoadingIcon className="h-5 w-5" /> : 'Create'}
          </button>
        </div>
      </Modal>
    </>
  );
};

export default DashboardPage;
