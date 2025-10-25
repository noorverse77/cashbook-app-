
import React, { useState, useEffect, useMemo } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { collection, addDoc, query, onSnapshot, getDoc, doc, serverTimestamp, deleteDoc, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { CashBook, Business, Member, MemberRole } from '../types';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import MembersModal from '../components/MembersModal';
import { LoadingIcon, PlusIcon, DeleteIcon, UsersIcon } from '../components/icons';

const BusinessPage: React.FC = () => {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const { businessId } = useParams<{ businessId: string }>();
  
  const [business, setBusiness] = useState<Business | null>(null);
  const [cashBooks, setCashBooks] = useState<CashBook[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<MemberRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCashBookName, setNewCashBookName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [cashBookToDelete, setCashBookToDelete] = useState<CashBook | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  useEffect(() => {
    if (!businessId || !user) return;

    const businessDocRef = doc(db, 'businesses', businessId);
    const getBusinessDetails = async () => {
      const docSnap = await getDoc(businessDocRef);
      if (docSnap.exists() && docSnap.data().members?.includes(user.uid)) {
        setBusiness({ id: docSnap.id, ...docSnap.data() } as Business);
      } else {
        navigate('/');
      }
    };
    getBusinessDetails();
    
    const cashbooksQuery = query(collection(db, 'businesses', businessId, 'cashbooks'));
    const unsubscribeCashbooks = onSnapshot(cashbooksQuery, (querySnapshot) => {
      const books = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashBook));
      setCashBooks(books);
      if(loading) setLoading(false);
    });

    const membersQuery = query(collection(db, 'businesses', businessId, 'members'));
    const unsubscribeMembers = onSnapshot(membersQuery, (querySnapshot) => {
      const memberList = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Member));
      setMembers(memberList);
      const userMemberInfo = memberList.find(m => m.id === user.uid);
      setCurrentUserRole(userMemberInfo?.role || null);
    });


    return () => {
      unsubscribeCashbooks();
      unsubscribeMembers();
    };
  }, [businessId, user, navigate]);

  const handleCreateCashBook = async () => {
    if (!newCashBookName.trim() || !user || !businessId) return;
    setIsCreating(true);
    try {
      await addDoc(collection(db, 'businesses', businessId, 'cashbooks'), {
        name: newCashBookName,
        createdAt: serverTimestamp(),
      });
      setNewCashBookName('');
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error("Error creating cash book:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteClick = (cashBook: CashBook) => {
    setCashBookToDelete(cashBook);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteCashBook = async () => {
    if (!cashBookToDelete || !businessId) return;
    setIsDeleting(true);
    try {
        const cashbookDocRef = doc(db, 'businesses', businessId, 'cashbooks', cashBookToDelete.id);
        const entriesCollectionRef = collection(cashbookDocRef, 'entries');
        
        const entriesSnapshot = await getDocs(entriesCollectionRef);
        const deletePromises = entriesSnapshot.docs.map(entryDoc => deleteDoc(entryDoc.ref));
        await Promise.all(deletePromises);

        await deleteDoc(cashbookDocRef);

        setIsDeleteModalOpen(false);
        setCashBookToDelete(null);
    } catch (error) {
        console.error("Error deleting cash book:", error);
    } finally {
        setIsDeleting(false);
    }
  };

  const filteredCashBooks = useMemo(() => 
    cashBooks.filter(book => book.name.toLowerCase().includes(searchQuery.toLowerCase()))
  , [cashBooks, searchQuery]);

  return (
    <>
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
             <Link to="/" className="text-teal-600 hover:text-teal-800">&larr; Back to Businesses</Link>
             {currentUserRole === 'owner' && (
                <button 
                  onClick={() => setIsMembersModalOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <UsersIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Manage Members
                </button>
              )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{business?.name || 'Loading...'}</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="w-full sm:w-auto sm:flex-1">
              <input
                type="text"
                placeholder="Search cash books..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            {currentUserRole !== 'viewer' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              New Cash Book
            </button>
            )}
          </div>

          {loading ? (
             <div className="text-center">
              <LoadingIcon className="h-8 w-8 text-teal-600 mx-auto" />
            </div>
          ) : filteredCashBooks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCashBooks.map(book => (
                <div key={book.id} className="bg-white overflow-hidden shadow rounded-lg flex flex-col">
                  <div
                    onClick={() => navigate(`/business/${businessId}/cashbook/${book.id}`)}
                    className="p-5 flex-grow cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                  >
                    <h3 className="text-lg font-medium text-gray-900 truncate">{book.name}</h3>
                     <p className="mt-1 text-sm text-gray-500">
                      Created on: {book.createdAt ? new Date(book.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                   {currentUserRole === 'owner' && (
                  <div className="p-2 bg-gray-50 border-t flex justify-end">
                     <button
                        onClick={() => handleDeleteClick(book)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        title="Delete Cash Book"
                      >
                        <DeleteIcon className="h-5 w-5" />
                      </button>
                  </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
             <div className="text-center bg-white p-12 rounded-lg shadow">
              <h3 className="text-xl font-medium text-gray-900">No cash books found</h3>
              <p className="mt-2 text-sm text-gray-500">{searchQuery ? 'Try a different search term.' : 'Create your first cash book to get started.'}</p>
              {currentUserRole !== 'viewer' && (
              <div className="mt-6">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                >
                  <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                  Create Cash Book
                </button>
              </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create a New Cash Book">
        <div>
          <label htmlFor="cashbook-name" className="block text-sm font-medium text-gray-700">Cash Book Name</label>
          <div className="mt-1">
            <input
              type="text"
              name="cashbook-name"
              id="cashbook-name"
              className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="e.g., January 2024 Expenses"
              value={newCashBookName}
              onChange={(e) => setNewCashBookName(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-5 sm:mt-6">
          <button
            type="button"
            className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-teal-600 text-base font-medium text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:text-sm disabled:bg-teal-400"
            onClick={handleCreateCashBook}
            disabled={isCreating || !newCashBookName.trim()}
          >
            {isCreating ? <LoadingIcon className="h-5 w-5" /> : 'Create'}
          </button>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteCashBook}
        title="Delete Cash Book"
        message={`Are you sure you want to delete "${cashBookToDelete?.name}"? All of its entries will be permanently deleted. This action cannot be undone.`}
        confirmText="Delete"
        isConfirming={isDeleting}
      />
      {businessId && <MembersModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        businessId={businessId}
        currentMembers={members}
        currentUser={user}
      />}
    </>
  );
};

export default BusinessPage;
