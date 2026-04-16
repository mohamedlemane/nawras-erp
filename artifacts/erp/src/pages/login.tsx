import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, LogIn } from "lucide-react";
import { Redirect } from "wouter";

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <Card className="w-full max-w-md shadow-lg border-0 ring-1 ring-border/50">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-2">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight">Nawras ERP</CardTitle>
            <CardDescription className="text-base">
              Connectez-vous à votre espace de gestion d'entreprise
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button 
            size="lg" 
            className="w-full text-base font-medium h-12"
            onClick={login}
          >
            <LogIn className="mr-2 h-5 w-5" />
            Connexion
          </Button>
          <p className="text-sm text-center text-muted-foreground mt-4">
            Accès sécurisé réservé aux collaborateurs autorisés.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
