import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
  const [range, setRange] = useState("7d");
  const [customRange, setCustomRange] = useState({ start: null, end: null });

  const fetchMe = useCallback(async () => {
    setBootstrapping(true);
    try {
      const { data } = await api.get("/me");
      setMe(data);
      setCurrentWorkspaceId((prev) => prev || data.workspaces?.[0]?.id || null);
    } catch (e) {
      setMe(null);
    } finally {
      setBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) setMe(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) fetchMe();
  }, [session, fetchMe]);

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });

  const signUp = async (email, password) => {
    const res = await supabase.auth.signUp({ email, password });
    if (!res.error && !res.data.session) {
      // email confirmation may be enabled; try immediate sign-in
      const login = await supabase.auth.signInWithPassword({ email, password });
      if (!login.error) return { ...res, data: { ...res.data, session: login.data.session } };
    }
    return res;
  };

  const signOut = () => supabase.auth.signOut({ scope: "local" });

  const workspaces = me?.workspaces || [];
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) || null;

  const rangeParams = () => {
    if (range === "custom" && customRange.start && customRange.end) {
      return {
        range: "custom",
        start: new Date(customRange.start).toISOString(),
        end: new Date(customRange.end).toISOString(),
      };
    }
    return { range };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        me,
        loading,
        bootstrapping,
        signIn,
        signUp,
        signOut,
        refresh: fetchMe,
        workspaces,
        currentWorkspace,
        currentWorkspaceId,
        setCurrentWorkspaceId,
        range,
        setRange,
        customRange,
        setCustomRange,
        rangeParams,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
