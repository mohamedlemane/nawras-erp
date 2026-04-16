import { useParams, Link } from "wouter";
import { useGetInvoice, useValidateInvoice } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle, Printer } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function InvoiceDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: invoice, isLoading } = useGetInvoice(Number(id), { query: { enabled: !!id, queryKey: ["invoice", id] } });
  
  const validateInvoice = useValidateInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      }
    }
  });

  if (isLoading) return <div>Chargement...</div>;
  if (!invoice) return <div>Facture introuvable</div>;

  const formatCurrency = (val: number) => new Intl.NumberFormat('fr-MR', { style: 'currency', currency: 'MRU' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/billing/invoices"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Facture {invoice.invoiceNumber}</h1>
            <p className="text-muted-foreground mt-1">{invoice.partnerName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {invoice.status === 'draft' && (
            <Button onClick={() => validateInvoice.mutate({ id: Number(id) })} disabled={validateInvoice.isPending} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="w-4 h-4 mr-2" /> Valider
            </Button>
          )}
          <Button variant="outline"><Printer className="w-4 h-4 mr-2" /> Imprimer</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Lignes de facture</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">Prix Unitaire</TableHead>
                    <TableHead className="text-right">TVA (%)</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items?.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right">{item.taxRate}%</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-6 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm"><span>Sous-total</span><span>{formatCurrency(invoice.subtotal)}</span></div>
                  <div className="flex justify-between text-sm"><span>TVA</span><span>{formatCurrency(invoice.taxAmount)}</span></div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span>{formatCurrency(invoice.total)}</span></div>
                  <div className="flex justify-between text-sm pt-2 text-green-600"><span>Payé</span><span>{formatCurrency(invoice.amountPaid)}</span></div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t text-destructive"><span>Reste dû</span><span>{formatCurrency(invoice.amountDue)}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {invoice.payments && invoice.payments.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Paiements</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Méthode</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map((payment, i) => (
                      <TableRow key={i}>
                        <TableCell>{format(new Date(payment.paymentDate), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{payment.paymentMethod}</TableCell>
                        <TableCell>{payment.reference || '-'}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">{formatCurrency(payment.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-sm text-muted-foreground">Date d'émission</span>
                <p className="font-medium">{format(new Date(invoice.issueDate), 'dd/MM/yyyy')}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Date d'échéance</span>
                <p className="font-medium">{invoice.dueDate ? format(new Date(invoice.dueDate), 'dd/MM/yyyy') : '-'}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Statut</span>
                <p className="font-medium capitalize">{invoice.status}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
