import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactSelect from "react-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText, Search, ChevronRight, TrendingUp, Clock, CheckCircle2, XCircle, Building2, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { AttachmentsPanel } from "@/components/projects/AttachmentsPanel";
import { CurrencySelect } from "@/components/CurrencySelect";
import { rsClassNames, rsPortalStyles } from "@/lib/rs-styles";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const PAGE_SIZE = 10;

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

const DEFAULT_CONSULTATION_TYPES = [
  { code: "rfq", label: "Demande de cotation (RFQ)" },
  { code: "rfp", label: "Demande de proposition (RFP)" },
  { code: "appel_offre_national", label: "Appel d'offres national" },
  { code: "appel_offre_international", label: "Appel d'offres international" },
  { code: "gre_a_gre", label: "Gré à gré" },
  { code: "accord_cadre", label: "Accord cadre" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  recu:                { label: "Reçu",               color: "bg-blue-100 text-blue-700" },
  en_etude:            { label: "En étude",            color: "bg-yellow-100 text-yellow-700" },
  proposition_envoyee: { label: "Proposition envoyée", color: "bg-orange-100 text-orange-700" },
  en_negociation:      { label: "En négociation",      color: "bg-purple-100 text-purple-700" },
  attribue:            { label: "Attribué ✓",          color: "bg-green-100 text-green-700" },
  perdu:               { label: "Perdu",               color: "bg-red-100 text-red-700" },
  annule:              { label: "Annulé",              color: "bg-gray-100 text-gray-600" },
};

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || "Erreur serveur");
  return body;
}

function deadlineStatus(deadlineAt: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(deadlineAt); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `Dépassé de ${Math.abs(diff)} j`, cls: "text-destructive font-semibold", badge: "bg-red-100 text-red-700" };
  if (diff === 0) return { label: "Aujourd'hui !", cls: "text-orange-600 font-semibold", badge: "bg-orange-100 text-orange-700" };
  if (diff === 1) return { label: "Demain", cls: "text-orange-500 font-medium", badge: "bg-orange-100 text-orange-700" };
  if (diff <= 7) return { label: `${diff} j restants`, cls: "text-amber-600 font-medium", badge: "bg-amber-100 text-amber-700" };
  return { label: `${diff} j restants`, cls: "text-muted-foreground", badge: "bg-gray-100 text-gray-600" };
}

interface Consultation {
  id: number; reference: string; title: string; partnerId?: number;
  clientRef?: string; type: string; serviceTypes?: string;
  description?: string; receivedAt: string; deadlineAt?: string;
  status: string; estimatedAmount?: string; currency: string;
  notes?: string; lostReason?: string;
}

interface Partner { id: number; name: string; companyName?: string; }
interface PType { id: number; code: string; label: string; isActive: boolean; }

const EMPTY: Partial<Consultation> = {
  title: "", type: "", status: "recu", currency: "MRU",
};

