
import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, getDocs, doc, writeBatch, arrayUnion, arrayRemove, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import Modal from './Modal';
import { LoadingIcon, DeleteIcon } from './icons';
import { Member, MemberRole, User } from '../types';

interface MembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  currentMembers: Member[];
  currentUser: FirebaseUser | null | undefined;
}

const MembersModal: React.FC<MembersModalProps> = ({ isOpen, onClose, businessId, currentMembers, currentUser }) => {
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>('viewer');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newMemberEmail.trim()) return;
    
    if (currentMembers.some(m => m.email.toLowerCase() === newMemberEmail.toLowerCase().trim())) {
      setError('This user is already a member of the business.');
      return;
    }

    setIsLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', newMemberEmail.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('User with this email does not exist.');
        setIsLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as User;
      const newMemberId = userDoc.id;

      const batch = writeBatch(db);
      const businessDocRef = doc(db, 'businesses', businessId);
      batch.update(businessDocRef, { members: arrayUnion(newMemberId) });

      const memberDocRef = doc(db, 'businesses', businessId, 'members', newMemberId);
      batch.set(memberDocRef, { email: userData.email, role: newMemberRole });

      await batch.commit();
      setNewMemberEmail('');
      setNewMemberRole('viewer');
    } catch (err) {
      console.error(err);
      setError('Failed to add member. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRemoveMember = async (memberId: string) => {
    if (currentUser?.uid === memberId) {
        alert("You cannot remove yourself.");
        return;
    }
    if (!window.confirm("Are you sure you want to remove this member?")) return;
    
    try {
        const batch = writeBatch(db);
        const businessDocRef = doc(db, 'businesses', businessId);
        batch.update(businessDocRef, { members: arrayRemove(memberId) });

        const memberDocRef = doc(db, 'businesses', businessId, 'members', memberId);
        batch.delete(memberDocRef);
        
        await batch.commit();
    } catch (err) {
        console.error(err);
        alert("Failed to remove member. Please try again.");
    }
  };

  const handleRoleChange = async (memberId: string, newRole: MemberRole) => {
     if (currentUser?.uid === memberId && newRole !== 'owner') {
        alert("You cannot demote yourself from the owner role.");
        return;
    }
    try {
        const memberDocRef = doc(db, 'businesses', businessId, 'members', memberId);
        await updateDoc(memberDocRef, { role: newRole });
    } catch(err) {
        console.error(err);
        alert("Failed to update role. Please try again.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Members">
      <div className="space-y-6">
        {/* Add Member Form */}
        <div>
          <h4 className="font-medium text-gray-800 mb-2">Invite New Member</h4>
          <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row items-start gap-2">
            <input
              type="email"
              placeholder="user@example.com"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
              required
            />
            <select
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value as MemberRole)}
              className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:w-auto sm:text-sm border-gray-300 rounded-md"
            >
              <option value="viewer">Viewer</option>
              <option value="operator">Operator</option>
              <option value="owner">Owner</option>
            </select>
            <button type="submit" disabled={isLoading} className="w-full sm:w-auto bg-teal-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-teal-700 disabled:bg-teal-400">
              {isLoading ? <LoadingIcon className="w-5 h-5 mx-auto" /> : 'Add'}
            </button>
          </form>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {/* Members List */}
        <div>
          <h4 className="font-medium text-gray-800 mb-2">Current Members</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {currentMembers.map(member => (
              <div key={member.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                <span className="text-sm text-gray-700 truncate">{member.email}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as MemberRole)}
                    disabled={currentUser?.uid === member.id && member.role === 'owner'}
                    className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full text-xs border-gray-300 rounded-md"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="operator">Operator</option>
                    <option value="owner">Owner</option>
                  </select>
                   <button 
                    onClick={() => handleRemoveMember(member.id)} 
                    disabled={currentUser?.uid === member.id}
                    className="text-gray-400 hover:text-red-600 disabled:text-gray-300 disabled:cursor-not-allowed"
                   >
                    <DeleteIcon className="w-5 h-5"/>
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MembersModal;
