import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { ensureUserProfile } from "../lib/database";
import type { UserProfile } from "../types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Começa "true" porque, ao carregar a página, ainda não sabemos se existe
  // uma sessão válida — evita mandar a pessoa pro /login por um instante.
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
        // Também cria automaticamente o perfil de contas que já existiam antes
        // da Fase 3, sem exigir um novo cadastro.
        const databaseProfile = await ensureUserProfile(firebaseUser);
        setProfile(databaseProfile);
      } catch (error) {
        // Uma falha temporária do banco não deve apagar uma sessão válida do Auth.
        // O perfil será tentado novamente na próxima autenticação/carregamento.
        console.error("Não foi possível sincronizar o perfil no Realtime Database.", error);
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

      // O AuthObserver pode disparar antes do updateProfile terminar. Esta segunda
      // sincronização garante que o nome digitado no cadastro vença qualquer fallback.
      try {
        const databaseProfile = await ensureUserProfile(credential.user, name);
        setProfile(databaseProfile);
      } catch (error) {
        // A conta já foi criada no Authentication. Não bloqueamos o acesso por uma
        // falha pontual do banco; a sincronização será refeita automaticamente depois.
        console.error("Conta criada, mas o perfil ainda não foi sincronizado.", error);
      }
    },
    logout: async () => {
      await signOut(auth);
    },
    resetPassword: async (email) => {
      await sendPasswordResetEmail(auth, email);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
