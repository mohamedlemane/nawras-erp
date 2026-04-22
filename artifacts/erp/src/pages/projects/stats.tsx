import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { ChevronDown, Filter, TrendingUp, Award, XCircle, Clock, RotateCcw } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// ─── Status (fixed, not configurable) ─────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; hex: string }> = {
  recu:                  { label: "Reçu",                hex: "#60a5fa" },
  en_etude:              { label: "En étude",            hex: "#818cf8" },
  proposition_envoyee:   { label: "Proposition envoyée", hex: "#fb923c" },
  en_negociation:        { label: "Négociation",         hex: "#f59e0b" },
  attribue:              { label: "Attribuée",           hex: "#22c55e" },
  perdu:                 { label: "Perdue",              hex: "#f87171" },
  annule:                { label: "Annulée",             hex: "#94a3b8" },
};

const PIE_COLORS = ["#3b82f6","#22c55e","#f59e0b","#a78bfa","#f87171","#60a5fa","#34d399","#fb923c","#818cf8","#94a3b8"];

const MONTHS = [
  { value: "1", label: "Janvier" }, { value: "2", label: "Février" }, { value: "3", label: "Mars" },
  { value: "4", label: "Avril" },   { value: "5", label: "Mai" },     { value: "6", label: "Juin" },
  { value: "7", label: "Juillet" }, { value: "8", label: "Août" },    { value: "9", label: "Septembre" },
  { value: "10", label: "Octobre" },{ value: "11", label: "Novembre" },{ value: "12", label: "Décembre" },
];

interface ConfigType { id: number; code: string; label: string; isActive: boolean; sortOrder: number; }

