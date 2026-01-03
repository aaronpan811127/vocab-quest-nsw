import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "student" | "parent";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  currentRole: UserRole | null;
  userRoles: UserRole[];
  signUp: (email: string, password: string, username?: string) => Promise<{ error: Error | null }>;
  signUpAsParent: (email: string, password: string, parentName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string, role: UserRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  setCurrentRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);

  const fetchUserRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    
    if (!error && data) {
      const roles = data.map(r => r.role as UserRole);
      setUserRoles(roles);
      return roles;
    }
    return [];
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer role fetching
          setTimeout(() => {
            fetchUserRoles(session.user.id);
          }, 0);
        } else {
          setUserRoles([]);
          setCurrentRole(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRoles(session.user.id);
        // Restore saved role from localStorage
        const savedRole = localStorage.getItem('vocabquest_role') as UserRole | null;
        if (savedRole) {
          setCurrentRole(savedRole);
        }
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSetCurrentRole = (role: UserRole) => {
    setCurrentRole(role);
    localStorage.setItem('vocabquest_role', role);
  };

  const signUp = async (email: string, password: string, username?: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username: username || email.split('@')[0],
          signup_type: 'student'
        }
      }
    });

    // The backend returns success even when the email already exists (to prevent account enumeration).
    // In that case, identities will be an empty array.
    const isRepeatedSignup = !!data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
    if (!error && isRepeatedSignup) {
      return { error: new Error("This email is already registered. Please sign in instead.") };
    }

    if (!error) {
      setCurrentRole('student');
      localStorage.setItem('vocabquest_role', 'student');
    }

    return { error: error as Error | null };
  };

  const signUpAsParent = async (email: string, password: string, parentName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          parent_name: parentName,
          signup_type: 'parent'
        }
      }
    });

    // Supabase returns 200 even when the email already exists (to prevent account enumeration).
    // In that case, identities will be an empty array.
    const isRepeatedSignup = !!data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
    if (!error && isRepeatedSignup) {
      return { error: new Error("This email is already registered. Please sign in instead.") };
    }

    if (!error) {
      setCurrentRole('parent');
      localStorage.setItem('vocabquest_role', 'parent');
    }

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string, role: UserRole) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (!error) {
      setCurrentRole(role);
      localStorage.setItem('vocabquest_role', role);
    }
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentRole(null);
    localStorage.removeItem('vocabquest_role');
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      currentRole,
      userRoles,
      signUp, 
      signUpAsParent,
      signIn, 
      signOut, 
      resetPassword, 
      updatePassword,
      setCurrentRole: handleSetCurrentRole
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
