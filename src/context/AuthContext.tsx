import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, signInWithEmailAndPassword, signOutUser, checkIsAdminUser } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let isMounted = true;

    // Get initial session
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const adminStatus = await checkIsAdminUser(session.user);
          if (isMounted) setIsAdmin(adminStatus);
        } else {
          if (isMounted) setIsAdmin(false);
        }
      })
      .catch((err) => {
        console.warn('Supabase session lookup error:', err);
        if (isMounted) {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const adminStatus = await checkIsAdminUser(session.user);
        if (isMounted) setIsAdmin(adminStatus);
      } else {
        if (isMounted) setIsAdmin(false);
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    const data = await signInWithEmailAndPassword(email, password);
    const authUser = data.user;
    if (authUser) {
      const adminStatus = await checkIsAdminUser(authUser);
      if (!adminStatus) {
        await signOutUser();
        setUser(null);
        setSession(null);
        setIsAdmin(false);
        throw new Error('Access denied: Your account is not authorized as a Sproutelle Administrator.');
      }
      setIsAdmin(true);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        loading,
        isConfigured: isSupabaseConfigured,
        signIn: handleSignIn,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
