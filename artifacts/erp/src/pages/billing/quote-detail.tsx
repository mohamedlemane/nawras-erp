import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetQuote, createInvoice, createProforma } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintDocument } from "@/components/print/PrintDocument";
import { ArrowLeft, Printer, FileCheck, FileSignature } from "lucide-react";
import { format } from "date-fns";

export default function QuoteDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: quote, isLoading } = useGetQuote(Number(id), { query: { enabled: !!id, queryKey: ["quote", id] } });
  const [showPrint, setShowPrint] = useState(false);
  const [converting, setConverting] = useState<"invoice" | "proforma" | null>(null);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  if (!quote) return <div className="p-8 text-center text-muted-foreground">Devis introuvable</div>;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("fr-MR", { minimumFractionDigits: 2 }).format(val) + " MRU";

  const handleConvertToInvoice = async () => {
    setConverting("invoice");
    try {
      const invoice = await createInvoice({
        partnerId: quote.partnerId ?? null,
        subject: quote.subject ?? null,
        issueDate: new Date().toISOString().slice(0, 10),
        notes: quote.notes ?? null,
        items: (quote.items ?? []).map((item) => ({
          productId: item.productId ?? null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
        })),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      navigate(`/billing/invoices/${invoice.id}`);
    } finally {
      setConverting(null);
    }
  };

  const handleConvertToProforma = async () => {
    setConverting("proforma");
    try {
      const proforma = await createProforma({
        partnerId: quote.partnerId ?? null,
        subject: quote.subject ?? null,
        issueDate: new Date().toISOString().slice(0, 10),
        notes: quote.notes ?? null,
        items: (quote.items ?? []).map((item) => ({
          productId: item.productId ?? null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
        })),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/proformas"] });
      navigate(`/billing/proformas/${proforma.id}`);
    } finally {
      setConverting(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/billing/quotes"><ArrowLeft className="w-4 h-4" /></Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Devis {quote.quoteNumber}</h1>
              <p className="text-muted-foreground mt-1">{quote.partnerName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPrint(true)}>
              <Printer className="w-4 h-4 mr-2" /> Imprimer
            </Button>
            <Button
              variant="outline"
              onClick={handleConvertToProforma}
              disabled={converting !== null}
            >
              <FileCheck className="w-4 h-4 mr-2" />
              {converting === "proforma" ? "Conversion…" : "→ Proforma"}
            </Button>
            <Button
              onClick={handleConvertToInvoice}
              disabled={converting !== null}
            >
              <FileSignature className="w-4 h-4 mr-2" />
              {converting === "invoice" ? "Conversion…" : "→ Facture"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Lignes du devis</CardTitle></CardHeader>
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
                  {quote.items?.map((item, i) => (
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
                  <div className="flex justify-between text-sm"><span>Sous-total HT</span><span>{formatCurrency(quote.subtotal)}</span></div>
                  <div className="flex justify-between text-sm"><span>TVA</span><span>{formatCurrency(quote.taxAmount)}</span></div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total TTC</span><span>{formatCurrency(quote.total)}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Numéro</span>
                  <p className="font-medium">{quote.quoteNumber}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Date d'émission</span>
                  <p className="font-medium">{format(new Date(quote.issueDate), "dd/MM/yyyy")}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Valide jusqu'au</span>
                  <p className="font-medium">{quote.validUntil ? format(new Date(quote.validUntil), "dd/MM/yyyy") : "—"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Statut</span>
                  <p className="font-medium capitalize">{quote.status}</p>
                </div>
                {quote.subject && (
                  <div>
                    <span className="text-sm text-muted-foreground">Objet</span>
                    <p className="font-medium">{quote.subject}</p>
                  </div>
                )}
                {quote.notes && (
                  <div>
                    <span className="text-sm text-muted-foreground">Notes</span>
                    <p className="text-sm">{quote.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showPrint && (
        <PrintDocument
          docType="DEVIS"
          docNumber={quote.quoteNumber}
          issueDate={quote.issueDate}
          validUntil={quote.validUntil}
          partnerName={quote.partnerName}
          subject={quote.subject}
          notes={quote.notes}
          items={quote.items ?? []}
          subtotal={quote.subtotal}
          taxAmount={quote.taxAmount}
          total={quote.total}
          onClose={() => setShowPrint(false)}
        />
      )}
    </>
  );
}
