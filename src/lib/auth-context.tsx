"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";
import type { UserProfile } from "./types";
import { getFirebaseAuth, useMockAuth } from "./firebase";
import {
  mockGetSession,
  mockGoogleSignIn,
  mockLogin,
  mockLogout,
  mockRegister,
  seedMockAdmin,
} from "./mock-store";
import { saveUserProfile } from "./firestore-service";

interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  phone: string;
  country: string;
  companyName: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  isMockMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapFirebaseUser(user: User, extra?: Partial<UserProfile>): UserProfile {
  return {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? extra?.displayName ?? "",
    phone: extra?.phone ?? "",
    country: extra?.country ?? "",
    companyName: extra?.companyName ?? "",
    provider: extra?.provider ?? "email",
    role: extra?.role ?? "user",
    createdAt: extra?.createdAt ?? new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isMockMode = useMockAuth();

  useEffect(() => {
    seedMockAdmin();
    if (isMockMode) {
      setUser(mockGetSession());
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ? mapFirebaseUser(firebaseUser) : null);
      setLoading(false);
    });
    return unsub;
  }, [isMockMode]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (isMockMode) {
        setUser(mockLogin(email, password));
        return;
      }
      const cred = await signInWithEmailAndPassword(
        getFirebaseAuth(),
        email,
        password,
      );
      setUser(mapFirebaseUser(cred.user));
    },
    [isMockMode],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      if (isMockMode) {
        const profile = mockRegister(input.email, input.password, {
          displayName: input.displayName,
          phone: input.phone,
          country: input.country,
          companyName: input.companyName,
          role: "user",
        });
        setUser(profile);
        return;
      }
      const cred = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        input.email,
        input.password,
      );
      await updateProfile(cred.user, { displayName: input.displayName });
      const profile = mapFirebaseUser(cred.user, {
        displayName: input.displayName,
        phone: input.phone,
        country: input.country,
        companyName: input.companyName,
        provider: "email",
      });
      await saveUserProfile(profile);
      setUser(profile);
    },
    [isMockMode],
  );

  const loginWithGoogle = useCallback(async () => {
    if (isMockMode) {
      setUser(mockGoogleSignIn());
      return;
    }
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(getFirebaseAuth(), provider);
    const profile = mapFirebaseUser(cred.user, { provider: "google" });
    await saveUserProfile(profile);
    setUser(profile);
  }, [isMockMode]);

  const logout = useCallback(async () => {
    if (isMockMode) {
      mockLogout();
      setUser(null);
      return;
    }
    await signOut(getFirebaseAuth());
    setUser(null);
  }, [isMockMode]);

  const value = useMemo(
    () => ({ user, loading, isMockMode, login, register, loginWithGoogle, logout }),
    [user, loading, isMockMode, login, register, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
