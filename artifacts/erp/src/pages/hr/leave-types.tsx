import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListLeaveTypes,
  useCreateLeaveType,
  updateLeaveType,
  deleteLeaveType,
  getListLeaveTypesQueryKey,
} from "@workspace/api-client-react";
import type { LeaveType, CreateLeaveTypeBody } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LeaveTypeForm {
  name: string;
  daysAllowed: string;
  description: string;
}

const emptyForm = (): LeaveTypeForm => ({ name: "", daysAllowed: "", description: "" });

const leaveTypeToForm = (lt: LeaveType): LeaveTypeForm => ({
  name: lt.name,
  daysAllowed: lt.daysAllowed !== null && lt.daysAllowed !== undefined ? String(lt.daysAllowed) : "",
  description: lt.description ?? "",
});

const formToBody = (form: LeaveTypeForm): CreateLeaveTypeBody => ({
  name: form.name,
  daysAllowed: form.daysAllowed !== "" ? Number(form.daysAllowed) : null,
  description: form.description || null,
});

export default function LeaveTypes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = getListLeaveTypesQueryKey();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeaveType | null>(null);
  const [editItem, setEditItem] = useState<LeaveType | null>(null);
  const [form, setForm] = useState<LeaveTypeForm>(emptyForm());

  const { data: types = [], isLoading } = useListLeaveTypes();

  const createMutation = useCreateLeaveType({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey });
        toast({ title: "Type de congé créé" });
        setDialogOpen(false);
      },
      onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateLeaveTypeBody }) =>
      updateLeaveType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Type de congé mis à jour" });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLeaveType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Type de congé supprimé" });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (lt: LeaveType) => {
    setEditItem(lt);
    setForm(leaveTypeToForm(lt));
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const body = formToBody(form);
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: body });
    } else {
      createMutation.mutate({ data: body });
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Types de congé</h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez les catégories de congés disponibles</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Nouveau type
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Tag className="w-4 h-4" /> {types.length} type{types.length !== 1 ? "s" : ""} de congé
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement…</div>
          ) : types.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <Tag className="w-10 h-10 mx-auto opacity-30" />
              <p>Aucun type de congé défini.</p>
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" /> Créer le premier
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {types.map((lt) => (
                <div key={lt.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Tag className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{lt.name}</p>
                      {lt.description && (
                        <p className="text-sm text-muted-foreground">{lt.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {lt.daysAllowed !== null && lt.daysAllowed !== undefined ? (
                      <Badge variant="secondary">{lt.daysAllowed} j/an</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Illimité</Badge>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(lt)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(lt)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Modifier le type de congé" : "Nouveau type de congé"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div>
              <Label>Nom *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Congé annuel, Maladie, Maternité…"
                required
                autoFocus
              />
            </div>
            <div>
              <Label>Jours alloués par an</Label>
              <Input
                type="number"
                min={0}
                value={form.daysAllowed}
                onChange={e => setForm(f => ({ ...f, daysAllowed: e.target.value }))}
                placeholder="Laisser vide = illimité"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description facultative"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={pending || !form.name.trim()}>
                {pending ? "Enregistrement…" : editItem ? "Mettre à jour" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce type de congé ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le type <strong>{deleteTarget?.name}</strong> sera définitivement supprimé.
              Cette action ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
