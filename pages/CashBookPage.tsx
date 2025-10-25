
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { collection, doc, getDoc, onSnapshot, query, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, orderBy } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { CashBook, Entry, EntryType, MemberRole } from '../types';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { LoadingIcon, PlusIcon, EditIcon, DeleteIcon, PdfIcon, ExcelIcon } from '../components/icons';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';

const EntryForm = ({
  onSubmit,
  onClose,
  isSubmitting,
  initialData,
}: {
  onSubmit: (entry: Omit<Entry, 'id' | 'createdAt' | 'createdBy'>) => void;
  onClose: () => void;
  isSubmitting: boolean;
  initialData?: Omit<Entry, 'id'| 'createdAt' | 'createdBy'> | null;
}) => {
  const [type, setType] = useState<EntryType>(initialData?.type || 'in');
  const [amount, setAmount] = useState<string>(initialData?.amount.toString() || '');
  const [date, setDate] = useState<string>(initialData ? new Date(initialData.date.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [remark, setRemark] = useState<string>(initialData?.remark || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    onSubmit({
      type,
      amount: numericAmount,
      date: Timestamp.fromDate(new Date(date)),
      remark: remark.trim() || 'Cash',
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Type</label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <button type="button" onClick={() => setType('in')} className={`w-1/2 rounded-l-md px-4 py-2 ${type === 'in' ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-800'}`}>Cash In</button>
            <button type="button" onClick={() => setType('out')} className={`w-1/2 rounded-r-md px-4 py-2 ${type === 'out' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-800'}`}>Cash Out</button>
          </div>
        </div>
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount</label>
          <input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)} required min="0.01" step="0.01" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
          <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="remark" className="block text-sm font-medium text-gray-700">Remark (Optional)</label>
          <input type="text" id="remark" value={remark} onChange={e => setRemark(e.target.value)} placeholder="Cash" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
        </div>
      </div>
      <div className="mt-6 flex justify-end space-x-3">
        <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:bg-teal-400">
          {isSubmitting ? <LoadingIcon className="w-5 h-5"/> : (initialData ? 'Update Entry' : 'Add Entry')}
        </button>
      </div>
    </form>
  )
};

const CashBookPage: React.FC = () => {
    const [user] = useAuthState(auth);
    const { businessId, cashbookId } = useParams<{ businessId: string, cashbookId: string }>();
    const navigate = useNavigate();
    
    const [cashBook, setCashBook] = useState<CashBook | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState<Entry | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [userRole, setUserRole] = useState<MemberRole | null>(null);
    
    const entriesCollectionRef = useMemo(() => 
        collection(db, 'businesses', businessId!, 'cashbooks', cashbookId!, 'entries'),
        [businessId, cashbookId]
    );

    useEffect(() => {
        if (!businessId || !cashbookId || !user) return;

        // Fetch user role
        const memberDocRef = doc(db, 'businesses', businessId, 'members', user.uid);
        getDoc(memberDocRef).then(docSnap => {
            if (docSnap.exists()) {
                setUserRole(docSnap.data().role as MemberRole);
            } else {
                navigate('/'); // Not a member, redirect
            }
        });

        const cashbookDocRef = doc(db, 'businesses', businessId, 'cashbooks', cashbookId);
        getDoc(cashbookDocRef).then(docSnap => {
            if (docSnap.exists()) setCashBook({ id: docSnap.id, ...docSnap.data() } as CashBook);
            else navigate(`/business/${businessId}`);
        });

        const q = query(entriesCollectionRef, orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Entry));
            
            entriesData.sort((a, b) => {
                const dateComparison = b.date.seconds - a.date.seconds;
                if (dateComparison !== 0) return dateComparison;
                return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0);
            });

            setEntries(entriesData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching entries:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [businessId, cashbookId, navigate, entriesCollectionRef, user]);

    const handleFormSubmit = useCallback(async (entryData: Omit<Entry, 'id' | 'createdAt' | 'createdBy'>) => {
        if (!user || userRole === 'viewer') return;
        setIsSubmitting(true);
        try {
            if (editingEntry) {
                const entryDocRef = doc(db, 'businesses', businessId!, 'cashbooks', cashbookId!, 'entries', editingEntry.id);
                await updateDoc(entryDocRef, entryData);
            } else {
                await addDoc(entriesCollectionRef, {
                    ...entryData,
                    createdBy: user.uid,
                    createdAt: serverTimestamp(),
                });
            }
            setIsModalOpen(false);
            setEditingEntry(null);
        } catch (error) {
            console.error("Error submitting entry:", error);
        } finally {
            setIsSubmitting(false);
        }
    }, [user, editingEntry, entriesCollectionRef, businessId, cashbookId, userRole]);
    
    const handleDeleteClick = (entry: Entry) => {
        setEntryToDelete(entry);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteEntry = async () => {
        if (!entryToDelete || userRole !== 'owner') return;
        setIsDeleting(true);
        try {
            const entryDocRef = doc(db, 'businesses', businessId!, 'cashbooks', cashbookId!, 'entries', entryToDelete.id);
            await deleteDoc(entryDocRef);
            setIsDeleteModalOpen(false);
            setEntryToDelete(null);
        } catch (error) {
            console.error("Error deleting entry:", error);
        } finally {
            setIsDeleting(false);
        }
    };
    
    const { totalIn, totalOut, balance } = useMemo(() => {
        return entries.reduce((acc, entry) => {
            if (entry.type === 'in') acc.totalIn += entry.amount;
            else acc.totalOut += entry.amount;
            acc.balance = acc.totalIn - acc.totalOut;
            return acc;
        }, { totalIn: 0, totalOut: 0, balance: 0 });
    }, [entries]);

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

    const sortedEntriesWithBalance = useMemo(() => {
        let runningBalance = balance;
        return entries.map(entry => {
            const currentEntryBalance = runningBalance;
            if (entry.type === 'in') {
                runningBalance -= entry.amount;
            } else {
                runningBalance += entry.amount;
            }
            return { ...entry, balance: currentEntryBalance };
        });
    }, [entries, balance]);

    const displayEntries = useMemo(() => {
        if (!searchQuery.trim()) {
            return sortedEntriesWithBalance;
        }
        return sortedEntriesWithBalance.filter(entry => 
            entry.remark.toLowerCase().includes(searchQuery.toLowerCase().trim())
        );
    }, [sortedEntriesWithBalance, searchQuery]);

    if (loading || !userRole) {
      return <div className="flex items-center justify-center h-screen"><LoadingIcon className="h-12 w-12 text-teal-600" /></div>;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center mb-2">
                        <Link to={`/business/${businessId}`} className="text-sm text-teal-600 hover:text-teal-800">&larr; Back to Cash Books</Link>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">{cashBook?.name}</h1>
                        <div className="mt-3 sm:mt-0 sm:ml-4 flex space-x-2">
                            <button onClick={() => exportToPDF(displayEntries, cashBook?.name || 'Cash Book', {totalIn, totalOut, balance})} className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                                <PdfIcon className="h-5 w-5 mr-2" /> PDF
                            </button>
                             <button onClick={() => exportToExcel(displayEntries, cashBook?.name || 'Cash Book')} className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                                <ExcelIcon className="h-5 w-5 mr-2" /> Excel
                            </button>
                        </div>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="bg-green-100 p-4 rounded-lg">
                            <p className="text-sm font-medium text-green-800">Total Cash In</p>
                            <p className="text-2xl font-semibold text-green-900">{formatCurrency(totalIn)}</p>
                        </div>
                        <div className="bg-red-100 p-4 rounded-lg">
                            <p className="text-sm font-medium text-red-800">Total Cash Out</p>
                            <p className="text-2xl font-semibold text-red-900">{formatCurrency(totalOut)}</p>
                        </div>
                        <div className="bg-gray-200 p-4 rounded-lg">
                            <p className="text-sm font-medium text-gray-800">Net Balance</p>
                            <p className={`text-2xl font-semibold ${balance >= 0 ? 'text-gray-900' : 'text-red-900'}`}>{formatCurrency(balance)}</p>
                        </div>
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                 <div className="px-4 sm:px-0 mb-4">
                    <input
                        type="text"
                        placeholder="Search by remark..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                </div>
                <div className="overflow-x-auto">
                    <div className="inline-block min-w-full align-middle">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Date</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Remark</th>
                                        <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Cash In</th>
                                        <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Cash Out</th>
                                        <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Balance</th>
                                        {userRole !== 'viewer' && <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {displayEntries.map(entry => (
                                        <tr key={entry.id}>
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{new Date(entry.date.seconds * 1000).toLocaleDateString()}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{entry.remark}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-green-600">{entry.type === 'in' ? formatCurrency(entry.amount) : '-'}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-red-600">{entry.type === 'out' ? formatCurrency(entry.amount) : '-'}</td>
                                            <td className={`whitespace-nowrap px-3 py-4 text-sm text-right font-medium ${entry.balance >= 0 ? 'text-gray-700' : 'text-red-700'}`}>{formatCurrency(entry.balance)}</td>
                                            {userRole !== 'viewer' && (
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                <div className="flex items-center justify-end space-x-3">
                                                    <button onClick={() => { setEditingEntry(entry); setIsModalOpen(true); }} className="text-teal-600 hover:text-teal-900 disabled:text-gray-300 disabled:cursor-not-allowed" title="Edit Entry">
                                                        <EditIcon className="h-5 w-5"/>
                                                    </button>
                                                    <button disabled={userRole !== 'owner'} onClick={() => handleDeleteClick(entry)} className="text-red-600 hover:text-red-900 disabled:text-gray-300 disabled:cursor-not-allowed" title="Delete Entry">
                                                        <DeleteIcon className="h-5 w-5"/>
                                                    </button>
                                                </div>
                                            </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                             {displayEntries.length === 0 && (
                                <div className="text-center p-8">
                                    <h3 className="text-lg font-medium text-gray-900">
                                        {searchQuery ? 'No Entries Found' : 'No entries yet'}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        {searchQuery 
                                            ? 'Your search did not match any entries.' 
                                            : userRole !== 'viewer' ? 'Add your first transaction to get started.' : 'There are no entries in this cash book yet.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            {userRole !== 'viewer' && (
                <button
                    onClick={() => {setEditingEntry(null); setIsModalOpen(true);}}
                    className="fixed bottom-6 right-6 bg-teal-600 text-white rounded-full p-4 shadow-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                    title="Add New Entry"
                >
                    <PlusIcon className="h-6 w-6"/>
                </button>
            )}
            <Modal isOpen={isModalOpen} onClose={() => {setIsModalOpen(false); setEditingEntry(null);}} title={editingEntry ? 'Edit Entry' : 'Add New Entry'}>
                <EntryForm 
                  isSubmitting={isSubmitting} 
                  onClose={() => {setIsModalOpen(false); setEditingEntry(null);}}
                  onSubmit={handleFormSubmit}
                  initialData={editingEntry}
                />
            </Modal>
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDeleteEntry}
                title="Delete Entry"
                message="Are you sure you want to delete this entry? This action cannot be undone."
                confirmText="Delete"
                isConfirming={isDeleting}
            />
        </div>
    );
};

export default CashBookPage;
