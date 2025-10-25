
import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
}

export interface Business {
  id:string;
  name: string;
  ownerId: string;
  createdAt: Timestamp;
  members: string[]; // List of user UIDs
}

export type MemberRole = 'owner' | 'operator' | 'viewer';

export interface Member {
  id: string; // user id
  email: string;
  role: MemberRole;
}

export interface CashBook {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export type EntryType = 'in' | 'out';

export interface Entry {
  id: string;
  type: EntryType;
  amount: number;
  date: Timestamp;
  remark: string;
  createdAt: Timestamp;
  createdBy: string;
}
