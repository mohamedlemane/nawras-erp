import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";

interface UserWithCompany {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  company: {
    companyId: number;
    roleId: number | null;
    roleName: string | null;
  } | null;
}

export function useCurrentUser() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data, isLoading, error } = useQuery<UserWithCompany>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: data ?? null,
    hasCompany: !!(data?.company),
    isLoading: authLoading || (isAuthenticated ? isLoading : false),
    error,
  };
}
