import { useState } from "react";
import { useListProformas, useListPartners, useListProducts, createProforma } from "@workspace/api-client-react";
import type { CreateProformaBody, DocumentItemInput } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const emptyItem = (): DocumentItemInput => ({ productId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 0 });

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
};
const statusLabels: Record<string, string> = { draft: 'Brouillon', sent: 'Envoyée', accepted: 'Acceptée', rejected: 'Refusée' };

export default function ProformasList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<CreateProformaBody>({
    partnerId: null, subject: null, issueDate: format(new Date(), 'yyyy-MM-dd'),
    validUntil: null, notes: null, items: [emptyItem()],
  });

  const { data, isLoading } = useListProformas({ search: search || undefined, status: status !== "all" ? status : undefined } as any);
  const { data: partnersData } = useListPartners();
  const { data: productsData } = useListProducts();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/proformas"] });

  const createMutation = useMutation({
    mutationFn: (data: CreateProformaBody) => createProforma(data),
    onSuccess: () => { invalidate(); setSheetOpen(false); toast({ title: "Proforma créée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setForm({ partnerId: null, subject: null, issueDate: format(new Date(), 'yyyy-MM-dd'), validUntil: null, notes: null, items: [emptyItem()] });
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
  const formatCurrency = (val: number) => new Intl.NumberFormat('fr-MR', { style: 'currency', currency: 'MRU' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proformas</h1>
          <p className="text-muted-foreground mt-2">Gérez vos factures proforma</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Nouvelle Proforma</Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Aucune proforma trouvée</TableCell></TableRow>
              ) : data.data.map(proforma => (
                <TableRow key={proforma.id}>
                  <TableCell className="font-medium font-mono">{proforma.proformaNumber}</TableCell>
                  <TableCell>{proforma.partnerName || '-'}</TableCell>
                  <TableCell>{format(new Date(proforma.issueDate), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(proforma.total)}</TableCell>
                  <TableCell><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[proforma.status] || 'bg-gray-100 text-gray-700'}`}>{statusLabels[proforma.status] || proforma.status}</span></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/billing/proformas/${proforma.id}`}><Eye className="w-4 h-4" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>Nouvelle proforma</SheetTitle></SheetHeader>
          <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client</Label>
                <Select value={form.partnerId?.toString() || "none"} onValueChange={v => setForm(f => ({ ...f, partnerId: v === "none" ? null : Number(v) }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sans client</SelectItem>
                    {partnersData?.data?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Objet</Label><Input value={form.subject ?? ""} onChange={e => setForm(f => ({ ...f, subject: e.target.value || null }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date d'émission *</Label><Input type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} required /></div>
              <div><Label>Valide jusqu'au</Label><Input type="date" value={form.validUntil ?? ""} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value || null }))} /></div>
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
                        <Select value={it.productId?.toString() || "none"} onValueChange={v => setItemProduct(idx, v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choisir" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Libre</SelectItem>
                            {productsData?.data?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
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
                <span className="text-sm font-semibold">Total : {formatCurrency(calcTotal())}</span>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))} rows={2} /></div>
            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "En cours..." : "Créer la proforma"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
