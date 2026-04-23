import { useState } from "react";
import { formatAmount } from "@/lib/currencies";
import { useCurrency } from "@/hooks/use-currency";
import ReactSelect from "react-select";
import { rsClassNames, rsClassNamesCompact, rsPortalStyles } from "@/lib/rs-styles";
import { useListQuotes, useListPartners, useListProducts, createQuote, deleteQuote } from "@workspace/api-client-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CreateQuoteBody, DocumentItemInput } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencySelect } from "@/components/CurrencySelect";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { Plus, Search, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const emptyItem = (): DocumentItemInput => ({ productId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 0 });

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
};
const statusLabels: Record<string, string> = { draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté', rejected: 'Refusé' };

export default function QuotesList() {
  const { currency: defaultCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchString = useSearch();
  const urlStatus = new URLSearchParams(searchString).get("status") ?? "all";
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(urlStatus);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formCurrency, setFormCurrency] = useState<string>(defaultCurrency.code);
  const [form, setForm] = useState<CreateQuoteBody>({
    partnerId: null, subject: null, issueDate: format(new Date(), 'yyyy-MM-dd'),
    validUntil: null, currency: null, notes: null, items: [emptyItem()],
  });

  const { data, isLoading } = useListQuotes({ search: search || undefined, status: status !== "all" ? status : undefined } as any);
  const rows = data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paginated = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const { data: partnersData } = useListPartners();
  const { data: productsData } = useListProducts();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });

  const [pendingDelete, setPendingDelete] = useState<{ id: number; number: string } | null>(null);

  const handleApiError = async (err: unknown, fallback: string) => {
    let message = fallback;
    if (err instanceof Response) {
      try { const j = await err.json(); if (j?.error) message = j.error; } catch { /* ignore */ }
    } else if (err instanceof Error) {
      message = err.message;
    }
    toast({ title: "Erreur", description: message, variant: "destructive" });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateQuoteBody) => createQuote(data),
    onSuccess: () => { invalidate(); setSheetOpen(false); toast({ title: "Devis créé" }); },
    onError: (err) => handleApiError(err, "Création impossible"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteQuote(id),
    onSuccess: () => { invalidate(); setPendingDelete(null); toast({ title: "Devis supprimé" }); },
    onError: (err) => handleApiError(err, "Suppression impossible"),
  });

  const openCreate = () => {
    setFormCurrency(defaultCurrency.code);
    setForm({ partnerId: null, subject: null, issueDate: format(new Date(), 'yyyy-MM-dd'), validUntil: null, currency: null, notes: null, items: [emptyItem()] });
    setSheetOpen(true);
  };

  const updateItem = (idx: number, field: keyof DocumentItemInput, value: unknown) => {
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }));
  };

  const setItemProduct = (idx: number, productId: string) => {
    if (productId === "none") { updateItem(idx, 'productId', null); return; }
    const prod = productsData?.data?.find(p => p.id === Number(productId));
    if (prod) {
      setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, productId: prod.id, description: prod.name, unitPrice: prod.unitPrice, taxRate: prod.taxRate } : it) }));
    }
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const calcTotal = () => form.items.reduce((acc, it) => acc + it.quantity * it.unitPrice * (1 + (it.taxRate ?? 0) / 100), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Devis</h1>
          <p className="text-muted-foreground mt-2">Gérez vos devis clients</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Nouveau Devis</Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Valide jusqu'au</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Aucun devis trouvé</TableCell></TableRow>
              ) : paginated.map(quote => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium font-mono">{quote.quoteNumber}</TableCell>
                  <TableCell>{quote.partnerName || '-'}</TableCell>
                  <TableCell>{format(new Date(quote.issueDate), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{quote.validUntil ? format(new Date(quote.validUntil), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell className="text-right font-medium">{formatAmount(quote.total, quote.currency)}</TableCell>
                  <TableCell><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[quote.status] || 'bg-gray-100 text-gray-700'}`}>{statusLabels[quote.status] || quote.status}</span></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/billing/quotes/${quote.id}`}><Eye className="w-4 h-4" /></Link>
                    </Button>
                    {quote.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPendingDelete({ id: quote.id, number: quote.quoteNumber })}
                        title="Supprimer le devis"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination page={page} totalPages={totalPages} total={rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          className="sm:max-w-2xl overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <SheetHeader><SheetTitle>Nouveau devis</SheetTitle></SheetHeader>
          <form onSubmit={e => { e.preventDefault(); createMutation.mutate({ ...form, currency: formCurrency }); }} className="space-y-4 mt-4">
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
                  options={partnersData?.data?.map(p => ({ value: p.id, label: p.name })) ?? []}
                  value={form.partnerId ? { value: form.partnerId, label: partnersData?.data?.find(p => p.id === form.partnerId)?.name ?? "" } : null}
                  onChange={opt => setForm(f => ({ ...f, partnerId: opt ? opt.value : null }))}
                />
              </div>
              <div><Label>Objet</Label><Input value={form.subject ?? ""} onChange={e => setForm(f => ({ ...f, subject: e.target.value || null }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date d'émission *</Label><Input type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} required /></div>
              <div><Label>Valide jusqu'au</Label><Input type="date" value={form.validUntil ?? ""} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value || null }))} /></div>
              <CurrencySelect showDefault={false} value={formCurrency} onChange={code => setFormCurrency(code ?? defaultCurrency.code)} />
            </div>

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
                  {form.items.map((it, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1">
                        <ReactSelect
                          unstyled
                          classNames={rsClassNamesCompact}
                          styles={rsPortalStyles}
                          isClearable
                          placeholder="Libre..."
                          noOptionsMessage={() => "Aucun produit"}
                          options={productsData?.data?.map(p => ({ value: p.id, label: p.name })) ?? []}
                          value={it.productId ? { value: it.productId, label: productsData?.data?.find(p => p.id === it.productId)?.name ?? "" } : null}
                          onChange={opt => {
                            if (!opt) { updateItem(idx, 'productId', null); return; }
                            const prod = productsData?.data?.find(p => p.id === opt.value);
                            if (prod) setForm(f => ({ ...f, items: f.items.map((it2, i) => i === idx ? { ...it2, productId: prod.id, description: prod.name, unitPrice: prod.unitPrice, taxRate: prod.taxRate } : it2) }));
                          }}
                        />
                      </td>
                      <td className="px-2 py-1"><Input className="h-8 text-xs" value={it.description} onChange={e => updateItem(idx, 'description', e.target.value)} required /></td>
                      <td className="px-2 py-1"><Input className="h-8 text-xs text-right" type="number" min="1" step="1" value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} /></td>
                      <td className="px-2 py-1"><Input className="h-8 text-xs text-right" type="number" min="0" step="0.01" value={it.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} /></td>
                      <td className="px-2 py-1"><Input className="h-8 text-xs text-right" type="number" min="0" max="100" step="0.01" value={it.taxRate ?? 0} onChange={e => updateItem(idx, 'taxRate', Number(e.target.value))} /></td>
                      <td className="px-2 py-1">
                        {form.items.length > 1 && <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-t">
                <Button type="button" variant="ghost" size="sm" onClick={addItem}><Plus className="w-3.5 h-3.5 mr-1" /> Ajouter une ligne</Button>
                <span className="text-sm font-semibold">Total : {formatAmount(calcTotal(), formCurrency)}</span>
              </div>
            </div>

            <div><Label>Notes</Label><Textarea value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))} rows={2} /></div>
            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "En cours..." : "Créer le devis"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce devis&nbsp;?</AlertDialogTitle>
            <AlertDialogDescription>
              Le devis {pendingDelete?.number} sera définitivement supprimé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (pendingDelete) deleteMutation.mutate(pendingDelete.id); }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
