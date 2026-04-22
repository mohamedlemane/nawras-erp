import { useState, useMemo } from "react";
import { formatAmount } from "@/lib/currencies";
import ReactSelect from "react-select";
import { rsClassNames } from "@/lib/rs-styles";
import { useListPayments, useListInvoices, createPayment } from "@workspace/api-client-react";
import type { CreatePaymentBody, CreatePaymentBodyPaymentMethod } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const methodLabels: Record<string, string> = {
  cash: "Espèces",
  bank_transfer: "Virement",
  check: "Chèque",
  mobile_money: "Mobile Money",
  other: "Autre",
};

type AnyPayment = {
  id: number;
  invoiceId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  invoiceNumber?: string | null;
  invoiceCurrency?: string | null;
  invoiceAmountDue?: string | number | null;
  invoicePartnerName?: string | null;
};

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(url, { credentials: "include", ...options });
  if (resp.status === 204) return undefined as T;
  const body = await resp.json();
  if (!resp.ok) throw new Error(body?.error ?? resp.statusText);
  return body as T;
}

export default function PaymentsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [createAmountError, setCreateAmountError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreatePaymentBody>({
    invoiceId: 0, amount: 0,
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "cash" as CreatePaymentBodyPaymentMethod,
    reference: null, notes: null,
  });

  const [editingPayment, setEditingPayment] = useState<AnyPayment | null>(null);
  const [editAmountError, setEditAmountError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    amount: number; paymentDate: string;
    paymentMethod: string; reference: string | null; notes: string | null;
  }>({ amount: 0, paymentDate: "", paymentMethod: "cash", reference: null, notes: null });

  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null);

  const { data, isLoading } = useListPayments();
  const { data: invoicesData } = useListInvoices({ limit: 200 } as any);

  const unpaidInvoices = invoicesData?.data?.filter((inv) => inv.amountDue > 0) || [];

  const selectedCreateInvoice = useMemo(
    () => unpaidInvoices.find((inv) => inv.id === createForm.invoiceId) ?? null,
    [createForm.invoiceId, unpaidInvoices]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
  };

  const createMutation = useMutation({
    mutationFn: (d: CreatePaymentBody) => createPayment(d),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setCreateAmountError(null);
      toast({ title: "Paiement enregistré" });
    },
    onError: async (e: any) => {
      let msg = e?.message ?? "Erreur inconnue";
      try { const b = await e?.response?.json?.(); if (b?.error) msg = b.error; } catch {}
      setCreateAmountError(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      apiFetch<AnyPayment>(`/api/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate();
      setEditingPayment(null);
      setEditAmountError(null);
      toast({ title: "Paiement modifié" });
    },
    onError: (e: Error) => setEditAmountError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/payments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      setDeletePaymentId(null);
      toast({ title: "Paiement annulé" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setCreateForm({
      invoiceId: 0, amount: 0,
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      paymentMethod: "cash" as CreatePaymentBodyPaymentMethod,
      reference: null, notes: null,
    });
    setCreateAmountError(null);
    setCreateOpen(true);
  };

  const openEdit = (payment: AnyPayment) => {
    setEditingPayment(payment);
    setEditAmountError(null);
    setEditForm({
      amount: payment.amount,
      paymentDate: payment.paymentDate.slice(0, 10),
      paymentMethod: payment.paymentMethod,
      reference: payment.reference,
      notes: payment.notes,
    });
  };

  const handleCreateInvoiceChange = (id: number | null) => {
    const inv = unpaidInvoices.find((i) => i.id === id);
    setCreateAmountError(null);
    setCreateForm((f) => ({ ...f, invoiceId: id ?? 0, amount: inv ? inv.amountDue : 0 }));
  };

  const createInvCurrency = selectedCreateInvoice?.currency ?? null;

  const handleCreateAmountChange = (v: string) => {
    setCreateAmountError(null);
    const num = Number(v);
    if (selectedCreateInvoice && num > selectedCreateInvoice.amountDue) {
      setCreateAmountError(
        `Max : ${formatAmount(selectedCreateInvoice.amountDue, createInvCurrency)}`
      );
    }
    setCreateForm((f) => ({ ...f, amount: num }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCreateInvoice && createForm.amount > selectedCreateInvoice.amountDue) {
      setCreateAmountError(`Max : ${formatAmount(selectedCreateInvoice.amountDue, createInvCurrency)}`);
      return;
    }
    if (!createForm.invoiceId) {
      toast({ title: "Veuillez sélectionner une facture", variant: "destructive" });
      return;
    }
    createMutation.mutate(createForm);
  };

  const editInvCurrency = editingPayment?.invoiceCurrency ?? null;
  const editMaxAmount = editingPayment
    ? editingPayment.amount + Number(editingPayment.invoiceAmountDue ?? 0)
    : 0;

  const handleEditAmountChange = (v: string) => {
    setEditAmountError(null);
    const num = Number(v);
    if (editingPayment && num > editMaxAmount) {
      setEditAmountError(`Max : ${formatAmount(editMaxAmount, editInvCurrency)}`);
    }
    setEditForm((f) => ({ ...f, amount: num }));
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    if (editForm.amount > editMaxAmount) {
      setEditAmountError(`Max : ${formatAmount(editMaxAmount, editInvCurrency)}`);
      return;
    }
    updateMutation.mutate({ id: editingPayment.id, data: editForm });
  };

  const deleteTarget = deletePaymentId ? (data?.data as AnyPayment[])?.find(p => p.id === deletePaymentId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paiements</h1>
          <p className="text-muted-foreground mt-2">Historique des encaissements</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Enregistrer un paiement
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Facture</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !(data?.data as AnyPayment[])?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Aucun paiement trouvé</TableCell></TableRow>
              ) : (
                (data!.data as AnyPayment[]).map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{format(new Date(payment.paymentDate), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-mono font-medium">{payment.invoiceNumber ?? `#${payment.invoiceId}`}</TableCell>
                    <TableCell className="text-muted-foreground">{payment.invoicePartnerName || "—"}</TableCell>
                    <TableCell>{methodLabels[payment.paymentMethod] || payment.paymentMethod}</TableCell>
                    <TableCell className="text-muted-foreground">{payment.reference || "—"}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatAmount(payment.amount, payment.invoiceCurrency ?? null)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(payment)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletePaymentId(payment.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Créer ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enregistrer un paiement</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <Label>Facture *</Label>
              <ReactSelect
                unstyled classNames={rsClassNames}
                styles={{ menu: (base) => ({ ...base, zIndex: 9999 }) }}
                menuPosition="fixed"
                placeholder="Rechercher une facture impayée..."
                noOptionsMessage={() => unpaidInvoices.length === 0 ? "Aucune facture impayée" : "Aucun résultat"}
                options={unpaidInvoices.map(inv => ({
                  value: inv.id,
                  label: `${inv.invoiceNumber} — ${inv.partnerName || "?"} (${formatAmount(inv.amountDue, inv.currency)} restant)`,
                }))}
                value={createForm.invoiceId
                  ? { value: createForm.invoiceId, label: (() => { const inv = unpaidInvoices.find(i => i.id === createForm.invoiceId); return inv ? `${inv.invoiceNumber} — ${inv.partnerName || "?"} (${formatAmount(inv.amountDue, inv.currency)} restant)` : ""; })() }
                  : null}
                onChange={opt => handleCreateInvoiceChange(opt ? opt.value : null)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Montant {createInvCurrency ? `(${createInvCurrency})` : ""} *</Label>
                {selectedCreateInvoice && (
                  <span className="text-xs text-muted-foreground">Max : {formatAmount(selectedCreateInvoice.amountDue, createInvCurrency)}</span>
                )}
              </div>
              <Input
                type="number" min="0.01" step="0.01"
                max={selectedCreateInvoice ? selectedCreateInvoice.amountDue : undefined}
                value={createForm.amount || ""}
                onChange={(e) => handleCreateAmountChange(e.target.value)}
                required
                className={createAmountError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {createAmountError && (
                <div className="flex items-center gap-1.5 mt-1.5 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" /><span>{createAmountError}</span>
                </div>
              )}
            </div>
            <div>
              <Label>Date de paiement *</Label>
              <Input type="date" value={createForm.paymentDate}
                onChange={(e) => setCreateForm((f) => ({ ...f, paymentDate: e.target.value }))} required />
            </div>
            <div>
              <Label>Méthode *</Label>
              <Select value={createForm.paymentMethod}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, paymentMethod: v as CreatePaymentBodyPaymentMethod }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(methodLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Référence</Label>
              <Input value={createForm.reference ?? ""} placeholder="N° chèque, transaction..."
                onChange={(e) => setCreateForm((f) => ({ ...f, reference: e.target.value || null }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={createForm.notes ?? ""}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value || null }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending || !!createAmountError}>
                {createMutation.isPending ? "En cours..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modifier ── */}
      <Dialog open={!!editingPayment} onOpenChange={(o) => { if (!o) setEditingPayment(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le paiement</DialogTitle>
          </DialogHeader>
          {editingPayment && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="rounded-md bg-muted px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Facture</span>
                  <span className="font-mono font-medium">{editingPayment.invoiceNumber ?? `#${editingPayment.invoiceId}`}</span>
                </div>
                {editingPayment.invoicePartnerName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client</span>
                    <span>{editingPayment.invoicePartnerName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Restant disponible</span>
                  <span className="font-medium">{formatAmount(editMaxAmount, editInvCurrency)}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Montant {editInvCurrency ? `(${editInvCurrency})` : ""} *</Label>
                  <span className="text-xs text-muted-foreground">Max : {formatAmount(editMaxAmount, editInvCurrency)}</span>
                </div>
                <Input
                  type="number" min="0.01" step="0.01" max={editMaxAmount}
                  value={editForm.amount || ""}
                  onChange={(e) => handleEditAmountChange(e.target.value)}
                  required
                  className={editAmountError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {editAmountError && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0" /><span>{editAmountError}</span>
                  </div>
                )}
              </div>

              <div>
                <Label>Date de paiement *</Label>
                <Input type="date" value={editForm.paymentDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, paymentDate: e.target.value }))} required />
              </div>

              <div>
                <Label>Méthode *</Label>
                <Select value={editForm.paymentMethod}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(methodLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Référence</Label>
                <Input value={editForm.reference ?? ""} placeholder="N° chèque, transaction..."
                  onChange={(e) => setEditForm((f) => ({ ...f, reference: e.target.value || null }))} />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea rows={2} value={editForm.notes ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value || null }))} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingPayment(null)}>Annuler</Button>
                <Button type="submit" disabled={updateMutation.isPending || !!editAmountError}>
                  {updateMutation.isPending ? "Enregistrement..." : "Sauvegarder"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirmer annulation ── */}
      <AlertDialog open={deletePaymentId !== null} onOpenChange={(o) => { if (!o) setDeletePaymentId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler ce paiement ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Le paiement de ${formatAmount(deleteTarget.amount, deleteTarget.invoiceCurrency ?? null)} sur la facture ${deleteTarget.invoiceNumber ?? `#${deleteTarget.invoiceId}`} sera supprimé et le restant dû de la facture sera mis à jour.`
                : "Ce paiement sera supprimé et le restant dû de la facture sera mis à jour."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Non, garder</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletePaymentId !== null && deleteMutation.mutate(deletePaymentId)}
            >
              Oui, annuler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
