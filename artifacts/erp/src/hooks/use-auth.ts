import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isSuperAdmin: boolean;
  company: {
    companyId: number;
    roleId: number | null;
    roleName: string | null;
  } | null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<AuthUser>;
      })
      .then((data) => {
        if (!cancelled) { setUser(data ?? null); setIsLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setUser(null); setIsLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BASE}/api/auth/local/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Identifiants incorrects");
    const me = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
    if (me.ok) setUser(await me.json());
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${BASE}/api/auth/local/logout`, { method: "POST", credentials: "include" });
    setUser(null);
    window.location.href = `${BASE}/login`;
  }, []);

  return { user, isAuthenticated: !!user, isLoading, login, logout };
}
