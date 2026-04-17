import { useState, useMemo } from "react";
import { useListRoles, useGetRolePermissions, useSetRolePermissions } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, ShieldCheck, Plus, Trash2, Settings2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const MODULE_LABELS: Record<string, string> = {
  billing: "Facturation",
  hr: "Ressources Humaines",
  settings: "Paramètres",
  admin: "Administration",
};

const MODULE_COLORS: Record<string, string> = {
  billing: "bg-blue-50 border-blue-200",
  hr: "bg-green-50 border-green-200",
  settings: "bg-orange-50 border-orange-200",
  admin: "bg-purple-50 border-purple-200",
};

const MODULE_BADGE: Record<string, string> = {
  billing: "bg-blue-100 text-blue-800",
  hr: "bg-green-100 text-green-800",
  settings: "bg-orange-100 text-orange-800",
  admin: "bg-purple-100 text-purple-800",
};

interface Permission {
  id: number;
  name: string;
  description: string | null;
  module: string | null;
}

async function fetchPermissions(): Promise<Permission[]> {
  const r = await fetch(`${BASE}/api/permissions`, { credentials: "include" });
  if (!r.ok) throw new Error("Erreur chargement permissions");
  return r.json();
}

async function createRole(data: { name: string; description?: string }) {
  const r = await fetch(`${BASE}/api/roles`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || "Erreur création rôle");
  return body;
}

async function deleteRole(id: number) {
  const r = await fetch(`${BASE}/api/roles/${id}`, { method: "DELETE", credentials: "include" });
  if (!r.ok) {
    const body = await r.json();
    throw new Error(body.error || "Erreur suppression");
  }
}

async function setRolePermissions(id: number, permissions: string[]) {
  const r = await fetch(`${BASE}/api/roles/${id}/permissions`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissions }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || "Erreur mise à jour permissions");
  return body;
}

async function fetchRolePermissions(id: number): Promise<{ permissions: string[]; isSystem: boolean }> {
  const r = await fetch(`${BASE}/api/roles/${id}/permissions`, { credentials: "include" });
  if (!r.ok) throw new Error("Erreur chargement permissions du rôle");
  return r.json();
}

