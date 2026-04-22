import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useGetProforma, createInvoice, updateProforma } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintDocument } from "@/components/print/PrintDocument";
import { ArrowLeft, Printer, FileSignature, Send, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { numberToWordsMRU } from "@/lib/number-to-words";

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

export default function ProformaDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: proforma, isLoading } = useGetProforma(Number(id), {
    query: { enabled: !!id, queryKey: ["proforma", id] },
  });
  const [showPrint, setShowPrint] = useState(false);
  const [converting, setConverting] = useState(false);

  const changeStatus = useMutation({
    mutationFn: (status: string) => updateProforma(Number(id), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proforma", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/proformas"] });
    },
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  if (!proforma) return <div className="p-8 text-center text-muted-foreground">Proforma introuvable</div>;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("fr-MR", { minimumFractionDigits: 2 }).format(val) + " MRU";

  const handleConvertToInvoice = async () => {
    setConverting(true);
    try {
      const invoice = await createInvoice({
        partnerId: proforma.partnerId ?? null,
        subject: proforma.subject ?? null,
        issueDate: new Date().toISOString().slice(0, 10),
        notes: proforma.notes ?? null,
        items: (proforma.items ?? []).map((item) => ({
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
      setConverting(false);
    }
  };

  const status = proforma.status;
  const busy = changeStatus.isPending || converting;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/billing/proformas"><ArrowLeft className="w-4 h-4" /></Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">Proforma {proforma.proformaNumber}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}>
                  {STATUS_LABELS[status] ?? status}
                </span>
              </div>
              <p className="text-muted-foreground mt-1">{proforma.partnerName}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
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

            <Button variant="outline" onClick={() => setShowPrint(true)}>
              <Printer className="w-4 h-4 mr-2" /> Imprimer
            </Button>
            <Button onClick={handleConvertToInvoice} disabled={busy}>
              <FileSignature className="w-4 h-4 mr-2" />
              {converting ? "Conversion…" : "→ Facture"}
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
            <CardHeader><CardTitle>Lignes</CardTitle></CardHeader>
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
                  {proforma.items?.map((item, i) => (
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
                  <div className="flex justify-between text-sm"><span>Sous-total HT</span><span>{formatCurrency(proforma.subtotal)}</span></div>
                  <div className="flex justify-between text-sm"><span>TVA</span><span>{formatCurrency(proforma.taxAmount)}</span></div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total TTC</span><span>{formatCurrency(proforma.total)}</span></div>
                </div>
              </div>
              <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-relaxed">
                <span className="font-semibold">Arrêtée la présente facture proforma à la somme de :</span>{" "}
                <span className="font-bold uppercase text-blue-700">{numberToWordsMRU(proforma.total)}</span>
              </div>
              <div className="hidden">
                <div>
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
                  <p className="font-medium">{proforma.proformaNumber}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Date d'émission</span>
                  <p className="font-medium">{format(new Date(proforma.issueDate), "dd/MM/yyyy")}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Statut</span>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}>
                      {STATUS_LABELS[status] ?? status}
                    </span>
                  </div>
                </div>
                {proforma.subject && (
                  <div>
                    <span className="text-sm text-muted-foreground">Objet</span>
                    <p className="font-medium">{proforma.subject}</p>
                  </div>
                )}
                {proforma.notes && (
                  <div>
                    <span className="text-sm text-muted-foreground">Notes</span>
                    <p className="text-sm">{proforma.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showPrint && (
        <PrintDocument
          docType="FACTURE PROFORMA"
          docNumber={proforma.proformaNumber}
          issueDate={proforma.issueDate}
          partnerName={proforma.partnerName}
          subject={proforma.subject}
          notes={proforma.notes}
          items={proforma.items ?? []}
          subtotal={proforma.subtotal}
          taxAmount={proforma.taxAmount}
          total={proforma.total}
          onClose={() => setShowPrint(false)}
        />
      )}
    </>
  );
}
