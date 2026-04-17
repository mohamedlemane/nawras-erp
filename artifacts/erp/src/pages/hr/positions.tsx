import { useState } from "react";
import { useListPositions, useListDepartments, createPosition, updatePosition, deletePosition } from "@workspace/api-client-react";
import type { CreatePositionBody, Position } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PositionsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: positions, isLoading } = useListPositions();
  const { data: departments } = useListDepartments();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Position | null>(null);
  const [deleteItem, setDeleteItem] = useState<Position | null>(null);
  const [form, setForm] = useState<CreatePositionBody>({ name: "", departmentId: null, description: null });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/positions"] });

  const createMutation = useMutation({
    mutationFn: (data: CreatePositionBody) => createPosition(data),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Poste créé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreatePositionBody }) => updatePosition(id, data),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Poste mis à jour" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePosition(id),
    onSuccess: () => { invalidate(); setDeleteItem(null); toast({ title: "Poste supprimé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditItem(null); setForm({ name: "", departmentId: null, description: null }); setDialogOpen(true); };
  const openEdit = (p: Position) => { setEditItem(p); setForm({ name: p.name, departmentId: p.departmentId ?? null, description: p.description ?? null }); setDialogOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editItem ? updateMutation.mutate({ id: editItem.id, data: form }) : createMutation.mutate(form);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const getDeptName = (id: number | null | undefined) => departments?.find(d => d.id === id)?.name || '-';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Postes</h1>
          <p className="text-muted-foreground mt-1">Gérez les postes de votre entreprise</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Nouveau Poste</Button>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Intitulé</TableHead>
              <TableHead>Département</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center h-24">Chargement...</TableCell></TableRow>
            ) : !positions?.length ? (
              <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Aucun poste</TableCell></TableRow>
            ) : positions.map(pos => (
              <TableRow key={pos.id}>
                <TableCell className="font-medium">{pos.name}</TableCell>
                <TableCell>{getDeptName(pos.departmentId)}</TableCell>
                <TableCell className="text-muted-foreground">{pos.description || '-'}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(pos)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteItem(pos)}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "Modifier le poste" : "Nouveau poste"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Intitulé *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div>
              <Label>Département</Label>
              <Select value={form.departmentId?.toString() || "none"} onValueChange={v => setForm(f => ({ ...f, departmentId: v === "none" ? null : Number(v) }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {departments?.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))} rows={3} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "En cours..." : editItem ? "Modifier" : "Créer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItem} onOpenChange={open => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le poste</AlertDialogTitle>
            <AlertDialogDescription>Supprimer "{deleteItem?.name}" ? Action irréversible.</AlertDialogDescription>
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
