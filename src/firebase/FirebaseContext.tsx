import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  BOOTSTRAPPED_SUPERADMIN_EMAIL,
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from './config';
import { UserRole } from '../types/mis';
import {
  claimPendingRoleInviteInCloud,
  ensureSuperAdminRecordInCloud,
  upsertUserProfileInCloud,
} from './misService';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  role: UserRole;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isBootstrappedAdmin: boolean;
  isBootstrappedSuperAdmin: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [role, setRole] = useState<UserRole>('officer');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBootstrappedAdmin, setIsBootstrappedAdmin] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setRole('officer');
        setIsSuperAdmin(false);
        setIsAdmin(false);
        setIsBootstrappedAdmin(false);
        setAuthReady(true);
        return;
      }

      const bootstrapped = Boolean(
        currentUser.emailVerified &&
          currentUser.email?.toLowerCase() === BOOTSTRAPPED_SUPERADMIN_EMAIL.toLowerCase()
      );
      setIsBootstrappedAdmin(bootstrapped);

      if (currentUser.emailVerified && currentUser.email) {
        void upsertUserProfileInCloud(currentUser.uid, currentUser.email, currentUser.displayName);
      }

      if (bootstrapped) {
        setRole('superadmin');
        setIsSuperAdmin(true);
        setIsAdmin(true);
        if (currentUser.email) {
          void ensureSuperAdminRecordInCloud(
            currentUser.uid,
            currentUser.email,
            currentUser.displayName
          );
        }
        setAuthReady(true);
        return;
      }

      if (currentUser.emailVerified) {
        try {
          const snap = await getDoc(doc(db, 'admins', currentUser.uid));
          if (snap.exists()) {
            const docRole = snap.data()?.role;
            if (docRole === 'superadmin') {
              setRole('superadmin');
              setIsSuperAdmin(true);
              setIsAdmin(true);
            } else if (docRole === 'admin') {
              setRole('admin');
              setIsSuperAdmin(false);
              setIsAdmin(true);
            } else {
              setRole('officer');
              setIsSuperAdmin(false);
              setIsAdmin(false);
            }
          } else if (currentUser.email) {
            const claimed = await claimPendingRoleInviteInCloud(
              currentUser.uid,
              currentUser.email,
              currentUser.displayName
            );
            if (claimed === 'superadmin') {
              setRole('superadmin');
              setIsSuperAdmin(true);
              setIsAdmin(true);
            } else if (claimed === 'admin') {
              setRole('admin');
              setIsSuperAdmin(false);
              setIsAdmin(true);
            } else {
              setRole('officer');
              setIsSuperAdmin(false);
              setIsAdmin(false);
            }
          } else {
            setRole('officer');
            setIsSuperAdmin(false);
            setIsAdmin(false);
          }
        } catch (err) {
          console.warn('Admin role lookup skipped or denied:', err);
          setRole('officer');
          setIsSuperAdmin(false);
          setIsAdmin(false);
        }
      } else {
        setRole('officer');
        setIsSuperAdmin(false);
        setIsAdmin(false);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in with Google.';
      setAuthError(msg);
      if (msg.includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.GET, 'auth/signIn');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        role,
        isSuperAdmin,
        isAdmin,
        isBootstrappedAdmin,
        isBootstrappedSuperAdmin: isBootstrappedAdmin,
        signingIn,
        authError,
        signInWithGoogle,
        signOutUser,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
