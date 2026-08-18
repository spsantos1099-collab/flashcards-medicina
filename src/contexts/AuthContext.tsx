import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { ensureUserProfile, updateUserProfileData } from "../lib/database";
import type { UserProfile } from "../types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateAccountProfile: (name: string, course: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const databaseProfile = await ensureUserProfile(firebaseUser);
        setProfile(databaseProfile);
      } catch (error) {
        console.error("Não foi possível sincronizar o perfil.", error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    login: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    register: async (name, email, password) => {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name.trim() });

      try {
        const databaseProfile = await ensureUserProfile(credential.user, name);
        setProfile(databaseProfile);
      } catch (error) {
        console.error("Conta criada, mas o perfil ainda não foi sincronizado.", error);
      }
    },
    logout: async () => {
      await signOut(auth);
    },
    resetPassword: async (email) => {
      await sendPasswordResetEmail(auth, email);
    },
    updateAccountProfile: async (name, course) => {
      if (!user) throw new Error("Você precisa estar conectada para editar o perfil.");

      const cleanName = name.trim();
      const cleanCourse = course.trim();
      if (!cleanName || !cleanCourse) throw new Error("Preencha nome e curso.");

      await updateProfile(user, { displayName: cleanName });
      const nextProfile = await updateUserProfileData(user.uid, {
        name: cleanName,
        course: cleanCourse,
      });
      setProfile(nextProfile);
    },
    changePassword: async (currentPassword, newPassword) => {
      if (!user?.email) throw new Error("Não foi possível identificar o email da conta.");
      if (newPassword.length < 6) throw new Error("A nova senha precisa ter pelo menos 6 caracteres.");

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
