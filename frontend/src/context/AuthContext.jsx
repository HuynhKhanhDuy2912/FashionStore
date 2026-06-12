import { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { apiRequest } from "../lib/api.js";

const AuthContext = createContext(null);

const STORAGE_KEY = "fashionstore_auth";

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { token: "", user: null };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  }, [auth]);

  useEffect(() => {
    const syncSession = async () => {
      if (!auth.token || auth.user) {
        return;
      }

      try {
        const response = await apiRequest("/auth/me", {
          token: auth.token
        });

        setAuth((current) => ({
          ...current,
          user: response.data
        }));
      } catch (_error) {
        setAuth({ token: "", user: null });
      }
    };

    syncSession();
  }, [auth.token, auth.user]);

  const login = async (payload) => {
    const response = await apiRequest("/auth/login", {
      method: "POST",
      body: payload
    });

    setAuth(response.data);
    toast.success("Đăng nhập thành công");
    return response.data;
  };

  const loginWithGoogle = async (credential) => {
    const response = await apiRequest("/auth/google", {
      method: "POST",
      body: { credential }
    });

    setAuth(response.data);
    toast.success("Đăng nhập thành công");
    return response.data;
  };

  const loginWithFirebasePhone = async (payload) => {
    const response = await apiRequest("/auth/firebase-phone", {
      method: "POST",
      body: payload
    });

    setAuth(response.data);
    toast.success("Đăng nhập thành công");
    return response.data;
  };

  const register = async (payload) => {
    const response = await apiRequest("/auth/register", {
      method: "POST",
      body: payload
    });

    setAuth(response.data);
    return response.data;
  };

  const refreshMe = async () => {
    if (!auth.token) {
      return null;
    }

    const response = await apiRequest("/auth/me", {
      token: auth.token
    });

    setAuth((current) => ({
      ...current,
      user: response.data
    }));

    return response.data;
  };

  const logout = () => {
    setAuth({ token: "", user: null });
    toast.success("Đăng xuất thành công");
  };

  const value = useMemo(
    () => ({
      token: auth.token,
      user: auth.user,
      isAuthenticated: Boolean(auth.token),
      login,
      loginWithGoogle,
      loginWithFirebasePhone,
      register,
      refreshMe,
      logout
    }),
    [auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
