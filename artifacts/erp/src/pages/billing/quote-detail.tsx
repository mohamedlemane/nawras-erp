import { useParams, Link } from "wouter";
import { useGetQuote } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Printer, Send } from "lucide-react";
import { format } from "date-fns";

export default function QuoteDetail() {
  const { id } = useParams();
  const { data: quote, isLoading } = useGetQuote(Number(id), { query: { enabled: !!id, queryKey: ["quote", id] } });

  if (isLoading) return <div>Chargement...</div>;
  if (!quote) return <div>Devis introuvable</div>;

  const formatCurrency = (val: number) => new Intl.NumberFormat('fr-MR', { style: 'currency', currency: 'MRU' }).format(val);

  return (
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
          <Button variant="outline"><Printer className="w-4 h-4 mr-2" /> Imprimer</Button>
          <Button><Send className="w-4 h-4 mr-2" /> Envoyer</Button>
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
                <div className="flex justify-between text-sm"><span>Sous-total</span><span>{formatCurrency(quote.subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span>TVA</span><span>{formatCurrency(quote.taxAmount)}</span></div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span>{formatCurrency(quote.total)}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-sm text-muted-foreground">Date d'émission</span>
                <p className="font-medium">{format(new Date(quote.issueDate), 'dd/MM/yyyy')}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Valide jusqu'au</span>
                <p className="font-medium">{quote.validUntil ? format(new Date(quote.validUntil), 'dd/MM/yyyy') : '-'}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Statut</span>
                <p className="font-medium capitalize">{quote.status}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
