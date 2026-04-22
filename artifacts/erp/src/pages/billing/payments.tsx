import { useState, useMemo } from "react";
import { useCurrency } from "@/hooks/use-currency";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const methodLabels: Record<string, string> = {
  cash: "Espèces",
  bank_transfer: "Virement",
  check: "Chèque",
  mobile_money: "Mobile Money",
  other: "Autre",
};

export default function PaymentsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [form, setForm] = useState<CreatePaymentBody>({
    invoiceId: 0,
    amount: 0,
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "cash" as CreatePaymentBodyPaymentMethod,
    reference: null,
    notes: null,
  });

  const { data, isLoading } = useListPayments();
  const { data: invoicesData } = useListInvoices();

  const unpaidInvoices = invoicesData?.data?.filter((inv) => inv.amountDue > 0) || [];

  const selectedInvoice = useMemo(
    () => unpaidInvoices.find((inv) => inv.id === form.invoiceId) ?? null,
    [form.invoiceId, unpaidInvoices]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreatePaymentBody) => createPayment(data),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setAmountError(null);
      toast({ title: "Paiement enregistré" });
    },
    onError: async (e: any) => {
      let msg = e?.message ?? "Erreur inconnue";
      try {
        const body = await e?.response?.json?.();
        if (body?.error) msg = body.error;
      } catch {}
      setAmountError(msg);
    },
  });

  const openCreate = () => {
    setForm({
      invoiceId: 0,
      amount: 0,
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      paymentMethod: "cash" as CreatePaymentBodyPaymentMethod,
      reference: null,
      notes: null,
    });
    setAmountError(null);
    setDialogOpen(true);
  };

  const handleInvoiceChange = (id: number | null) => {
    const inv = unpaidInvoices.find((i) => i.id === id);
    setAmountError(null);
    setForm((f) => ({
      ...f,
      invoiceId: id ?? 0,
      amount: inv ? inv.amountDue : 0,
    }));
  };

  const invCurrency = selectedInvoice?.currency ?? null;

  const handleAmountChange = (v: string) => {
    setAmountError(null);
    const num = Number(v);
    if (selectedInvoice && num > selectedInvoice.amountDue) {
      setAmountError(
        `Le montant ne peut pas dépasser le restant dû (${formatAmount(selectedInvoice.amountDue, invCurrency)})`
      );
    }
    setForm((f) => ({ ...f, amount: num }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedInvoice && form.amount > selectedInvoice.amountDue) {
      setAmountError(
        `Le montant ne peut pas dépasser le restant dû (${formatAmount(selectedInvoice.amountDue, invCurrency)})`
      );
      return;
    }
    if (!form.invoiceId) {
      toast({ title: "Veuillez sélectionner une facture", variant: "destructive" });
      return;
    }
    createMutation.mutate(form);
  };

  const { formatCurrency } = useCurrency();

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
                <TableHead>Facture N°</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : !data?.data?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    Aucun paiement trouvé
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{format(new Date(payment.paymentDate), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium font-mono">{(payment as any).invoiceNumber ?? `#${payment.invoiceId}`}</TableCell>
                    <TableCell>{methodLabels[payment.paymentMethod] || payment.paymentMethod}</TableCell>
                    <TableCell className="text-muted-foreground">{payment.reference || "—"}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatAmount(payment.amount, (payment as any).invoiceCurrency ?? null)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Facture *</Label>
              <ReactSelect
                unstyled
                classNames={rsClassNames}
                styles={{ menu: (base) => ({ ...base, zIndex: 9999 }) }}
                menuPosition="fixed"
                placeholder="Rechercher une facture impayée..."
                noOptionsMessage={() => unpaidInvoices.length === 0 ? "Aucune facture impayée" : "Aucun résultat"}
                options={unpaidInvoices.map(inv => ({
                  value: inv.id,
                  label: `${inv.invoiceNumber} — ${inv.partnerName || "?"} (${formatAmount(inv.amountDue, inv.currency)} restant)`,
                }))}
                value={form.invoiceId ? { value: form.invoiceId, label: (() => { const inv = unpaidInvoices.find(i => i.id === form.invoiceId); return inv ? `${inv.invoiceNumber} — ${inv.partnerName || "?"} (${formatAmount(inv.amountDue, inv.currency)} restant)` : ""; })() } : null}
                onChange={opt => handleInvoiceChange(opt ? opt.value : null)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Montant {invCurrency ? `(${invCurrency})` : ""} *</Label>
                {selectedInvoice && (
                  <span className="text-xs text-muted-foreground">
                    Max : {formatAmount(selectedInvoice.amountDue, invCurrency)}
                  </span>
                )}
              </div>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                max={selectedInvoice ? selectedInvoice.amountDue : undefined}
                value={form.amount || ""}
                onChange={(e) => handleAmountChange(e.target.value)}
                required
                className={amountError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {amountError && (
                <div className="flex items-center gap-1.5 mt-1.5 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{amountError}</span>
                </div>
              )}
            </div>

            <div>
              <Label>Date de paiement *</Label>
              <Input
                type="date"
                value={form.paymentDate}
                onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label>Méthode de paiement *</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, paymentMethod: v as CreatePaymentBodyPaymentMethod }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(methodLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Référence</Label>
              <Input
                value={form.reference ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value || null }))}
                placeholder="N° chèque, transaction..."
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !!amountError}>
                {createMutation.isPending ? "En cours..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
