"use client";

import * as React from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { getStoredToken, storeToken, clearStoredToken } from "@/lib/auth-cookie";
import type { LoginResponse, MeResponse } from "@/types/auth";

interface AuthContextValue {
  user: MeResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  hasPermission: (key: string) => boolean;
  refreshMe: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const refreshMe = React.useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const me = await apiGet<MeResponse>("/auth/me");
      setUser(me);
    } catch (err) {
      // 401 đã được lib/api.ts tự xoá cookie + redirect /login.
      if (!(err instanceof ApiError) || err.status !== 401) {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const result = await apiPost<LoginResponse>("/auth/login", { email, password });
    storeToken(result.accessToken);
    await refreshMe();
    return result;
  }, [refreshMe]);

  const logout = React.useCallback(async () => {
    try {
      await apiPost("/auth/logout");
    } catch {
      /* stateless V1 — logout không bao giờ chặn việc xoá phiên phía client */
    }
    clearStoredToken();
    setUser(null);
    window.location.href = "/login";
  }, []);

  const changePassword = React.useCallback(
    async (oldPassword: string, newPassword: string) => {
      await apiPost("/auth/change-password", { oldPassword, newPassword });
      await refreshMe();
    },
    [refreshMe],
  );

  const hasPermission = React.useCallback(
    (key: string) => user?.permissions.includes(key) ?? false,
    [user],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      changePassword,
      hasPermission,
      refreshMe,
    }),
    [user, isLoading, login, logout, changePassword, hasPermission, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng bên trong AuthProvider.");
  return ctx;
}
