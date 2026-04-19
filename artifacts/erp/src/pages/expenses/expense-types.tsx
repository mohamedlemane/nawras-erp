import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Tag, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type ExpenseType = {
  id: number; name: string; code: string; color: string | null;
  description: string | null; isDefault: boolean; isActive: boolean;
};

const PRESET_COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#06b6d4", "#0ea5e9", "#94a3b8",
];

const EMPTY_FORM = { name: "", code: "", description: "", color: "#6366f1" };

export default function ExpenseTypes() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<ExpenseType | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [deleteTarget, setDeleteTarget] = useState<ExpenseType | null>(null);

  const { data: types, isLoading } = useQuery<ExpenseType[]>({
    queryKey: ["expense-types"],
    queryFn: () => fetch(`${BASE}/api/expense-types`, { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof EMPTY_FORM) => fetch(`${BASE}/api/expense-types`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-types"] });
      toast({ title: "Type de dépense créé" });
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<typeof EMPTY_FORM & { isActive: boolean }> }) =>
      fetch(`${BASE}/api/expense-types/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-types"] });
      toast({ title: "Type mis à jour" });
      setShowForm(false);
      setEditItem(null);
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/api/expense-types/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-types"] });
      toast({ title: "Type supprimé" });
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(type: ExpenseType) {
    setEditItem(type);
    setForm({ name: type.name, code: type.code, description: type.description ?? "", color: type.color ?? "#6366f1" });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editItem) updateMutation.mutate({ id: editItem.id, body: form });
    else createMutation.mutate(form);
  }

  function toggleActive(type: ExpenseType) {
    updateMutation.mutate({ id: type.id, body: { isActive: !type.isActive } });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/expenses">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Types de dépenses</h1>
            <p className="text-muted-foreground text-sm">Paramétrez les catégories de charges de votre entreprise</p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nouveau type
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(types ?? []).map(type => (
            <Card key={type.id} className={`transition-opacity ${!type.isActive ? "opacity-50" : ""}`}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${type.color ?? "#6366f1"}20` }}>
                    <Tag className="w-4 h-4" style={{ color: type.color ?? "#6366f1" }} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{type.name}</CardTitle>
                    <CardDescription className="text-xs font-mono">{type.code}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(type)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  {!type.isDefault && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(type)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between pt-1">
                <p className="text-sm text-muted-foreground line-clamp-1">{type.description ?? "—"}</p>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  {type.isDefault && <Badge variant="outline" className="text-xs">Défaut</Badge>}
                  <Switch checked={type.isActive} onCheckedChange={() => toggleActive(type)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditItem(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Modifier le type" : "Nouveau type de dépense"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nom *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex: Électricité" />
              </div>
              <div>
                <Label>Code *</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))}
                  required placeholder="Ex: electricite"
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Description courte..." />
            </div>
            <div>
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c} type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? "border-foreground scale-110 ring-2 ring-offset-1 ring-foreground/30" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                  />
                ))}
                <input
                  type="color" value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-7 h-7 rounded-full border-2 border-border cursor-pointer overflow-hidden p-0"
                  title="Couleur personnalisée"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditItem(null); }}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editItem ? "Enregistrer" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer ce type ?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            «<strong>{deleteTarget?.name}</strong>» sera supprimé. Les dépenses existantes garderont leur type.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
