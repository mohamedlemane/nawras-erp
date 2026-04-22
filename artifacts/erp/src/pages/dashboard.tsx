import { useQuery } from "@tanstack/react-query";
import { useCurrency } from "@/hooks/use-currency";
import { useGetDashboardSummary, useGetRevenueChart, useGetDepartmentDistribution } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, FileText, CreditCard, UserCircle, FolderKanban,
  TrendingUp, CheckCircle2, Clock, Award, BarChart3, Briefcase,
  ThumbsUp, ThumbsDown,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const PROJECT_STATUS_LABELS: Record<string, string> = {
  preparation: "Préparation",
  mobilisation: "Mobilisation",
  en_cours: "En cours",
  achevement: "Achèvement",
  facture: "Facturé",
};

const CONSULTATION_STATUS_LABELS: Record<string, string> = {
  recu: "Reçu",
  en_etude: "En étude",
  proposition_envoyee: "Proposition envoyée",
  en_negociation: "Négociation",
  attribue: "Attribué",
  perdu: "Perdu",
  annule: "Annulé",
};

const CONSULTATION_TYPE_LABELS: Record<string, string> = {
  rfq: "Appel d'offres",
  appel_offre: "Appel d'offres public",
  gre_a_gre: "Gré à gré",
  autre: "Autre",
};

const STATUS_COLORS: Record<string, string> = {
  preparation: "#94a3b8",
  mobilisation: "#60a5fa",
  en_cours: "#34d399",
  achevement: "#a78bfa",
  facture: "#f59e0b",
  attribue: "#22c55e",
  perdu: "#f87171",
  recu: "#60a5fa",
  en_etude: "#818cf8",
  proposition_envoyee: "#fb923c",
  en_negociation: "#f59e0b",
  annule: "#94a3b8",
};

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a78bfa", "#f87171", "#60a5fa", "#34d399"];

