import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Settings, Briefcase, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || "Erreur serveur");
  return body;
}

interface PType { id: number; code: string; label: string; description?: string; isActive: boolean; sortOrder: number; }

function TypesSection({
  title, icon: Icon, queryKey, endpoint, placeholder,
}: {
  title: string;
  icon: React.ElementType;
  queryKey: string;
  endpoint: string;
  placeholder: { code: string; label: string };
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PType | null>(null);
  const [form, setForm] = useState({ code: "", label: "", description: "", sortOrder: 0 });
  const [pending, setPending] = useState(false);

  const { data: items = [], isLoading } = useQuery<PType[]>({
    queryKey: [queryKey],
    queryFn: () => apiFetch(`${BASE}/api/${endpoint}`),
  });

  function openNew() {
    setEditing(null);
    setForm({ code: "", label: "", description: "", sortOrder: items.length * 10 });
    setOpen(true);
  }

  function openEdit(item: PType) {
    setEditing(item);
    setForm({ code: item.code, label: item.label, description: item.description ?? "", sortOrder: item.sortOrder });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      if (editing) {
        await apiFetch(`${BASE}/api/${endpoint}/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast({ title: "Modifié avec succès" });
      } else {
        await apiFetch(`${BASE}/api/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast({ title: "Créé avec succès" });
      }
      qc.invalidateQueries({ queryKey: [queryKey] });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setPending(false); }
  }

  async function handleToggle(item: PType) {
    try {
      await apiFetch(`${BASE}/api/${endpoint}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      qc.invalidateQueries({ queryKey: [queryKey] });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete(item: PType) {
    if (!confirm(`Supprimer "${item.label}" ?`)) return;
    try {
      await apiFetch(`${BASE}/api/${endpoint}/${item.id}`, { method: "DELETE" });
      toast({ title: "Supprimé" });
      qc.invalidateQueries({ queryKey: [queryKey] });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="w-4 h-4" /> {title}
          </CardTitle>
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Chargement...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Aucun type configuré.</p>
            <p className="text-xs mt-1">Cliquez sur "Ajouter" pour créer le premier type.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Ordre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell className="font-medium">{item.label}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                    {item.description || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{item.sortOrder}</TableCell>
                  <TableCell>
                    <button onClick={() => handleToggle(item)}>
                      <Badge variant={item.isActive ? "default" : "secondary"} className="cursor-pointer">
                        {item.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier" : "Nouveau"} {title.toLowerCase().replace(/s$/, "")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Code technique *</Label>
              <Input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder={placeholder.code}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Identifiant unique, sans espaces (ex: geo_marin)</p>
            </div>
            <div>
              <Label>Libellé affiché *</Label>
              <Input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder={placeholder.label}
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Description optionnelle..."
              />
            </div>
            <div>
              <Label>Ordre d'affichage</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                min={0}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={pending}>{pending ? "Enregistrement..." : "Enregistrer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function ProjectSettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">Paramètres Projets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configurez les types de prestations et types de consultation</p>
        </div>
      </div>

      <TypesSection
        title="Types de prestations"
        icon={Briefcase}
        queryKey="project-service-types"
        endpoint="project-service-types"
        placeholder={{ code: "geotechnique", label: "Géotechnique" }}
      />

      <TypesSection
        title="Types de consultation"
        icon={FileText}
        queryKey="project-consultation-types"
        endpoint="project-consultation-types"
        placeholder={{ code: "rfq", label: "Demande de cotation (RFQ)" }}
      />
    </div>
  );
}
