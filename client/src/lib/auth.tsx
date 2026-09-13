import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { auth } from "./firebase";
import { api } from "./api";
import type { PublicUser } from "./types";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  profile: PublicUser | undefined;
  refreshProfile: () => void;
}

const AuthCtx = createContext<AuthState>({ firebaseUser: null, loading: true, profile: undefined, refreshProfile: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      setLoading(false);
      if (!u) qc.clear();
    });
  }, [qc]);

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<PublicUser>("/me"),
    enabled: !!firebaseUser,
    staleTime: 60_000,
  });

  return (
    <AuthCtx.Provider
      value={{ firebaseUser, loading, profile, refreshProfile: () => qc.invalidateQueries({ queryKey: ["me"] }) }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
