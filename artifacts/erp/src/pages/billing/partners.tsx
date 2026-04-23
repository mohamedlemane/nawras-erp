import { useState } from "react";
import { useListPartners, createPartner, updatePartner, deletePartner } from "@workspace/api-client-react";
import type { CreatePartnerBody, CreatePartnerBodyType, Partner } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useSort } from "@/hooks/use-sort";
import { Plus, Search, Eye, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const emptyForm = (): CreatePartnerBody => ({
  type: 'customer' as CreatePartnerBodyType, name: '', companyName: null, contactPerson: null,
  email: null, phone: null, whatsapp: null, address: null, city: null, country: null, taxNumber: null, notes: null,
});

export default function PartnersList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editItem, setEditItem] = useState<Partner | null>(null);
  const [deleteItem, setDeleteItem] = useState<Partner | null>(null);
  const [form, setForm] = useState<CreatePartnerBody>(emptyForm());

  const { data, isLoading } = useListPartners({ search: search || undefined, type: type !== "all" ? type : undefined } as any);
  const rows = data?.data ?? [];
  const { sorted, sortCol, sortDir, toggle } = useSort(rows, "name" as any);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/partners"] });

  const createMutation = useMutation({
    mutationFn: (data: CreatePartnerBody) => createPartner(data),
    onSuccess: () => { invalidate(); setSheetOpen(false); toast({ title: "Partenaire créé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreatePartnerBody }) => updatePartner(id, data),
    onSuccess: () => { invalidate(); setSheetOpen(false); toast({ title: "Partenaire mis à jour" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePartner(id),
    onSuccess: () => { invalidate(); setDeleteItem(null); toast({ title: "Partenaire supprimé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditItem(null); setForm(emptyForm()); setSheetOpen(true); };
  const openEdit = (p: Partner) => {
    setEditItem(p);
    setForm({
      type: p.type as CreatePartnerBodyType, name: p.name, companyName: p.companyName ?? null,
      contactPerson: p.contactPerson ?? null, email: p.email ?? null, phone: p.phone ?? null,
      whatsapp: p.whatsapp ?? null, address: p.address ?? null, city: p.city ?? null,
      country: p.country ?? null, taxNumber: p.taxNumber ?? null, notes: p.notes ?? null,
    });
    setSheetOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editItem ? updateMutation.mutate({ id: editItem.id, data: form }) : createMutation.mutate(form);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const typeLabel = (t: string) => ({ customer: 'Client', supplier: 'Fournisseur', both: 'Mixte' }[t] || t);
  const typeBadge = (t: string) => ({ customer: 'bg-blue-100 text-blue-700', supplier: 'bg-purple-100 text-purple-700', both: 'bg-green-100 text-green-700' }[t] || 'bg-gray-100 text-gray-700');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients & Fournisseurs</h1>
          <p className="text-muted-foreground mt-2">Gérez vos partenaires commerciaux</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Nouveau Partenaire</Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <Select value={type} onValueChange={v => { setType(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="customer">Client</SelectItem>
                <SelectItem value="supplier">Fournisseur</SelectItem>
                <SelectItem value="both">Mixte</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader label="Nom" column="name" sortCol={sortCol} sortDir={sortDir} onSort={toggle} />
                <SortableHeader label="Type" column="type" sortCol={sortCol} sortDir={sortDir} onSort={toggle} />
                <SortableHeader label="Entreprise" column="companyName" sortCol={sortCol} sortDir={sortDir} onSort={toggle} />
                <SortableHeader label="Email" column="email" sortCol={sortCol} sortDir={sortDir} onSort={toggle} />
                <TableHead>Téléphone</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Aucun partenaire trouvé</TableCell></TableRow>
              ) : paginated.map(partner => (
                <TableRow key={partner.id}>
                  <TableCell className="font-medium">{partner.name}</TableCell>
                  <TableCell><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeBadge(partner.type)}`}>{typeLabel(partner.type)}</span></TableCell>
                  <TableCell>{partner.companyName || '-'}</TableCell>
                  <TableCell>{partner.email || '-'}</TableCell>
                  <TableCell>{partner.phone || '-'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(partner)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteItem(partner)}><Trash2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/billing/partners/${partner.id}`}><Eye className="w-4 h-4" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination page={page} totalPages={totalPages} total={rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editItem ? "Modifier le partenaire" : "Nouveau partenaire"}</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as CreatePartnerBodyType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Client</SelectItem>
                  <SelectItem value="supplier">Fournisseur</SelectItem>
                  <SelectItem value="both">Mixte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nom *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div><Label>Nom de l'entreprise</Label><Input value={form.companyName ?? ""} onChange={e => setForm(f => ({ ...f, companyName: e.target.value || null }))} /></div>
            <div><Label>Contact principal</Label><Input value={form.contactPerson ?? ""} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value || null }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value || null }))} /></div>
              <div><Label>Téléphone</Label><Input value={form.phone ?? ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value || null }))} /></div>
            </div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp ?? ""} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value || null }))} /></div>
            <div><Label>Adresse</Label><Input value={form.address ?? ""} onChange={e => setForm(f => ({ ...f, address: e.target.value || null }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Ville</Label><Input value={form.city ?? ""} onChange={e => setForm(f => ({ ...f, city: e.target.value || null }))} /></div>
              <div><Label>Pays</Label><Input value={form.country ?? ""} onChange={e => setForm(f => ({ ...f, country: e.target.value || null }))} placeholder="Mauritanie" /></div>
            </div>
            <div><Label>Numéro fiscal</Label><Input value={form.taxNumber ?? ""} onChange={e => setForm(f => ({ ...f, taxNumber: e.target.value || null }))} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))} rows={3} /></div>
            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "En cours..." : editItem ? "Modifier" : "Créer"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteItem} onOpenChange={open => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le partenaire</AlertDialogTitle>
            <AlertDialogDescription>Supprimer "{deleteItem?.name}" ? Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
