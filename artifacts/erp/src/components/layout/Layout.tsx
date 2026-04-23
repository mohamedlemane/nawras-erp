import { Sidebar } from "./Sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

export function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // Super admin bypasses company requirement
  if (!user?.isSuperAdmin && !user?.company) {
    return <Redirect to="/onboarding" />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto flex flex-col">
        <div className="container mx-auto p-8 max-w-7xl flex-1">
          {children}
        </div>
        <footer className="border-t border-border/40 py-3 px-8 text-center text-xs text-muted-foreground bg-background">
          © {new Date().getFullYear()} CTA-One — Tous droits réservés
        </footer>
      </main>
    </div>
  );
}
