import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Mountain, Anchor, Plus, Pencil, Trash2, FileText,
  CheckCircle2, AlertTriangle, MapPin, Users, Calendar, CreditCard, ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const PROJECT_STATUS = [
  { value: "preparation",  label: "Préparation" },
  { value: "mobilisation", label: "Mobilisation" },
  { value: "en_cours",     label: "En cours" },
  { value: "suspendu",     label: "Suspendu" },
  { value: "achevement",   label: "Achèvement" },
  { value: "facture",      label: "Facturé" },
  { value: "clot",         label: "Clôturé" },
];
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  preparation:  { label: "Préparation",  color: "bg-blue-100 text-blue-700" },
  mobilisation: { label: "Mobilisation", color: "bg-yellow-100 text-yellow-700" },
  en_cours:     { label: "En cours",     color: "bg-green-100 text-green-700" },
  suspendu:     { label: "Suspendu",     color: "bg-red-100 text-red-700" },
  achevement:   { label: "Achèvement",   color: "bg-teal-100 text-teal-700" },
  facture:      { label: "Facturé",      color: "bg-purple-100 text-purple-700" },
  clot:         { label: "Clôturé",      color: "bg-gray-100 text-gray-600" },
};
const SITE_STATUS = [
  { value: "planifie",     label: "Planifié" },
  { value: "mobilisation", label: "Mobilisation" },
  { value: "en_cours",     label: "En cours" },
  { value: "termine",      label: "Terminé" },
];
const SITE_STATUS_MAP: Record<string, string> = {
  planifie: "bg-blue-100 text-blue-700", mobilisation: "bg-yellow-100 text-yellow-700",
  en_cours: "bg-green-100 text-green-700", termine: "bg-gray-100 text-gray-600",
};
const REPORT_TYPES = [
  { value: "avancement",  label: "Avancement" },
  { value: "journalier",  label: "Journalier" },
  { value: "hebdomadaire",label: "Hebdomadaire" },
  { value: "final",       label: "Final" },
  { value: "hse",         label: "HSE" },
  { value: "incident",    label: "Incident" },
];
const REPORT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  brouillon:     { label: "Brouillon",        color: "bg-gray-100 text-gray-600" },
  soumis:        { label: "Soumis",           color: "bg-yellow-100 text-yellow-700" },
  valide:        { label: "Validé",           color: "bg-green-100 text-green-700" },
  transmis_client:{ label: "Transmis client", color: "bg-blue-100 text-blue-700" },
};

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || "Erreur serveur");
  return body;
}

interface Site {
  id: number; name: string; type: string; location?: string; waterDepth?: string;
  status: string; plannedStart?: string; plannedEnd?: string;
  actualStart?: string; actualEnd?: string; notes?: string;
}
interface Report {
  id: number; reference: string; type: string; title: string; reportDate: string;
  periodStart?: string; periodEnd?: string; summary?: string;
  progressPercent: number; issuesEncountered?: string; nextSteps?: string;
  hseObservations?: string; author?: string; status: string;
  siteId?: number;
}
interface Project {
  id: number; reference: string; title: string; status: string;
  serviceTypes?: string; startDate?: string; endDatePlanned?: string;
  endDateActual?: string; contractAmount?: string; currency: string;
  onshore: boolean; offshore: boolean; location?: string;
  commercialManager?: string; technicalManager?: string; hseManager?: string;
  specifications?: string; contractualTerms?: string;
  billingStatus: string; notes?: string;
  sites: Site[];
  reports: Report[];
}