function fmtNum(n: number) { return n.toLocaleString("fr-FR"); }
function fmtAmt(n: number, cur?: string) {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}${cur ? " " + cur : ""}`;
}

function apiFetch(path: string) {
  return fetch(`${BASE}${path}`, { credentials: "include" }).then(r => r.json());
}

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <Card>
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
}

interface Filters {
  from: string; to: string; status: string; type: string; currency: string; year: string; month: string;
}
const EMPTY: Filters = { from: "", to: "", status: "", type: "", currency: "", year: "", month: "" };

export default function ConsultationsStats() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // ── Reference data from DB ─────────────────────────────────────────────────
  const { data: consultationTypes = [] } = useQuery<ConfigType[]>({
    queryKey: ["project-consultation-types"],
    queryFn: () => apiFetch("/api/project-consultation-types"),
  });

  const { data: serviceTypes = [] } = useQuery<ConfigType[]>({
    queryKey: ["project-service-types"],
    queryFn: () => apiFetch("/api/project-service-types"),
  });

  // Build lookup maps (code → label) from DB data
  const typeLabel = useMemo(() => Object.fromEntries(
    consultationTypes.filter(t => t.isActive).map(t => [t.code, t.label])
  ), [consultationTypes]);

  const serviceLabel = useMemo(() => Object.fromEntries(
    serviceTypes.filter(t => t.isActive).map(t => [t.code, t.label])
  ), [serviceTypes]);

  // ── Stats query ────────────────────────────────────────────────────────────
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (applied.from) p.set("from", applied.from);
    if (applied.to) p.set("to", applied.to);
    if (applied.status) p.set("status", applied.status);
    if (applied.type) p.set("type", applied.type);
    if (applied.currency) p.set("currency", applied.currency);
    if (applied.year) p.set("year", applied.year);
    if (applied.month) p.set("month", applied.month);
    return p.toString();
  }, [applied]);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["consultations-stats", params],
    queryFn: () => apiFetch(`/api/consultations/stats${params ? "?" + params : ""}`),
  });

  const activeFiltersCount = Object.values(applied).filter(Boolean).length;
  const handleApply = () => setApplied({ ...filters });
  const handleReset = () => { setFilters(EMPTY); setApplied(EMPTY); };

  // ── Derived chart data ─────────────────────────────────────────────────────
  const summary = data?.summary ?? {};

  const byStatus = (data?.byStatus ?? []).map((r: any) => ({
    ...r,
    name: STATUS_MAP[r.status]?.label ?? r.status,
    fill: STATUS_MAP[r.status]?.hex ?? "#94a3b8",
  }));

  const byType = (data?.byType ?? []).map((r: any) => ({
    ...r,
    name: typeLabel[r.type] ?? r.type,
  }));

  const byServiceType = (data?.byServiceType ?? []).map((r: any) => ({
    ...r,
    name: serviceLabel[r.code] ?? r.code,
  }));

  const byCountry = (data?.byCountry ?? []).filter((r: any) => r.country);
  const byCity = (data?.byCity ?? []).filter((r: any) => r.city);
  const byMonth = data?.byMonth ?? [];
  const byYear = (data?.byYear ?? []).map((r: any) => ({ ...r, name: String(r.year) }));
  const byCurrency = data?.byCurrency ?? [];

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => String(cur - i));
  }, []);

  const activeConsultationTypes = useMemo(() => consultationTypes.filter(t => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [consultationTypes]);
  const activeServiceTypes = useMemo(() => serviceTypes.filter(t => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [serviceTypes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Statistiques Consultations</h1>
        <p className="text-muted-foreground mt-1">Analyse dynamique de vos consultations & appels d'offres</p>
      </div>

      {/* Filtres */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer flex flex-row items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">Filtres</span>
                {activeFiltersCount > 0 && (
                  <Badge className="text-xs">{activeFiltersCount} actif{activeFiltersCount > 1 ? "s" : ""}</Badge>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label className="text-xs">Date de réception (du)</Label>
                  <Input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Date de réception (au)</Label>
                  <Input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Statut</Label>
                  <Select value={filters.status || "_all"} onValueChange={v => setFilters(f => ({ ...f, status: v === "_all" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Tous les statuts</SelectItem>
                      {Object.entries(STATUS_MAP).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Type de consultation</Label>
                  <Select value={filters.type || "_all"} onValueChange={v => setFilters(f => ({ ...f, type: v === "_all" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Tous les types</SelectItem>
                      {activeConsultationTypes.length > 0
                        ? activeConsultationTypes.map(t => (
                            <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                          ))
                        : <SelectItem value="_none" disabled>Aucun type configuré</SelectItem>
                      }
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Type de prestation</Label>
                  <Select value={filters.type || "_all"} onValueChange={v => setFilters(f => ({ ...f, type: v === "_all" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Toutes les prestations</SelectItem>
                      {activeServiceTypes.length > 0
                        ? activeServiceTypes.map(t => (
                            <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                          ))
                        : <SelectItem value="_none" disabled>Aucun type configuré</SelectItem>
                      }
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Devise</Label>
                  <Select value={filters.currency || "_all"} onValueChange={v => setFilters(f => ({ ...f, currency: v === "_all" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Toutes les devises</SelectItem>
                      {["MRU","USD","EUR","XOF","MAD","GBP","CNY"].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Année</Label>
                  <Select value={filters.year || "_all"} onValueChange={v => setFilters(f => ({ ...f, year: v === "_all" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Toutes</SelectItem>
                      {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Mois</Label>
                  <Select value={filters.month || "_all"} onValueChange={v => setFilters(f => ({ ...f, month: v === "_all" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Tous</SelectItem>
                      {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2 lg:col-start-4">
                  <Button className="flex-1" onClick={handleApply}>Appliquer</Button>
                  <Button variant="outline" size="icon" onClick={handleReset} title="Réinitialiser">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1,2,3,4,5].map(i => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Total" value={fmtNum(summary.total ?? 0)} icon={TrendingUp} color="text-blue-600" sub="Consultations analysées" />
            <StatCard title="Attribuées" value={fmtNum(summary.attribue ?? 0)} icon={Award} color="text-green-600" sub="Marchés remportés" />
            <StatCard title="Perdues" value={fmtNum(summary.perdu ?? 0)} icon={XCircle} color="text-destructive" />
            <StatCard title="En cours" value={fmtNum(summary.inProgress ?? 0)} icon={Clock} color="text-amber-600" sub="Reçu · Étude · Prop · Négo" />
            <StatCard
              title="Taux de succès"
              value={`${summary.winRate ?? 0} %`}
              icon={TrendingUp}
              color={(summary.winRate ?? 0) >= 50 ? "text-green-600" : "text-amber-600"}
              sub={`${summary.annule ?? 0} annulée(s)`}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Par statut */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Par statut</CardTitle></CardHeader>
              <CardContent>
                {byStatus.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byStatus} layout="vertical" margin={{ left: 30, right: 20, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={130} />
                        <RTooltip formatter={(v: number) => [fmtNum(v), "Consultations"]} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {byStatus.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <Empty />}
              </CardContent>
            </Card>

            {/* Par type de consultation */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Par type de consultation</CardTitle></CardHeader>
              <CardContent>
                {byType.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={byType} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} paddingAngle={3}
                          label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                          {byType.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <RTooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                        <Legend iconType="circle" iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <Empty />}
              </CardContent>
            </Card>

            {/* Par type de prestation */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Par type de prestation</CardTitle></CardHeader>
              <CardContent>
                {byServiceType.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byServiceType} layout="vertical" margin={{ left: 30, right: 20, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={140} />
                        <RTooltip formatter={(v: number) => [fmtNum(v), "Consultations"]} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {byServiceType.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <Empty />}
              </CardContent>
            </Card>

            {/* Par pays */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Par pays du partenaire</CardTitle></CardHeader>
              <CardContent>
                {byCountry.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byCountry} layout="vertical" margin={{ left: 20, right: 20, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="country" fontSize={11} tickLine={false} axisLine={false} width={110} />
                        <RTooltip formatter={(v: number) => [fmtNum(v), "Consultations"]} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {byCountry.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <Empty text="Aucun pays renseigné" />}
              </CardContent>
            </Card>

            {/* Par ville */}
            {byCity.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Par localité (ville)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byCity.slice(0, 15)} layout="vertical" margin={{ left: 20, right: 20, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="city" fontSize={11} tickLine={false} axisLine={false} width={110} />
                        <RTooltip formatter={(v: number) => [fmtNum(v), "Consultations"]} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="count" fill="#a78bfa" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Évolution mensuelle */}
            <Card className={byCity.length > 0 ? "" : "lg:col-span-2"}>
              <CardHeader><CardTitle className="text-sm">Évolution mensuelle</CardTitle></CardHeader>
              <CardContent>
                {byMonth.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={byMonth} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <RTooltip formatter={(v: number) => [fmtNum(v), "Consultations"]} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                        <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <Empty />}
              </CardContent>
            </Card>

            {/* Par année */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Par année</CardTitle></CardHeader>
              <CardContent>
                {byYear.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byYear} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <RTooltip formatter={(v: number) => [fmtNum(v), "Consultations"]} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <Empty />}
              </CardContent>
            </Card>
          </div>

          {/* Tableau devises */}
          {byCurrency.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Répartition par devise</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2 pr-4">Devise</th>
                        <th className="text-right py-2 pr-4">Nombre</th>
                        <th className="text-right py-2">Montant estimé total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byCurrency.map((r: any) => (
                        <tr key={r.currency} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-mono font-semibold">{r.currency}</td>
                          <td className="text-right py-2 pr-4">{fmtNum(r.count)}</td>
                          <td className="text-right py-2 font-medium text-green-700">{fmtAmt(r.totalAmount, r.currency)}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/30 font-semibold">
                        <td className="py-2 pr-4">Total</td>
                        <td className="text-right py-2 pr-4">{fmtNum(byCurrency.reduce((s: number, r: any) => s + r.count, 0))}</td>
                        <td className="text-right py-2 text-muted-foreground text-xs italic">Multi-devises</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Empty({ text = "Aucune donnée" }: { text?: string }) {
  return <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">{text}</div>;
}
