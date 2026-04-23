import { useState, useMemo } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { Plus, Pencil, Trash2, Search, TrendingDown, CalendarDays, Receipt, Filter, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { rsClassNames, rsPortalStyles } from "@/lib/rs-styles";
import ReactSelect from "react-select";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type ExpenseType = {
  id: number; name: string; code: string; color: string | null; isActive: boolean;
};
type Supplier = {
  id: number; name: string; companyName: string | null; phone: string | null;
};
type Expense = {
  id: number; label: string; amount: string; currency: string; expenseDate: string;
  expenseTypeId: number | null; typeName: string | null; typeColor: string | null;
  paymentMethod: string | null; status: string;
  supplierId: number | null; supplier: string | null;
  supplierName: string | null; supplierCompany: string | null;
  invoiceRef: string | null; notes: string | null; reference: string | null;
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Espèces" },
  { value: "virement", label: "Virement bancaire" },
  { value: "cheque", label: "Chèque" },
  { value: "carte", label: "Carte bancaire" },
  { value: "mobile", label: "Mobile Money" },
];

const STATUS_OPTIONS = [
  { value: "paid", label: "Payé" },
  { value: "pending", label: "En attente" },
  { value: "cancelled", label: "Annulé" },
];

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const EMPTY_FORM = {
  label: "", amount: "", currency: "MRU", expenseTypeId: null as number | null,
  expenseDate: new Date().toISOString().substring(0, 10),
  paymentMethod: "cash", status: "paid",
  supplierId: null as number | null,
  invoiceRef: "", notes: "", reference: "",
};

export default function Expenses() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Expense | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const { data: typesData } = useQuery<ExpenseType[]>({
    queryKey: ["expense-types"],
    queryFn: () => fetch(`${BASE}/api/expense-types`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: suppliersData } = useQuery<{ data: Supplier[] }>({
    queryKey: ["suppliers-list"],
    queryFn: () => fetch(`${BASE}/api/partners?type=supplier&limit=200`, { credentials: "include" }).then(r => r.json()),
  });

  const { data, isLoading } = useQuery<{ data: Expense[]; total: number }>({
    queryKey: ["expenses", filterType, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "200" });
      if (filterType) params.set("typeId", String(filterType));
      return fetch(`${BASE}/api/expenses?${params}`, { credentials: "include" }).then(r => r.json());
    },
  });

  const { data: summary } = useQuery<{ monthlyTotal: number; yearlyTotal: number; byType: { typeName: string; typeColor: string; total: number; count: number }[] }>({
    queryKey: ["expenses-summary"],
    queryFn: () => fetch(`${BASE}/api/expenses/summary`, { credentials: "include" }).then(r => r.json()),
  });

  const { formatCurrency } = useCurrency();

  const expenses = useMemo(() => {
    let list = data?.data ?? [];
    if (filterStatus !== "all") list = list.filter(e => e.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.label.toLowerCase().includes(q) ||
        (e.supplierName ?? e.supplier ?? "").toLowerCase().includes(q) ||
        (e.reference ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, filterStatus, search]);

  const totalFiltered = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalPages = Math.max(1, Math.ceil(expenses.length / PAGE_SIZE));
  const paginated = expenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const createMutation = useMutation({
    mutationFn: (body: typeof EMPTY_FORM) => fetch(`${BASE}/api/expenses`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, amount: parseFloat(body.amount) }),
    }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      toast({ title: "Dépense enregistrée" });
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof EMPTY_FORM }) => fetch(`${BASE}/api/expenses/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, amount: parseFloat(body.amount) }),
    }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      toast({ title: "Dépense mise à jour" });
      setEditItem(null);
      setShowForm(false);
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/api/expenses/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      toast({ title: "Dépense supprimée" });
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(expense: Expense) {
    setEditItem(expense);
    setForm({
      label: expense.label,
      amount: expense.amount,
      currency: expense.currency,
      expenseTypeId: expense.expenseTypeId,
      expenseDate: expense.expenseDate.substring(0, 10),
      paymentMethod: expense.paymentMethod ?? "cash",
      status: expense.status,
      supplierId: expense.supplierId,
      invoiceRef: expense.invoiceRef ?? "",
      notes: expense.notes ?? "",
      reference: expense.reference ?? "",
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editItem) updateMutation.mutate({ id: editItem.id, body: form });
    else createMutation.mutate(form);
  }

  const typeOptions = (typesData ?? []).filter(t => t.isActive).map(t => ({ value: t.id, label: t.name }));

  const supplierOptions = (suppliersData?.data ?? []).map(s => ({
    value: s.id,
    label: s.companyName ? `${s.name} — ${s.companyName}` : s.name,
    sublabel: s.phone ?? undefined,
  }));

  const getSupplierDisplay = (expense: Expense) =>
    expense.supplierName
      ? expense.supplierCompany
        ? `${expense.supplierName} — ${expense.supplierCompany}`
        : expense.supplierName
      : expense.supplier || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dépenses & Charges</h1>
          <p className="text-muted-foreground text-sm mt-1">Suivi de toutes les dépenses de l'entreprise</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.href = `${BASE}/expenses/types`}>
            Paramètres types
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Nouvelle dépense
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ce mois</CardTitle>
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(summary?.monthlyTotal ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cette année</CardTitle>
            <TrendingDown className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.yearlyTotal ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sélection actuelle</CardTitle>
            <Receipt className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalFiltered)}</div>
            <p className="text-xs text-muted-foreground mt-1">{expenses.length} dépense(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Rechercher..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="w-56">
          <ReactSelect
            unstyled classNames={rsClassNames} styles={rsPortalStyles}
            isClearable placeholder="Tous les types..."
            options={typeOptions}
            value={filterType ? typeOptions.find(o => o.value === filterType) ?? null : null}
            onChange={opt => { setFilterType(opt ? opt.value : null); setPage(1); }}
          />
        </div>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <Filter className="w-3 h-3 mr-1 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Chargement...</TableCell></TableRow>
              )}
              {!isLoading && expenses.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Aucune dépense trouvée</TableCell></TableRow>
              )}
              {paginated.map(expense => (
                <TableRow key={expense.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm">
                    {format(new Date(expense.expenseDate), "dd MMM yyyy", { locale: fr })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {expense.label}
                    {expense.reference && <span className="ml-1 text-xs text-muted-foreground">#{expense.reference}</span>}
                  </TableCell>
                  <TableCell>
                    {expense.typeName ? (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: expense.typeColor ?? "#94a3b8" }} />
                        {expense.typeName}
                      </span>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {expense.supplierId ? (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                        {getSupplierDisplay(expense)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {PAYMENT_METHODS.find(m => m.value === expense.paymentMethod)?.label ?? expense.paymentMethod}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${STATUS_COLORS[expense.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_OPTIONS.find(s => s.value === expense.status)?.label ?? expense.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(expense.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(expense)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(expense)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination page={page} totalPages={totalPages} total={expenses.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditItem(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Libellé *</Label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} required placeholder="Ex: Facture électricité SOMELEC" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Montant (MRU) *</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  required placeholder="0.00"
                />
              </div>
              <div>
                <Label>Date *</Label>
                <Input type="date" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} required />
              </div>
            </div>

            <div>
              <Label>Type de dépense</Label>
              <ReactSelect
                unstyled classNames={rsClassNames} styles={rsPortalStyles}
                isClearable placeholder="Sélectionner un type..."
                noOptionsMessage={() => "Aucun type"}
                options={typeOptions}
                value={form.expenseTypeId ? typeOptions.find(o => o.value === form.expenseTypeId) ?? null : null}
                onChange={opt => setForm(f => ({ ...f, expenseTypeId: opt ? opt.value : null }))}
              />
            </div>

            <div>
              <Label className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Fournisseur
              </Label>
              <ReactSelect
                unstyled classNames={rsClassNames} styles={rsPortalStyles}
                isClearable placeholder="Sélectionner un fournisseur..."
                noOptionsMessage={() => supplierOptions.length === 0 ? "Aucun fournisseur enregistré dans la facturation" : "Aucun résultat"}
                options={supplierOptions}
                value={form.supplierId ? supplierOptions.find(o => o.value === form.supplierId) ?? null : null}
                onChange={opt => setForm(f => ({ ...f, supplierId: opt ? opt.value : null }))}
                formatOptionLabel={opt => (
                  <div>
                    <div className="font-medium text-sm">{opt.label}</div>
                    {opt.sublabel && <div className="text-xs text-muted-foreground">{opt.sublabel}</div>}
                  </div>
                )}
              />
              {supplierOptions.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ajoutez des fournisseurs dans{" "}
                  <a href={`${BASE}/billing/partners`} className="underline text-primary">Facturation → Partenaires</a>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mode de paiement</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Réf. facture</Label>
                <Input value={form.invoiceRef} onChange={e => setForm(f => ({ ...f, invoiceRef: e.target.value }))} placeholder="N° de la facture" />
              </div>
              <div>
                <Label>Référence interne</Label>
                <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Votre code de référence" />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Commentaires..." />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditItem(null); }}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editItem ? "Enregistrer" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer cette dépense ?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            «<strong>{deleteTarget?.label}</strong>» — {formatCurrency(deleteTarget?.amount ?? 0)} sera définitivement supprimée.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