type Tab = "general" | "sites" | "rapports";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("general");
  const [editStatusOpen, setEditStatusOpen] = useState(false);
  const [editStatus, setEditStatus] = useState("");

  // Sites
  const [siteOpen, setSiteOpen] = useState(false);
  const [editSite, setEditSite] = useState<Partial<Site> | null>(null);
  const [siteForm, setSiteForm] = useState<Partial<Site>>({});
  const [sitePending, setSitePending] = useState(false);

  // Reports
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState<Partial<Report>>({ type: "avancement", progressPercent: 0 });
  const [reportPending, setReportPending] = useState(false);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: () => apiFetch(`${BASE}/api/projects/${id}`),
  });

  if (isLoading) return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!project) return <div className="text-center text-muted-foreground py-12">Projet introuvable</div>;

  const st = STATUS_MAP[project.status] ?? { label: project.status, color: "bg-gray-100 text-gray-600" };
  const avgProgress = project.reports.length > 0
    ? Math.round(project.reports.reduce((s, r) => s + r.progressPercent, 0) / project.reports.length)
    : 0;

  async function handleStatusChange() {
    try {
      await apiFetch(`${BASE}/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus }),
      });
      toast({ title: "Statut mis à jour" });
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setEditStatusOpen(false);
    } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
  }

  // Sites handlers
  function openNewSite() {
    setEditSite(null);
    setSiteForm({ type: "onshore", status: "planifie" });
    setSiteOpen(true);
  }
  function openEditSite(s: Site) {
    setEditSite(s);
    setSiteForm({ ...s });
    setSiteOpen(true);
  }

  async function handleSiteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSitePending(true);
    try {
      if (editSite) {
        await apiFetch(`${BASE}/api/projects/${id}/sites/${editSite.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(siteForm),
        });
      } else {
        await apiFetch(`${BASE}/api/projects/${id}/sites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(siteForm),
        });
      }
      toast({ title: editSite ? "Site mis à jour" : "Site ajouté" });
      qc.invalidateQueries({ queryKey: ["project", id] });
      setSiteOpen(false);
    } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
    finally { setSitePending(false); }
  }

  async function handleDeleteSite(siteId: number) {
    if (!confirm("Supprimer ce site ?")) return;
    try {
      await apiFetch(`${BASE}/api/projects/${id}/sites/${siteId}`, { method: "DELETE" });
      toast({ title: "Site supprimé" });
      qc.invalidateQueries({ queryKey: ["project", id] });
    } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
  }

  // Reports handlers
  async function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setReportPending(true);
    try {
      await apiFetch(`${BASE}/api/projects/${id}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportForm),
      });
      toast({ title: "Rapport créé" });
      qc.invalidateQueries({ queryKey: ["project", id] });
      setReportOpen(false);
      setReportForm({ type: "avancement", progressPercent: 0 });
    } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
    finally { setReportPending(false); }
  }

  async function handleReportStatusChange(reportId: number, status: string) {
    try {
      await apiFetch(`${BASE}/api/projects/${id}/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      qc.invalidateQueries({ queryKey: ["project", id] });
    } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
  }

  async function handleDeleteReport(reportId: number) {
    if (!confirm("Supprimer ce rapport ?")) return;
    try {
      await apiFetch(`${BASE}/api/projects/${id}/reports/${reportId}`, { method: "DELETE" });
      toast({ title: "Rapport supprimé" });
      qc.invalidateQueries({ queryKey: ["project", id] });
    } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/projects/list">
          <Button variant="ghost" size="icon" className="mt-0.5"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{project.title}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>{st.label}</span>
            {project.onshore && <Badge variant="outline" className="text-xs"><Mountain className="w-3 h-3 mr-1" />Onshore</Badge>}
            {project.offshore && <Badge variant="outline" className="text-xs"><Anchor className="w-3 h-3 mr-1" />Offshore</Badge>}
          </div>
          <p className="text-sm font-mono text-muted-foreground mt-1">{project.reference}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setEditStatus(project.status); setEditStatusOpen(true); }}>
          <Pencil className="w-3.5 h-3.5 mr-1.5" /> Statut
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Montant contractuel</p>
            <p className="text-lg font-bold mt-0.5">
              {project.contractAmount ? `${Number(project.contractAmount).toLocaleString("fr-FR")} ${project.currency}` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Sites</p>
            <p className="text-lg font-bold mt-0.5">{project.sites.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Rapports</p>
            <p className="text-lg font-bold mt-0.5">{project.reports.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Avancement moyen</p>
            <div className="flex items-center gap-2">
              <Progress value={avgProgress} className="flex-1 h-2" />
              <span className="text-sm font-bold">{avgProgress}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0">
        {(["general", "sites", "rapports"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize
              ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "general" ? "Général" : t === "sites" ? `Sites (${project.sites.length})` : `Rapports (${project.reports.length})`}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {tab === "general" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" />Planning</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: "Début", val: project.startDate },
                { label: "Fin prévue", val: project.endDatePlanned },
                { label: "Fin réelle", val: project.endDateActual },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-medium">
                    {r.val ? format(new Date(r.val), "dd MMMM yyyy", { locale: fr }) : "—"}
                  </span>
                </div>
              ))}
              {project.location && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />Zone</span>
                  <span className="font-medium">{project.location}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />Équipes</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: "Commercial", val: project.commercialManager },
                { label: "Technique", val: project.technicalManager },
                { label: "HSE", val: project.hseManager },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-medium">{r.val || "—"}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4" />Facturation</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Statut facturation</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium 
                  ${project.billingStatus === "non_facture" ? "bg-gray-100 text-gray-600" : project.billingStatus === "regle" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                  {project.billingStatus.replace(/_/g, " ")}
                </span>
              </div>
            </CardContent>
          </Card>

          {project.specifications && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Cahier des charges</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{project.specifications}</p>
              </CardContent>
            </Card>
          )}

          {project.notes && (
            <Card className="col-span-1 md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap text-muted-foreground">{project.notes}</p></CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Sites Tab */}
      {tab === "sites" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewSite} className="gap-2"><Plus className="w-4 h-4" />Ajouter un site</Button>
          </div>
          {project.sites.length === 0 ? (
            <Card><CardContent className="text-center py-12 text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>Aucun site défini. Ajoutez les sites d'intervention.</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {project.sites.map(s => (
                <Card key={s.id} className="relative">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {s.type === "offshore" ? <Anchor className="w-4 h-4 text-blue-500" /> : <Mountain className="w-4 h-4 text-green-600" />}
                        <h3 className="font-semibold">{s.name}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSite(s)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSite(s.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SITE_STATUS_MAP[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {SITE_STATUS.find(x => x.value === s.status)?.label ?? s.status}
                      </span>
                      {s.location && <p className="text-muted-foreground mt-2 flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</p>}
                      {s.waterDepth && <p className="text-muted-foreground">Profondeur: {s.waterDepth} m</p>}
                      {(s.plannedStart || s.plannedEnd) && (
                        <p className="text-muted-foreground">
                          {s.plannedStart && format(new Date(s.plannedStart), "dd/MM/yy")} → {s.plannedEnd && format(new Date(s.plannedEnd), "dd/MM/yy")}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {tab === "rapports" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setReportOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Nouveau rapport</Button>
          </div>
          {project.reports.length === 0 ? (
            <Card><CardContent className="text-center py-12 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>Aucun rapport d'avancement. Commencez par créer le premier rapport.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {project.reports.map(r => {
                const rs = REPORT_STATUS_MAP[r.status] ?? { label: r.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <Card key={r.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                            <Badge variant="outline" className="text-xs">
                              {REPORT_TYPES.find(t => t.value === r.type)?.label ?? r.type}
                            </Badge>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${rs.color}`}>{rs.label}</span>
                          </div>
                          <h4 className="font-medium mt-1">{r.title}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(r.reportDate), "dd MMMM yyyy", { locale: fr })}
                            {r.author && ` — ${r.author}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">{r.progressPercent}%</p>
                            <p className="text-xs text-muted-foreground">Avancement</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteReport(r.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      <Progress value={r.progressPercent} className="mt-3 h-1.5" />

                      {r.summary && <p className="text-sm mt-3 text-muted-foreground">{r.summary}</p>}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        {r.issuesEncountered && (
                          <div className="bg-red-50 rounded-md p-2.5">
                            <p className="text-xs font-medium text-red-700 flex items-center gap-1 mb-1"><AlertTriangle className="w-3 h-3" />Difficultés</p>
                            <p className="text-xs text-red-600">{r.issuesEncountered}</p>
                          </div>
                        )}
                        {r.nextSteps && (
                          <div className="bg-blue-50 rounded-md p-2.5">
                            <p className="text-xs font-medium text-blue-700 flex items-center gap-1 mb-1"><CheckCircle2 className="w-3 h-3" />Prochaines étapes</p>
                            <p className="text-xs text-blue-600">{r.nextSteps}</p>
                          </div>
                        )}
                        {r.hseObservations && (
                          <div className="bg-orange-50 rounded-md p-2.5">
                            <p className="text-xs font-medium text-orange-700 flex items-center gap-1 mb-1"><ShieldCheck className="w-3 h-3" />HSE</p>
                            <p className="text-xs text-orange-600">{r.hseObservations}</p>
                          </div>
                        )}
                      </div>

                      {/* Changer statut rapport */}
                      <div className="flex items-center gap-1.5 mt-3 pt-2 border-t">
                        <span className="text-xs text-muted-foreground mr-1">Statut :</span>
                        {Object.entries(REPORT_STATUS_MAP).map(([k, v]) => (
                          <button key={k} onClick={() => handleReportStatusChange(r.id, k)}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium border transition-opacity
                              ${r.status === k ? "opacity-100" : "opacity-40 hover:opacity-70 cursor-pointer"} ${v.color}`}>
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Status Dialog */}
      <Dialog open={editStatusOpen} onOpenChange={setEditStatusOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Changer le statut du projet</DialogTitle></DialogHeader>
          <Select value={editStatus} onValueChange={setEditStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROJECT_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStatusOpen(false)}>Annuler</Button>
            <Button onClick={handleStatusChange}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Site Dialog */}
      <Dialog open={siteOpen} onOpenChange={setSiteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editSite ? "Modifier le site" : "Ajouter un site"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSiteSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nom du site *</Label>
                <Input value={siteForm.name ?? ""} onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={siteForm.type ?? "onshore"} onValueChange={v => setSiteForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onshore">Onshore</SelectItem>
                    <SelectItem value="offshore">Offshore</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={siteForm.status ?? "planifie"} onValueChange={v => setSiteForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SITE_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Début planifié</Label>
                <Input type="date" value={siteForm.plannedStart?.substring(0, 10) ?? ""}
                  onChange={e => setSiteForm(f => ({ ...f, plannedStart: e.target.value }))} />
              </div>
              <div>
                <Label>Fin planifiée</Label>
                <Input type="date" value={siteForm.plannedEnd?.substring(0, 10) ?? ""}
                  onChange={e => setSiteForm(f => ({ ...f, plannedEnd: e.target.value }))} />
              </div>
              {siteForm.type === "offshore" && (
                <div>
                  <Label>Profondeur eau (m)</Label>
                  <Input type="number" value={siteForm.waterDepth ?? ""}
                    onChange={e => setSiteForm(f => ({ ...f, waterDepth: e.target.value }))} />
                </div>
              )}
              <div className="col-span-2">
                <Label>Localisation / Coordonnées</Label>
                <Input value={siteForm.location ?? ""} onChange={e => setSiteForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={siteForm.notes ?? ""} onChange={e => setSiteForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSiteOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={sitePending}>{sitePending ? "Enregistrement..." : "Enregistrer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouveau rapport d'avancement</DialogTitle></DialogHeader>
          <form onSubmit={handleReportSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Titre du rapport *</Label>
                <Input value={reportForm.title ?? ""} onChange={e => setReportForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={reportForm.type ?? "avancement"} onValueChange={v => setReportForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date du rapport</Label>
                <Input type="date" value={reportForm.reportDate?.substring(0, 10) ?? new Date().toISOString().substring(0, 10)}
                  onChange={e => setReportForm(f => ({ ...f, reportDate: e.target.value }))} />
              </div>
              <div>
                <Label>Auteur</Label>
                <Input value={reportForm.author ?? ""} onChange={e => setReportForm(f => ({ ...f, author: e.target.value }))} />
              </div>
              <div>
                <Label>Site concerné</Label>
                <Select value={reportForm.siteId?.toString() ?? ""}
                  onValueChange={v => setReportForm(f => ({ ...f, siteId: v ? Number(v) : undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Tous les sites" /></SelectTrigger>
                  <SelectContent>
                    {project.sites.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Période du</Label>
                <Input type="date" value={reportForm.periodStart?.substring(0, 10) ?? ""}
                  onChange={e => setReportForm(f => ({ ...f, periodStart: e.target.value }))} />
              </div>
              <div>
                <Label>au</Label>
                <Input type="date" value={reportForm.periodEnd?.substring(0, 10) ?? ""}
                  onChange={e => setReportForm(f => ({ ...f, periodEnd: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Avancement global : <strong>{reportForm.progressPercent ?? 0}%</strong></Label>
              <input type="range" min={0} max={100} value={reportForm.progressPercent ?? 0}
                onChange={e => setReportForm(f => ({ ...f, progressPercent: Number(e.target.value) }))}
                className="w-full mt-1" />
            </div>

            <div>
              <Label>Résumé des travaux réalisés</Label>
              <Textarea value={reportForm.summary ?? ""} onChange={e => setReportForm(f => ({ ...f, summary: e.target.value }))} rows={3} />
            </div>
            <div>
              <Label className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-red-500" />Difficultés / Problèmes rencontrés</Label>
              <Textarea value={reportForm.issuesEncountered ?? ""} onChange={e => setReportForm(f => ({ ...f, issuesEncountered: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />Prochaines étapes</Label>
              <Textarea value={reportForm.nextSteps ?? ""} onChange={e => setReportForm(f => ({ ...f, nextSteps: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-orange-500" />Observations HSE</Label>
              <Textarea value={reportForm.hseObservations ?? ""} onChange={e => setReportForm(f => ({ ...f, hseObservations: e.target.value }))} rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={reportPending}>{reportPending ? "Enregistrement..." : "Créer le rapport"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
