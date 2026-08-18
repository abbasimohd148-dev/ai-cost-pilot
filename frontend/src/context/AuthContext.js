import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
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
  const [customRange, setCustomRange] = useState({
    start: null,
    end: null,
  });

  const fetchMe = useCallback(async () => {
    setBootstrapping(true);

    try {
      const { data } = await api.get("/me");

      setMe(data);

      setCurrentWorkspaceId(
        (prev) => prev || data.workspaces?.[0]?.id || null
      );
    } catch (e) {
      setMe(null);
    } finally {
      setBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;

      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);

      if (!session) {
        setMe(null);
        setCurrentWorkspaceId(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      fetchMe();
    }
  }, [session, fetchMe]);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({
      email,
      password,
    });

  const signUp = async (email, password) => {
    const res = await supabase.auth.signUp({
      email,
      password,
    });

    if (!res.error && !res.data.session) {
      const login = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!login.error) {
        return {
          ...res,
          data: {
            ...res.data,
            session: login.data.session,
          },
        };
      }
    }

    return res;
  };

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

  const signOut = () =>
    supabase.auth.signOut({
      scope: "local",
    });

  const workspaces = me?.workspaces || [];

  const currentWorkspace =
    workspaces.find(
      (workspace) => workspace.id === currentWorkspaceId
    ) || null;

  const rangeParams = () => {
    if (
      range === "custom" &&
      customRange.start &&
      customRange.end
    ) {
      return {
        range: "custom",
        start: new Date(customRange.start).toISOString(),
        end: new Date(customRange.end).toISOString(),
      };
    }

    return {
      range,
    };
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
        signInWithGoogle,
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