export default function Consultations() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<Partial<Consultation>>(EMPTY);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [detailItem, setDetailItem] = useState<Consultation | null>(null);
  const [pending, setPending] = useState(false);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data } = useQuery({
    queryKey: ["consultations"],
    queryFn: () => apiFetch(`${BASE}/api/consultations`),
  });
  const { data: partnersData } = useQuery({
    queryKey: ["partners-all"],
    queryFn: () => apiFetch(`${BASE}/api/partners?type=customer&limit=500`),
  });
  const { data: serviceTypesData } = useQuery<PType[]>({
    queryKey: ["project-service-types"],
    queryFn: () => apiFetch(`${BASE}/api/project-service-types`),
  });
  const { data: consultationTypesData } = useQuery<PType[]>({
    queryKey: ["project-consultation-types"],
    queryFn: () => apiFetch(`${BASE}/api/project-consultation-types`),
  });

  const consultations: Consultation[] = data?.data ?? [];
  const partners: Partner[] = partnersData?.data ?? [];

  const serviceTypes = (serviceTypesData && serviceTypesData.length > 0)
    ? serviceTypesData.filter(t => t.isActive).map(t => ({ code: t.code, label: t.label }))
    : DEFAULT_SERVICE_TYPES;
  const consultationTypes = (consultationTypesData && consultationTypesData.length > 0)
    ? consultationTypesData.filter(t => t.isActive).map(t => ({ code: t.code, label: t.label }))
    : DEFAULT_CONSULTATION_TYPES;

  // Options pour react-select
  const partnerOptions = [
    { value: "", label: "— Aucun client lié —" },
    ...partners.map(p => ({
      value: String(p.id),
      label: p.companyName ? `${p.companyName} (${p.name})` : p.name,
    })),
  ];

  const consultationTypeOptions = consultationTypes.map(t => ({ value: t.code, label: t.label }));

  const filtered = consultations.filter(c => {
    const q = search.toLowerCase();
    const matchQ = !q || c.title.toLowerCase().includes(q) || (c.reference ?? "").toLowerCase().includes(q);
    const matchS = filterStatus === "all" || c.status === filterStatus;
    return matchQ && matchS;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: consultations.length,
    enCours: consultations.filter(c => ["recu","en_etude","proposition_envoyee","en_negociation"].includes(c.status)).length,
    attribuees: consultations.filter(c => c.status === "attribue").length,
    taux: consultations.length > 0
      ? Math.round((consultations.filter(c => c.status === "attribue").length / consultations.length) * 100)
      : 0,
  };

  function toggleService(v: string) {
    setSelectedServices(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]);
  }

  function openCreate() {
    setForm({ ...EMPTY, type: consultationTypes[0]?.code ?? "rfq" });
    setSelectedServices([]);
    setCreateOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await apiFetch(`${BASE}/api/consultations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, serviceTypes: selectedServices }),
      });
      toast({ title: "Consultation créée" });
      qc.invalidateQueries({ queryKey: ["consultations"] });
      setCreateOpen(false);
      setForm(EMPTY);
      setSelectedServices([]);
      setPage(1);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setPending(false); }
  }

  async function handleStatusChange(id: number, status: string) {
    try {
      await apiFetch(`${BASE}/api/consultations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast({ title: "Statut mis à jour" });
      qc.invalidateQueries({ queryKey: ["consultations"] });
      if (detailItem?.id === id) setDetailItem(v => v ? { ...v, status } : v);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Supprimer cette consultation ?")) return;
    try {
      await apiFetch(`${BASE}/api/consultations/${id}`, { method: "DELETE" });
      toast({ title: "Consultation supprimée" });
      qc.invalidateQueries({ queryKey: ["consultations"] });
      setDetailItem(null);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  }

  function getPartnerName(partnerId?: number): string {
    if (!partnerId) return "—";
    const p = partners.find(x => x.id === partnerId);
    return p ? (p.companyName || p.name) : `#${partnerId}`;
  }

  function getServiceLabel(code: string): string {
    return serviceTypes.find(x => x.code === code)?.label ?? code;
  }

  function getTypeLabel(code: string): string {
    return consultationTypes.find(x => x.code === code)?.label ?? code;
  }

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  function handleFilterStatus(v: string) {
    setFilterStatus(v);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Consultations / RFQ</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Suivi des demandes de consultation entrantes</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Nouvelle consultation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total consultations", value: stats.total, icon: FileText, color: "text-blue-600" },
          { label: "En cours", value: stats.enCours, icon: Clock, color: "text-yellow-600" },
          { label: "Attribuées", value: stats.attribuees, icon: CheckCircle2, color: "text-green-600" },
          { label: "Taux d'attribution", value: `${stats.taux}%`, icon: TrendingUp, color: "text-purple-600" },
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
          <Input placeholder="Rechercher..." className="pl-9" value={search} onChange={e => handleSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={handleFilterStatus}>
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
                <TableHead>Titre / Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Prestations</TableHead>
                <TableHead>Date limite</TableHead>
                <TableHead>Montant est.</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">Aucune consultation</TableCell></TableRow>
              ) : paginated.map(c => {
                const services: string[] = c.serviceTypes ? JSON.parse(c.serviceTypes) : [];
                const st = STATUS_MAP[c.status] ?? { label: c.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetailItem(c)}>
                    <TableCell className="font-mono text-sm">{c.reference}</TableCell>
                    <TableCell>
                      <p className="font-medium">{c.title}</p>
                      {c.partnerId && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" />{getPartnerName(c.partnerId)}
                        </p>
                      )}
                      {!c.partnerId && c.clientRef && <p className="text-xs text-muted-foreground">Réf: {c.clientRef}</p>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{getTypeLabel(c.type)}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {services.slice(0, 2).map(s => (
                          <Badge key={s} variant="secondary" className="text-xs">{getServiceLabel(s)}</Badge>
                        ))}
                        {services.length > 2 && <Badge variant="secondary" className="text-xs">+{services.length - 2}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.deadlineAt ? (() => {
                        const ds = deadlineStatus(c.deadlineAt);
                        return (
                          <div>
                            <p className="text-xs text-muted-foreground">{format(new Date(c.deadlineAt), "dd MMM yyyy", { locale: fr })}</p>
                            <span className={`text-xs ${ds.cls}`}>{ds.label}</span>
                          </div>
                        );
                      })() : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {c.estimatedAmount
                        ? `${Number(c.estimatedAmount).toLocaleString("fr-FR")} ${c.currency}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setDetailItem(c); }}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 pt-4 border-t mt-2">
              <p className="text-sm text-muted-foreground">
                {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} sur {filtered.length} consultations
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8"
                  disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <Button key={p} variant={p === page ? "default" : "outline"}
                    size="icon" className="h-8 w-8 text-xs"
                    onClick={() => setPage(p)}>
                    {p}
                  </Button>
                ))}
                <Button variant="outline" size="icon" className="h-8 w-8"
                  disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          {totalPages <= 1 && filtered.length > 0 && (
            <p className="text-xs text-muted-foreground text-right pt-3 border-t mt-2">
              {filtered.length} consultation{filtered.length > 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle consultation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Titre / Objet *</Label>
                <Input value={form.title ?? ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>

              {/* Client — react-select avec recherche */}
              <div className="col-span-2">
                <Label>Client (depuis Facturation)</Label>
                <ReactSelect
                  options={partnerOptions}
                  value={partnerOptions.find(o => o.value === (form.partnerId ? String(form.partnerId) : "")) ?? partnerOptions[0]}
                  onChange={opt => setForm(f => ({ ...f, partnerId: opt?.value ? Number(opt.value) : undefined }))}
                  placeholder="Rechercher un client..."
                  unstyled
                  classNames={rsClassNames}
                  styles={rsPortalStyles}
                  noOptionsMessage={() => "Aucun client trouvé"}
                  isSearchable
                />
                {partners.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Aucun client trouvé. Créez-en un dans Facturation → Clients.
                  </p>
                )}
              </div>

              {/* Type de consultation — react-select */}
              <div>
                <Label>Type de consultation</Label>
                <ReactSelect
                  options={consultationTypeOptions}
                  value={consultationTypeOptions.find(o => o.value === form.type) ?? null}
                  onChange={opt => setForm(f => ({ ...f, type: opt?.value ?? "" }))}
                  placeholder="Sélectionner..."
                  unstyled
                  classNames={rsClassNames}
                  styles={rsPortalStyles}
                  isSearchable
                />
              </div>
              <div>
                <Label>Référence client</Label>
                <Input value={form.clientRef ?? ""} onChange={e => setForm(f => ({ ...f, clientRef: e.target.value }))} placeholder="Réf. du client" />
              </div>
              <div>
                <Label>Date limite de réponse</Label>
                <Input type="date" value={form.deadlineAt ? form.deadlineAt.substring(0, 10) : ""}
                  onChange={e => setForm(f => ({ ...f, deadlineAt: e.target.value }))} />
              </div>
              <div>
                <Label>Montant estimé</Label>
                <div className="flex gap-2">
                  <Input type="number" value={form.estimatedAmount ?? ""} placeholder="0"
                    className="flex-1"
                    onChange={e => setForm(f => ({ ...f, estimatedAmount: e.target.value }))} />
                  <div className="w-40">
                    <CurrencySelect
                      value={form.currency ?? "MRU"}
                      onChange={v => setForm(f => ({ ...f, currency: v ?? "MRU" }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Types de prestations */}
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
              <Label>Description</Label>
              <Textarea value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3} placeholder="Contexte, exigences particulières..." />
            </div>
            <div>
              <Label>Notes internes</Label>
              <Textarea value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={pending}>{pending ? "Enregistrement..." : "Créer la consultation"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      {detailItem && (
        <Sheet open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-left">{detailItem.title}</SheetTitle>
              <p className="text-sm font-mono text-muted-foreground">{detailItem.reference}</p>
            </SheetHeader>
            <div className="mt-6 space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${STATUS_MAP[detailItem.status]?.color}`}>
                  {STATUS_MAP[detailItem.status]?.label ?? detailItem.status}
                </span>
                <Badge variant="outline">{getTypeLabel(detailItem.type)}</Badge>
              </div>

              {/* Changer statut */}
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Changer le statut</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(STATUS_MAP).map(([k, v]) => (
                    <button key={k} onClick={() => handleStatusChange(detailItem.id, k)}
                      disabled={detailItem.status === k}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-opacity
                        ${detailItem.status === k ? "opacity-50 cursor-default" : "hover:opacity-80 cursor-pointer"}
                        ${v.color}`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {detailItem.partnerId && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Client</p>
                    <p className="font-medium flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />{getPartnerName(detailItem.partnerId)}
                    </p>
                  </div>
                )}
                {detailItem.clientRef && (
                  <div><p className="text-muted-foreground">Réf. client</p><p className="font-medium">{detailItem.clientRef}</p></div>
                )}
                {detailItem.deadlineAt && (() => {
                  const ds = deadlineStatus(detailItem.deadlineAt);
                  return (
                    <div>
                      <p className="text-muted-foreground">Date limite</p>
                      <p className="font-medium">{format(new Date(detailItem.deadlineAt), "dd MMMM yyyy", { locale: fr })}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${ds.badge}`}>{ds.label}</span>
                    </div>
                  );
                })()}
                {detailItem.estimatedAmount && (
                  <div className="col-span-2"><p className="text-muted-foreground">Montant estimé</p>
                    <p className="font-medium text-lg">{Number(detailItem.estimatedAmount).toLocaleString("fr-FR")} {detailItem.currency}</p></div>
                )}
                <div>
                  <p className="text-muted-foreground">Date de réception</p>
                  <p className="font-medium">{format(new Date(detailItem.receivedAt), "dd MMM yyyy", { locale: fr })}</p>
                </div>
              </div>

              {detailItem.serviceTypes && (() => {
                const services = JSON.parse(detailItem.serviceTypes);
                return services.length > 0 ? (
                  <div>
                    <p className="text-muted-foreground text-sm mb-2">Prestations demandées</p>
                    <div className="flex flex-wrap gap-2">
                      {services.map((s: string) => (
                        <Badge key={s} variant="secondary">{getServiceLabel(s)}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {detailItem.description && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{detailItem.description}</p>
                </div>
              )}

              {detailItem.notes && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Notes internes</p>
                  <p className="text-sm">{detailItem.notes}</p>
                </div>
              )}

              {/* Pièces jointes */}
              <div className="border-t pt-4">
                <AttachmentsPanel entityType="consultation" entityId={detailItem.id} />
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button variant="destructive" size="sm" onClick={() => handleDelete(detailItem.id)}>
                  <XCircle className="w-4 h-4 mr-1" /> Supprimer
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