export default function RolesList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [permOpen, setPermOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<{ id: number; name: string; isSystem: boolean } | null>(null);
  const [checkedPerms, setCheckedPerms] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const { data: roles, isLoading } = useListRoles();
  const { data: allPerms = [] } = useQuery({ queryKey: ["/api/permissions"], queryFn: fetchPermissions });

  const permsByModule = useMemo(() => {
    const map: Record<string, Permission[]> = {};
    for (const p of allPerms) {
      const mod = p.module ?? "other";
      if (!map[mod]) map[mod] = [];
      map[mod].push(p);
    }
    return map;
  }, [allPerms]);

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setCreateOpen(false);
      setCreateForm({ name: "", description: "" });
      toast({ title: "Rôle créé avec succès" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setDeleteConfirm(null);
      toast({ title: "Rôle supprimé" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, perms }: { id: number; perms: string[] }) => setRolePermissions(id, perms),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setPermOpen(false);
      toast({ title: "Permissions mises à jour" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openPermissions = async (role: { id: number; name: string; isSystem: boolean }) => {
    setSelectedRole(role);
    setPermOpen(true);
    const data = await fetchRolePermissions(role.id);
    setCheckedPerms(new Set(data.permissions));
  };

  const togglePerm = (name: string) => {
    setCheckedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleModule = (mod: string) => {
    const modPerms = permsByModule[mod]?.map((p) => p.name) ?? [];
    const allChecked = modPerms.every((n) => checkedPerms.has(n));
    setCheckedPerms((prev) => {
      const next = new Set(prev);
      if (allChecked) modPerms.forEach((n) => next.delete(n));
      else modPerms.forEach((n) => next.add(n));
      return next;
    });
  };

  const totalPerms = (roleId: number) => {
    return undefined;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rôles & Permissions</h1>
          <p className="text-muted-foreground mt-1">Définissez les niveaux d'accès pour chaque profil utilisateur</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Créer un rôle
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rôle</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !roles?.length ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Aucun rôle trouvé</TableCell></TableRow>
              ) : roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {r.isSystem
                        ? <ShieldCheck className="w-4 h-4 text-purple-500" />
                        : <Shield className="w-4 h-4 text-blue-500" />
                      }
                      <span className="font-medium">{r.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.description || "—"}</TableCell>
                  <TableCell>
                    {r.isSystem
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800"><Lock className="w-3 h-3" />Système</span>
                      : <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">Personnalisé</span>
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPermissions({ id: r.id, name: r.name, isSystem: r.isSystem })}
                      >
                        <Settings2 className="w-4 h-4 mr-1.5" /> Permissions
                      </Button>
                      {!r.isSystem && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteConfirm({ id: r.id, name: r.name })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Créer un rôle */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Créer un nouveau rôle</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(createForm); }} className="space-y-4">
            <div>
              <Label>Nom du rôle *</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ex: commercial, support..."
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Décrivez le rôle et ses responsabilités..."
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmer suppression */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer le rôle</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Voulez-vous vraiment supprimer le rôle <strong>{deleteConfirm?.name}</strong> ?
            Les utilisateurs ayant ce rôle n'auront plus aucun accès.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet: Gérer les permissions */}
      <Sheet open={permOpen} onOpenChange={setPermOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Permissions — {selectedRole?.name}
              {selectedRole?.isSystem && (
                <span className="inline-flex items-center gap-1 ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                  <Lock className="w-3 h-3" /> Système
                </span>
              )}
            </SheetTitle>
            {selectedRole?.isSystem && (
              <p className="text-sm text-amber-600 mt-1">
                Les permissions des rôles système peuvent être consultées mais pas modifiées.
              </p>
            )}
          </SheetHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-6">
              {Object.entries(permsByModule).map(([mod, perms]) => {
                const modChecked = perms.filter((p) => checkedPerms.has(p.name)).length;
                const modAll = perms.length;
                const allChecked = modChecked === modAll;
                const partial = modChecked > 0 && !allChecked;

                return (
                  <div key={mod} className={`rounded-lg border p-4 ${MODULE_COLORS[mod] ?? "bg-gray-50 border-gray-200"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`mod-${mod}`}
                          checked={allChecked}
                          data-state={partial ? "indeterminate" : allChecked ? "checked" : "unchecked"}
                          onCheckedChange={() => !selectedRole?.isSystem && toggleModule(mod)}
                          disabled={selectedRole?.isSystem}
                          className={partial ? "opacity-60" : ""}
                        />
                        <label htmlFor={`mod-${mod}`} className={`text-sm font-semibold cursor-pointer ${selectedRole?.isSystem ? "cursor-default" : ""}`}>
                          {MODULE_LABELS[mod] ?? mod}
                        </label>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MODULE_BADGE[mod] ?? "bg-gray-100 text-gray-700"}`}>
                          {modChecked}/{modAll}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-6">
                      {perms.map((perm) => (
                        <label
                          key={perm.name}
                          className={`flex items-start gap-2 p-2 rounded-md transition-colors ${
                            selectedRole?.isSystem ? "cursor-default" : "cursor-pointer hover:bg-white/60"
                          }`}
                        >
                          <Checkbox
                            checked={checkedPerms.has(perm.name)}
                            onCheckedChange={() => !selectedRole?.isSystem && togglePerm(perm.name)}
                            disabled={selectedRole?.isSystem}
                            className="mt-0.5"
                          />
                          <div>
                            <div className="text-xs font-medium leading-tight">{perm.description}</div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">{perm.name}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {!selectedRole?.isSystem && (
            <SheetFooter className="px-6 py-4 border-t">
              <div className="flex justify-between items-center w-full">
                <span className="text-sm text-muted-foreground">
                  {checkedPerms.size} permission{checkedPerms.size !== 1 ? "s" : ""} sélectionnée{checkedPerms.size !== 1 ? "s" : ""}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPermOpen(false)}>Annuler</Button>
                  <Button
                    disabled={saveMutation.isPending}
                    onClick={() => selectedRole && saveMutation.mutate({ id: selectedRole.id, perms: Array.from(checkedPerms) })}
                  >
                    {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
