import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useGetQuote, createInvoice, createProforma, updateQuote, deleteQuote } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintDocument } from "@/components/print/PrintDocument";
import { ArrowLeft, Printer, FileCheck, FileSignature, Send, CheckCircle, XCircle, RotateCcw, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/use-currency";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  refused: "Refusé",
  expired: "Expiré",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  sent: "bg-blue-100 text-blue-700 border-blue-200",
  accepted: "bg-green-100 text-green-700 border-green-200",
  refused: "bg-red-100 text-red-700 border-red-200",
  expired: "bg-orange-100 text-orange-700 border-orange-200",
};

export default function QuoteDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: quote, isLoading } = useGetQuote(Number(id), {
    query: { enabled: !!id, queryKey: ["quote", id] },
  });
  const [showPrint, setShowPrint] = useState(false);
  const [converting, setConverting] = useState<"invoice" | "proforma" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleApiError = async (err: unknown, fallback: string) => {
    let message = fallback;
    if (err instanceof Response) {
      try { const j = await err.json(); if (j?.error) message = j.error; } catch { /* ignore */ }
    } else if (err instanceof Error) {
      message = err.message;
    }
    toast({ title: "Erreur", description: message, variant: "destructive" });
  };

  const changeStatus = useMutation({
    mutationFn: (status: string) => updateQuote(Number(id), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
    onError: (err) => handleApiError(err, "Impossible de changer le statut"),
  });

  const removeMutation = useMutation({
    mutationFn: () => deleteQuote(Number(id)),
    onSuccess: () => {
      toast({ title: "Devis supprimé" });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      navigate("/billing/quotes");
    },
    onError: (err) => handleApiError(err, "Suppression impossible"),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  if (!quote) return <div className="p-8 text-center text-muted-foreground">Devis introuvable</div>;

  const { formatCurrency, amountInWords, currency } = useCurrency();

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
      if (quote.status === "draft" || quote.status === "sent") {
        try { await updateQuote(Number(id), { status: "accepted" }); } catch { /* non bloquant */ }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      navigate(`/billing/invoices/${invoice.id}`);
    } catch (err) {
      handleApiError(err, "Conversion en facture impossible");
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
      if (quote.status === "draft" || quote.status === "sent") {
        try { await updateQuote(Number(id), { status: "accepted" }); } catch { /* non bloquant */ }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/proformas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      navigate(`/billing/proformas/${proforma.id}`);
    } catch (err) {
      handleApiError(err, "Conversion en proforma impossible");
    } finally {
      setConverting(null);
    }
  };

  const status = quote.status;
  const busy = changeStatus.isPending || converting !== null || removeMutation.isPending;
  const isDraft = status === "draft";

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/billing/quotes"><ArrowLeft className="w-4 h-4" /></Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">Devis {quote.quoteNumber}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}>
                  {STATUS_LABELS[status] ?? status}
                </span>
              </div>
              <p className="text-muted-foreground mt-1">{quote.partnerName}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Boutons de changement de statut */}
            {status === "draft" && (
              <Button
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => changeStatus.mutate("sent")}
                disabled={busy}
              >
                <Send className="w-4 h-4 mr-2" />
                Marquer comme envoyé
              </Button>
            )}
            {status === "sent" && (
              <>
                <Button
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => changeStatus.mutate("accepted")}
                  disabled={busy}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accepté
                </Button>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => changeStatus.mutate("refused")}
                  disabled={busy}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Refusé
                </Button>
              </>
            )}
            {(status === "refused" || status === "expired") && (
              <Button
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => changeStatus.mutate("draft")}
                disabled={busy}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Remettre en brouillon
              </Button>
            )}

            {isDraft && (
              <>
                <Button variant="outline" asChild>
                  <Link href={`/billing/quotes/${id}/edit`}>
                    <Pencil className="w-4 h-4 mr-2" /> Modifier
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteOpen(true)}
                  disabled={busy}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setShowPrint(true)}>
              <Printer className="w-4 h-4 mr-2" /> Imprimer
            </Button>
            <Button
              variant="outline"
              onClick={handleConvertToProforma}
              disabled={busy}
            >
              <FileCheck className="w-4 h-4 mr-2" />
              {converting === "proforma" ? "Conversion…" : "→ Proforma"}
            </Button>
            <Button onClick={handleConvertToInvoice} disabled={busy}>
              <FileSignature className="w-4 h-4 mr-2" />
              {converting === "invoice" ? "Conversion…" : "→ Facture"}
            </Button>
          </div>
        </div>

        {/* Workflow visuel */}
        <div className="flex items-center gap-1 text-sm select-none">
          {["draft", "sent", "accepted"].map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground mx-1">→</span>}
              <span className={`px-3 py-1 rounded-full font-medium transition-all ${
                status === s
                  ? `${STATUS_COLORS[s]} border font-semibold scale-105`
                  : status === "refused" && s === "accepted"
                  ? "bg-red-50 text-red-400 border border-red-200"
                  : "bg-muted text-muted-foreground"
              }`}>
                {s === "accepted" && status === "refused" ? "Refusé" : STATUS_LABELS[s]}
              </span>
            </div>
          ))}
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
              <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-relaxed">
                <span className="font-semibold">Arrêté le présent devis à la somme de :</span>{" "}
                <span className="font-bold uppercase text-blue-700">{amountInWords(quote.total)}</span>
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
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}>
                      {STATUS_LABELS[status] ?? status}
                    </span>
                  </div>
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce devis&nbsp;?</AlertDialogTitle>
            <AlertDialogDescription>
              Le devis {quote.quoteNumber} sera définitivement supprimé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); removeMutation.mutate(); }}
              className="bg-red-600 hover:bg-red-700"
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
