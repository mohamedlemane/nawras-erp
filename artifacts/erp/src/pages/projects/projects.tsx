import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FolderKanban, Anchor, Mountain, Search, ChevronRight, Activity, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const DEFAULT_SERVICE_TYPES = [
  { code: "geotechnique", label: "Géotechnique" },
  { code: "bathymetrie", label: "Bathymétrie" },
  { code: "essais", label: "Essais en laboratoire" },
  { code: "topographie", label: "Topographie" },
  { code: "inspection", label: "Inspection sous-marine" },
  { code: "environnement", label: "Étude environnementale" },
  { code: "structure", label: "Ingénierie structurale" },
  { code: "autre", label: "Autre" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  preparation:  { label: "Préparation",   color: "bg-blue-100 text-blue-700" },
  mobilisation: { label: "Mobilisation",  color: "bg-yellow-100 text-yellow-700" },
  en_cours:     { label: "En cours",      color: "bg-green-100 text-green-700" },
  suspendu:     { label: "Suspendu",      color: "bg-red-100 text-red-700" },
  achevement:   { label: "Achèvement",    color: "bg-teal-100 text-teal-700" },
  facture:      { label: "Facturé",       color: "bg-purple-100 text-purple-700" },
  clot:         { label: "Clôturé",       color: "bg-gray-100 text-gray-600" },
};

const BILLING_MAP: Record<string, { label: string; color: string }> = {
  non_facture:           { label: "Non facturé",   color: "bg-gray-100 text-gray-600" },
  partiellement_facture: { label: "Part. facturé", color: "bg-orange-100 text-orange-700" },
  facture:               { label: "Facturé",       color: "bg-green-100 text-green-700" },
  regle:                 { label: "Réglé",         color: "bg-blue-100 text-blue-700" },
};

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || "Erreur serveur");
  return body;
}

interface Project {
  id: number; reference: string; title: string; status: string;
  partnerId?: number; serviceTypes?: string; startDate?: string;
  endDatePlanned?: string; contractAmount?: string; currency: string;
  onshore: boolean; offshore: boolean; location?: string;
  commercialManager?: string; commercialManagerId?: number;
  technicalManager?: string; technicalManagerId?: number;
  hseManager?: string; hseManagerId?: number;
  billingStatus: string; notes?: string;
}

interface Employee {
  id: number; firstName: string; lastName: string;
  positionId?: number; positionName?: string;
}

interface PType { id: number; code: string; label: string; isActive: boolean; }

const EMPTY: Partial<Project> = {
  title: "", status: "preparation", currency: "MRU", onshore: true, offshore: false,
};

