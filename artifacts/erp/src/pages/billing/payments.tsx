import { useState } from "react";
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
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const methodLabels: Record<string, string> = {
  cash: 'Espèces', bank_transfer: 'Virement', check: 'Chèque',
  mobile_money: 'Mobile Money', other: 'Autre',
};

export default function PaymentsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreatePaymentBody>({
    invoiceId: 0, amount: 0, paymentDate: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: 'cash' as CreatePaymentBodyPaymentMethod, reference: null, notes: null,
  });

  const { data, isLoading } = useListPayments();
  const { data: invoicesData } = useListInvoices();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreatePaymentBody) => createPayment(data),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Paiement enregistré" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setForm({ invoiceId: 0, amount: 0, paymentDate: format(new Date(), 'yyyy-MM-dd'), paymentMethod: 'cash' as CreatePaymentBodyPaymentMethod, reference: null, notes: null });
    setDialogOpen(true);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('fr-MR', { style: 'currency', currency: 'MRU' }).format(val);

  const unpaidInvoices = invoicesData?.data?.filter(inv => inv.amountDue > 0) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paiements</h1>
          <p className="text-muted-foreground mt-2">Historique des encaissements</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Enregistrer un paiement</Button>
      </div>

      <Card><CardContent className="pt-6">
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
              <TableRow><TableCell colSpan={5} className="text-center h-24">Chargement...</TableCell></TableRow>
            ) : !data?.data?.length ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Aucun paiement trouvé</TableCell></TableRow>
            ) : data.data.map(payment => (
              <TableRow key={payment.id}>
                <TableCell>{format(new Date(payment.paymentDate), 'dd/MM/yyyy')}</TableCell>
                <TableCell className="font-medium">Facture #{payment.invoiceId}</TableCell>
                <TableCell>{methodLabels[payment.paymentMethod] || payment.paymentMethod}</TableCell>
                <TableCell className="text-muted-foreground">{payment.reference || '-'}</TableCell>
                <TableCell className="text-right font-medium text-green-600">{formatCurrency(payment.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enregistrer un paiement</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div>
              <Label>Facture *</Label>
              <Select value={form.invoiceId?.toString() || ""} onValueChange={v => setForm(f => ({ ...f, invoiceId: Number(v) }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une facture" /></SelectTrigger>
                <SelectContent>
                  {unpaidInvoices.map(inv => (
                    <SelectItem key={inv.id} value={inv.id.toString()}>
                      {inv.invoiceNumber} - {inv.partnerName || '?'} ({formatCurrency(inv.amountDue)} restant)
                    </SelectItem>
                  ))}
                  {unpaidInvoices.length === 0 && <SelectItem value="0" disabled>Aucune facture impayée</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Montant (MRU) *</Label><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} required /></div>
            <div><Label>Date de paiement *</Label><Input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} required /></div>
            <div>
              <Label>Méthode de paiement *</Label>
              <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v as CreatePaymentBodyPaymentMethod }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(methodLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Référence</Label><Input value={form.reference ?? ""} onChange={e => setForm(f => ({ ...f, reference: e.target.value || null }))} placeholder="N° chèque, transaction..." /></div>
            <div><Label>Notes</Label><Textarea value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))} rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "En cours..." : "Enregistrer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
