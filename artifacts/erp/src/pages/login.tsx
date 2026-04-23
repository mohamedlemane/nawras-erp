import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, Eye, EyeOff, Globe } from "lucide-react";
import { Redirect } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// ── Detect subdomain from hostname ────────────────────────────────────────────
function getSubdomain(): string | null {
  const hostname = window.location.hostname;
  // Only activate for *.ctaone.com — never on Replit preview URLs, localhost, etc.
  if (!hostname.endsWith(".ctaone.com")) return null;
  const parts = hostname.split(".");
  // company.ctaone.com → ["company","ctaone","com"] → subdomain = "company"
  // ctaone.com / www.ctaone.com → no subdomain
  if (parts.length >= 3 && parts[0] !== "www" && parts[0] !== "admin") {
    return parts[0];
  }
  return null;
}

interface CompanyInfo {
  id: number;
  name: string;
  logo: string | null;
  subdomain: string | null;
}

export default function Login() {
  const { isAuthenticated, isLoading, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const subdomain = getSubdomain();
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [companyLoading, setCompanyLoading] = useState(!!subdomain);
  const [companyError, setCompanyError] = useState<string | null>(null);

  // Fetch company info from subdomain
  useEffect(() => {
    if (!subdomain) return;
    setCompanyLoading(true);
    fetch(`${BASE}/api/public/company-by-subdomain?subdomain=${encodeURIComponent(subdomain)}`)
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || "Entreprise introuvable");
        }
        return r.json() as Promise<CompanyInfo>;
      })
      .then(data => { setCompany(data); setCompanyLoading(false); })
      .catch(e => { setCompanyError(e.message); setCompanyLoading(false); });
  }, [subdomain]);

  if (isLoading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  // Subdomain present but company not found
  if (subdomain && companyError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-red-50 p-4">
        <Card className="w-full max-w-sm shadow-xl border-0 ring-1 ring-border/40 text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="mx-auto bg-red-100 w-16 h-16 rounded-2xl flex items-center justify-center">
              <Globe className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-lg">Espace introuvable</p>
              <p className="text-muted-foreground text-sm mt-1">
                Le sous-domaine <span className="font-mono font-semibold">{subdomain}.ctaone.com</span> ne correspond à aucune entreprise.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Vérifiez l'adresse ou contactez votre administrateur.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Identifiants incorrects");
    } finally {
      setPending(false);
    }
  }

  const isCompanyLogin = !!subdomain && !!company;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-orange-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0 ring-1 ring-border/40">
        <CardHeader className="text-center space-y-4 pb-6 pt-8">
          <div className="flex justify-center">
            {isCompanyLogin && company.logo ? (
              <img src={company.logo} alt={company.name} className="h-14 w-auto object-contain" />
            ) : (
              <img src={`${BASE}/logo.png`} alt="CTA-ONE" className="h-16 w-auto object-contain" />
            )}
          </div>
          <div>
            {isCompanyLogin && (
              <CardTitle className="text-2xl font-bold tracking-tight">
                {company.name}
              </CardTitle>
            )}
            <CardDescription className="text-base mt-1">
              {isCompanyLogin
                ? `Connectez-vous à votre espace ${company.name}`
                : "Connectez-vous à votre espace de gestion"}
            </CardDescription>
            {isCompanyLogin && (
              <div className="mt-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 px-3 py-1 text-xs text-orange-700 font-medium">
                  <Globe className="w-3 h-3" />
                  {subdomain}.ctaone.com
                </span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                <Mail className="w-3.5 h-3.5 inline mr-1.5 opacity-60" />
                Adresse email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.mr"
                required
                autoFocus
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                <Lock className="w-3.5 h-3.5 inline mr-1.5 opacity-60" />
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive font-medium">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-base font-medium mt-2" disabled={pending}>
              {pending ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Connexion...
                </span>
              ) : "Se connecter"}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-6">
            {isCompanyLogin
              ? `Espace réservé aux collaborateurs de ${company.name}.`
              : "Accès sécurisé réservé aux collaborateurs autorisés."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