function StatCard({
  title, value, icon: Icon, color, sub, href,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  sub?: string;
  href?: string;
}) {
  const content = (
    <Card className={`hover:shadow-md transition-shadow ${href ? "cursor-pointer" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color ?? "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color ?? ""}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { queryKey: ["dashboard-summary"] } });
  const { data: revenueChart } = useGetRevenueChart({ query: { queryKey: ["revenue-chart"] } });
  const { data: deptDistribution } = useGetDepartmentDistribution({ query: { queryKey: ["dept-distribution"] } });

  const { data: projectsStats } = useQuery<{
    total: number; active: number; completed: number;
    preparation: number; mobilisation: number; en_cours: number; achevement: number; facture: number;
    nonFacture: number; factureB: number; solde: number;
    byStatus: { status: string; count: number }[];
  }>({
    queryKey: ["dashboard-projects-stats"],
    queryFn: () => fetch(`${BASE}/api/dashboard/projects-stats`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: consultationsStats } = useQuery<{
    total: number; attribue: number; perdu: number; inProgress: number; winRate: number;
    byStatus: { status: string; count: number }[];
    byType: { type: string; count: number }[];
  }>({
    queryKey: ["dashboard-consultations-stats"],
    queryFn: () => fetch(`${BASE}/api/dashboard/consultations-stats`, { credentials: "include" }).then(r => r.json()),
  });

  const { formatCurrency } = useCurrency();

  const projectStatusData = (projectsStats?.byStatus ?? []).map(r => ({
    name: PROJECT_STATUS_LABELS[r.status] ?? r.status,
    value: r.count,
    status: r.status,
  }));

  const consultationStatusData = (consultationsStats?.byStatus ?? []).map(r => ({
    name: CONSULTATION_STATUS_LABELS[r.status] ?? r.status,
    value: r.count,
    status: r.status,
  }));

  const consultationTypeData = (consultationsStats?.byType ?? []).map(r => ({
    name: CONSULTATION_TYPE_LABELS[r.type] ?? r.type,
    value: r.count,
  }));

  if (loadingSummary) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground mt-2">Vue d'ensemble de vos activités — CTA-ONE</p>
      </div>

      {/* ─── Bloc Facturation ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> Facturation & Commercial
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Devis Acceptés"
            value={(summary as any)?.acceptedQuotes ?? 0}
            icon={ThumbsUp}
            color="text-green-600"
            sub="Devis confirmés par le client"
            href="/billing/quotes"
          />
          <StatCard
            title="Devis Refusés"
            value={(summary as any)?.rejectedQuotes ?? 0}
            icon={ThumbsDown}
            color="text-destructive"
            sub="Devis rejetés par le client"
            href="/billing/quotes"
          />
          <StatCard
            title="Devis en Attente"
            value={summary?.pendingQuotes || 0}
            icon={Clock}
            color="text-amber-600"
            sub="Brouillons non encore envoyés"
            href="/billing/quotes"
          />
          <StatCard
            title="Factures Impayées"
            value={summary?.unpaidInvoices || 0}
            icon={FileText}
            color="text-orange-600"
            sub="Validées / partiellement payées"
            href="/billing/invoices"
          />
          <StatCard
            title="Clients & Fournisseurs"
            value={(summary?.totalCustomers || 0) + (summary?.totalSuppliers || 0)}
            icon={Users}
            color="text-blue-600"
            sub={`${summary?.totalCustomers || 0} clients · ${summary?.totalSuppliers || 0} fournisseurs`}
            href="/billing/partners"
          />
        </div>
      </section>

      {/* ─── Bloc Projets ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <FolderKanban className="w-4 h-4" /> Projets
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Projets Totaux"
            value={projectsStats?.total ?? "—"}
            icon={FolderKanban}
            color="text-blue-600"
            href="/projects/list"
          />
          <StatCard
            title="Projets Actifs"
            value={projectsStats?.active ?? "—"}
            icon={TrendingUp}
            color="text-green-600"
            sub="Mobilisation + En cours"
            href="/projects/list"
          />
          <StatCard
            title="En Achèvement"
            value={projectsStats?.completed ?? "—"}
            icon={CheckCircle2}
            color="text-violet-600"
            sub="Phase finale"
            href="/projects/list"
          />
          <StatCard
            title="Non Facturés"
            value={projectsStats?.nonFacture ?? "—"}
            icon={BarChart3}
            color="text-amber-600"
            sub="Projets livrés sans facture"
            href="/projects/list"
          />
        </div>
      </section>

      {/* ─── Bloc Consultations ───────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Briefcase className="w-4 h-4" /> Consultations & Appels d'offres
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Consultations Totales"
            value={consultationsStats?.total ?? "—"}
            icon={Briefcase}
            color="text-blue-600"
            href="/projects/consultations"
          />
          <StatCard
            title="En Cours"
            value={consultationsStats?.inProgress ?? "—"}
            icon={Clock}
            color="text-amber-600"
            sub="Reçu · Étude · Proposition · Négociation"
            href="/projects/consultations"
          />
          <StatCard
            title="Gagnées (Attribuées)"
            value={consultationsStats?.attribue ?? "—"}
            icon={Award}
            color="text-green-600"
            href="/projects/consultations"
          />
          <StatCard
            title="Taux de Succès"
            value={`${consultationsStats?.winRate ?? 0} %`}
            icon={TrendingUp}
            color={(consultationsStats?.winRate ?? 0) >= 50 ? "text-green-600" : "text-amber-600"}
            sub={`${consultationsStats?.perdu ?? 0} perdues`}
          />
        </div>
      </section>

      {/* ─── Bloc RH ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <UserCircle className="w-4 h-4" /> Ressources Humaines
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Employés Actifs"
            value={summary?.totalEmployees || 0}
            icon={UserCircle}
            color="text-blue-600"
            href="/hr/employees"
          />
          <StatCard
            title="Congés en Attente"
            value={summary?.pendingLeaves || 0}
            icon={Clock}
            color="text-amber-600"
            sub="Demandes à approuver"
            href="/hr/leaves"
          />
        </div>
      </section>

      {/* ─── Charts ───────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenus mensuels */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Évolution des revenus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              {revenueChart && revenueChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v / 1000}k`} />
                    <RechartsTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Aucune donnée disponible</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statuts des projets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projets par statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              {projectStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={projectStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name} (${value})`}
                      labelLine={false}
                    >
                      {projectStatusData.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Aucun projet enregistré</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Consultations par statut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultations par statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              {consultationStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={consultationStatusData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {consultationStatusData.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Aucune consultation enregistrée</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Consultations par type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultations par type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              {consultationTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={consultationTypeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {consultationTypeData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Aucune consultation enregistrée</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Répartition par département */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Répartition RH par département</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {deptDistribution && deptDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptDistribution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <RechartsTooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Aucune donnée disponible</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
