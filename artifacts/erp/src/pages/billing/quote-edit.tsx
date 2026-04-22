import { useEffect, useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { CurrencySelect } from "@/components/CurrencySelect";
import { useParams, useLocation, Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReactSelect from "react-select";
import { rsClassNames, rsClassNamesCompact, rsPortalStyles } from "@/lib/rs-styles";
import {
  useGetQuote, useListPartners, useListProducts, updateQuote,
} from "@workspace/api-client-react";
import type { UpdateQuoteBody, DocumentItemInput } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const emptyItem = (): DocumentItemInput => ({
  productId: null, description: "", quantity: 1, unitPrice: 0, taxRate: 0,
});

export default function QuoteEdit() {
  const { id } = useParams();
  const quoteId = Number(id);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: quote, isLoading } = useGetQuote(quoteId, {
    query: { enabled: !!id, queryKey: ["quote", id] },
  });
  const { data: partnersData } = useListPartners();
  const { data: productsData } = useListProducts();

  const [form, setForm] = useState<UpdateQuoteBody>({
    partnerId: null, subject: null, issueDate: format(new Date(), "yyyy-MM-dd"),
    validUntil: null, currency: null, notes: null, items: [emptyItem()],
  });

  useEffect(() => {
    if (!quote) return;
    setForm({
      partnerId: quote.partnerId ?? null,
      subject: quote.subject ?? null,
      issueDate: format(new Date(quote.issueDate), "yyyy-MM-dd"),
      validUntil: quote.validUntil ? format(new Date(quote.validUntil), "yyyy-MM-dd") : null,
      currency: quote.currency ?? null,
      notes: quote.notes ?? null,
      items: (quote.items ?? []).map((it) => ({
        productId: it.productId ?? null,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate ?? 0,
      })),
    });
  }, [quote]);

  const handleApiError = async (err: unknown, fallback: string) => {
    let message = fallback;
    if (err instanceof Response) {
      try { const j = await err.json(); if (j?.error) message = j.error; } catch { /* ignore */ }
    } else if (err instanceof Error) {
      message = err.message;
    }
    toast({ title: "Erreur", description: message, variant: "destructive" });
  };

  const saveMutation = useMutation({
    mutationFn: (body: UpdateQuoteBody) => updateQuote(quoteId, body),
    onSuccess: () => {
      toast({ title: "Devis mis à jour" });
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      navigate(`/billing/quotes/${id}`);
    },
    onError: (err) => handleApiError(err, "Échec de la mise à jour"),
  });

  const { formatCurrency } = useCurrency();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  if (!quote) return <div className="p-8 text-center text-muted-foreground">Devis introuvable</div>;

  if (quote.status !== "draft") {
    return (
      <Card className="max-w-2xl mx-auto mt-12">
        <CardHeader><CardTitle>Modification impossible</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Ce devis n'est plus en brouillon&nbsp;: il ne peut plus être modifié.
          </p>
          <Button asChild variant="outline">
            <Link href={`/billing/quotes/${id}`}><ArrowLeft className="w-4 h-4 mr-2" /> Retour au devis</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const items = form.items ?? [];
  const updateItem = (idx: number, field: keyof DocumentItemInput, value: unknown) =>
    setForm((f) => ({ ...f, items: (f.items ?? []).map((it, i) => i === idx ? { ...it, [field]: value } : it) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...(f.items ?? []), emptyItem()] }));
  const removeItem = (idx: number) => setForm((f) => ({ ...f, items: (f.items ?? []).filter((_, i) => i !== idx) }));

  const total = items.reduce((acc, it) => acc + it.quantity * it.unitPrice * (1 + (it.taxRate ?? 0) / 100), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/billing/quotes/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Modifier le devis {quote.quoteNumber}</h1>
          <p className="text-muted-foreground mt-1">Brouillon — modifications autorisées</p>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }}
        className="space-y-6"
      >
        <Card>
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client</Label>
                <ReactSelect
                  unstyled
                  classNames={rsClassNames}
                  styles={rsPortalStyles}
                  isClearable
                  placeholder="Rechercher un client..."
                  noOptionsMessage={() => "Aucun client trouvé"}
                  options={partnersData?.data?.map((p) => ({ value: p.id, label: p.name })) ?? []}
                  value={form.partnerId ? { value: form.partnerId, label: partnersData?.data?.find((p) => p.id === form.partnerId)?.name ?? "" } : null}
                  onChange={(opt) => setForm((f) => ({ ...f, partnerId: opt ? opt.value : null }))}
                />
              </div>
              <div>
                <Label>Objet</Label>
                <Input value={form.subject ?? ""} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value || null }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date d'émission *</Label>
                <Input type="date" value={form.issueDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))} required />
              </div>
              <div>
                <Label>Valide jusqu'au</Label>
                <Input type="date" value={form.validUntil ?? ""} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value || null }))} />
              </div>
              <div>
                <CurrencySelect value={form.currency} onChange={(code) => setForm((f) => ({ ...f, currency: code }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lignes</CardTitle></CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2">Produit</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-right px-3 py-2 w-20">Qté</th>
                    <th className="text-right px-3 py-2 w-28">Prix</th>
                    <th className="text-right px-3 py-2 w-20">TVA%</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1">
                        <ReactSelect
                          unstyled
                          classNames={rsClassNamesCompact}
                          styles={rsPortalStyles}
                          isClearable
                          placeholder="Libre..."
                          noOptionsMessage={() => "Aucun produit"}
                          options={productsData?.data?.map((p) => ({ value: p.id, label: p.name })) ?? []}
                          value={it.productId ? { value: it.productId, label: productsData?.data?.find((p) => p.id === it.productId)?.name ?? "" } : null}
                          onChange={(opt) => {
                            if (!opt) { updateItem(idx, "productId", null); return; }
                            const prod = productsData?.data?.find((p) => p.id === opt.value);
                            if (prod) {
                              setForm((f) => ({
                                ...f,
                                items: (f.items ?? []).map((it2, i) =>
                                  i === idx
                                    ? { ...it2, productId: prod.id, description: prod.name, unitPrice: prod.unitPrice, taxRate: prod.taxRate }
                                    : it2,
                                ),
                              }));
                            }
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input className="h-8 text-xs" value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} required />
                      </td>
                      <td className="px-2 py-1">
                        <Input className="h-8 text-xs text-right" type="number" min="1" step="1" value={it.quantity} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} />
                      </td>
                      <td className="px-2 py-1">
                        <Input className="h-8 text-xs text-right" type="number" min="0" step="0.01" value={it.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))} />
                      </td>
                      <td className="px-2 py-1">
                        <Input className="h-8 text-xs text-right" type="number" min="0" max="100" step="0.01" value={it.taxRate ?? 0} onChange={(e) => updateItem(idx, "taxRate", Number(e.target.value))} />
                      </td>
                      <td className="px-2 py-1">
                        {items.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-t">
                <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter une ligne
                </Button>
                <span className="text-sm font-semibold">Total : {formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))} rows={3} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href={`/billing/quotes/${id}`}>Annuler</Link>
          </Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