export default function Projects() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<Partial<Project>>(EMPTY);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch(`${BASE}/api/projects`),
  });
  const { data: employeesData } = useQuery({
    queryKey: ["employees-all"],
    queryFn: () => apiFetch(`${BASE}/api/employees?limit=200`),
  });
  const { data: positionsData } = useQuery({
    queryKey: ["positions"],
    queryFn: () => apiFetch(`${BASE}/api/positions`),
  });
  const { data: serviceTypesData } = useQuery<PType[]>({
    queryKey: ["project-service-types"],
    queryFn: () => apiFetch(`${BASE}/api/project-service-types`),
  });

  const projects: Project[] = data?.data ?? [];
  const rawEmployees: Employee[] = employeesData?.data ?? employeesData ?? [];
  const positions: { id: number; name: string }[] = positionsData ?? [];

  // Enrichir les employés avec le nom de poste
  const employees: Employee[] = rawEmployees.map(e => ({
    ...e,
    positionName: positions.find(p => p.id === e.positionId)?.name,
  }));

  const serviceTypes = (serviceTypesData && serviceTypesData.length > 0)
    ? serviceTypesData.filter(t => t.isActive).map(t => ({ code: t.code, label: t.label }))
    : DEFAULT_SERVICE_TYPES;

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || p.title.toLowerCase().includes(q) || (p.reference ?? "").toLowerCase().includes(q);
    const matchS = filterStatus === "all" || p.status === filterStatus;
    return matchQ && matchS;
  });

  const stats = {
    total: projects.length,
    actifs: projects.filter(p => ["mobilisation", "en_cours"].includes(p.status)).length,
    achevement: projects.filter(p => p.status === "achevement").length,
    afacturer: projects.filter(p => ["achevement", "facture"].includes(p.status) && p.billingStatus === "non_facture").length,
  };

  function toggleService(v: string) {
    setSelectedServices(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]);
  }

  function getServiceLabel(code: string): string {
    return serviceTypes.find(x => x.code === code)?.label ?? code;
  }

  function getEmployeeFullName(id?: number): string {
    if (!id) return "";
    const e = employees.find(x => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "";
  }

  function handleEmployeeSelect(field: "commercial" | "technical" | "hse", empId: string) {
    if (empId === "none") {
      if (field === "commercial") setForm(f => ({ ...f, commercialManagerId: undefined, commercialManager: undefined }));
      if (field === "technical") setForm(f => ({ ...f, technicalManagerId: undefined, technicalManager: undefined }));
      if (field === "hse") setForm(f => ({ ...f, hseManagerId: undefined, hseManager: undefined }));
      return;
    }
    const id = Number(empId);
    const name = getEmployeeFullName(id);
    if (field === "commercial") setForm(f => ({ ...f, commercialManagerId: id, commercialManager: name }));
    if (field === "technical") setForm(f => ({ ...f, technicalManagerId: id, technicalManager: name }));
    if (field === "hse") setForm(f => ({ ...f, hseManagerId: id, hseManager: name }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await apiFetch(`${BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, serviceTypes: selectedServices }),
      });
      toast({ title: "Projet créé" });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setCreateOpen(false);
      setForm(EMPTY);
      setSelectedServices([]);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setPending(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Réalisation des prestations attribuées</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setSelectedServices([]); setCreateOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nouveau projet
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total projets", value: stats.total, icon: FolderKanban, color: "text-blue-600" },
          { label: "Actifs (terrain)", value: stats.actifs, icon: Activity, color: "text-green-600" },
          { label: "En achèvement", value: stats.achevement, icon: Mountain, color: "text-teal-600" },
          { label: "À facturer", value: stats.afacturer, icon: Anchor, color: "text-orange-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Projet</TableHead>
                <TableHead>Prestations</TableHead>
                <TableHead>Responsables</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Facturation</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center h-24 text-muted-foreground">Aucun projet</TableCell></TableRow>
              ) : filtered.map(p => {
                const services: string[] = p.serviceTypes ? JSON.parse(p.serviceTypes) : [];
                const st = STATUS_MAP[p.status] ?? { label: p.status, color: "bg-gray-100 text-gray-600" };
                const bs = BILLING_MAP[p.billingStatus] ?? { label: p.billingStatus, color: "bg-gray-100 text-gray-600" };
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.reference}</TableCell>
                    <TableCell>
                      <p className="font-medium">{p.title}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {p.onshore && <Badge variant="outline" className="text-xs py-0"><Mountain className="w-2.5 h-2.5 mr-0.5" />Onshore</Badge>}
                        {p.offshore && <Badge variant="outline" className="text-xs py-0"><Anchor className="w-2.5 h-2.5 mr-0.5" />Offshore</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {services.slice(0, 2).map(s => (
                          <Badge key={s} variant="secondary" className="text-xs">{getServiceLabel(s)}</Badge>
                        ))}
                        {services.length > 2 && <Badge variant="secondary" className="text-xs">+{services.length - 2}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs space-y-0.5">
                      {p.commercialManager && <div className="flex items-center gap-1 text-muted-foreground"><User className="w-3 h-3" /><span>Com: {p.commercialManager}</span></div>}
                      {p.technicalManager && <div className="text-muted-foreground">Tec: {p.technicalManager}</div>}
                      {p.hseManager && <div className="text-muted-foreground">HSE: {p.hseManager}</div>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.startDate && <div>Début: {format(new Date(p.startDate), "dd/MM/yy")}</div>}
                      {p.endDatePlanned && <div className="text-muted-foreground">Fin prév: {format(new Date(p.endDatePlanned), "dd/MM/yy")}</div>}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {p.contractAmount ? `${Number(p.contractAmount).toLocaleString("fr-FR")} ${p.currency}` : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>{st.label}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bs.color}`}>{bs.label}</span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/projects/${p.id}`}>
                        <Button variant="ghost" size="icon"><ChevronRight className="w-4 h-4" /></Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau projet</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Titre du projet *</Label>
                <Input value={form.title ?? ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>

              <div>
                <Label>Date de début</Label>
                <Input type="date" value={form.startDate?.substring(0, 10) ?? ""}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>Date de fin prévue</Label>
                <Input type="date" value={form.endDatePlanned?.substring(0, 10) ?? ""}
                  onChange={e => setForm(f => ({ ...f, endDatePlanned: e.target.value }))} />
              </div>
              <div>
                <Label>Montant contractuel</Label>
                <Input type="number" placeholder="0" value={form.contractAmount ?? ""}
                  onChange={e => setForm(f => ({ ...f, contractAmount: e.target.value }))} />
              </div>
              <div>
                <Label>Devise</Label>
                <Select value={form.currency ?? "MRU"} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MRU">MRU (Ouguiya)</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Responsables depuis GRH */}
              <div className="col-span-2 border-t pt-3">
                <p className="text-sm font-medium text-muted-foreground mb-2">Responsables du projet (depuis GRH)</p>
              </div>

              <div>
                <Label className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-blue-600" />Responsable commercial</Label>
                <Select
                  value={form.commercialManagerId ? String(form.commercialManagerId) : "none"}
                  onValueChange={v => handleEmployeeSelect("commercial", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un employé..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucun —</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.firstName} {e.lastName}
                        {e.positionName && <span className="text-muted-foreground"> — {e.positionName}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-green-600" />Responsable technique</Label>
                <Select
                  value={form.technicalManagerId ? String(form.technicalManagerId) : "none"}
                  onValueChange={v => handleEmployeeSelect("technical", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un employé..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucun —</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.firstName} {e.lastName}
                        {e.positionName && <span className="text-muted-foreground"> — {e.positionName}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-orange-600" />Responsable HSE</Label>
                <Select
                  value={form.hseManagerId ? String(form.hseManagerId) : "none"}
                  onValueChange={v => handleEmployeeSelect("hse", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un employé..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucun —</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.firstName} {e.lastName}
                        {e.positionName && <span className="text-muted-foreground"> — {e.positionName}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Localisation générale</Label>
                <Input value={form.location ?? ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Ex: Golfe de Nouadhibou" />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.onshore ?? true}
                  onChange={e => setForm(f => ({ ...f, onshore: e.target.checked }))} />
                <Mountain className="w-4 h-4" /> Onshore
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.offshore ?? false}
                  onChange={e => setForm(f => ({ ...f, offshore: e.target.checked }))} />
                <Anchor className="w-4 h-4" /> Offshore
              </label>
            </div>

            {/* Types de prestations dynamiques */}
            <div>
              <Label className="mb-2 block">
                Types de prestations
                {serviceTypes === DEFAULT_SERVICE_TYPES && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    (valeurs par défaut — configurez dans Paramètres)
                  </span>
                )}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {serviceTypes.map(s => (
                  <label key={s.code} className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors
                    ${selectedServices.includes(s.code) ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                    <input type="checkbox" className="rounded" checked={selectedServices.includes(s.code)}
                      onChange={() => toggleService(s.code)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Cahier des charges (résumé)</Label>
              <Textarea value={form.specifications ?? ""} onChange={e => setForm(f => ({ ...f, specifications: e.target.value }))} rows={3} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={pending}>{pending ? "Création..." : "Créer le projet"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
