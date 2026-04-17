import { useState } from "react";
import { useListUsers, useListRoles, updateUser, createUser, deleteUser } from "@workspace/api-client-react";
import type { AppUser, CreateUserBody } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Edit, Trash2, UserPlus, Mail } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  comptable: "bg-cyan-100 text-cyan-800",
  rh_manager: "bg-green-100 text-green-800",
  employe: "bg-gray-100 text-gray-700",
};

function Avatar({ user }: { user: AppUser }) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const initials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.email?.[0]?.toUpperCase() ?? "?";

  return user.profileImageUrl ? (
    <img src={user.profileImageUrl} alt={name} className="w-9 h-9 rounded-full object-cover" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-semibold text-primary">
      {initials.toUpperCase()}
    </div>
  );
}

export default function UsersList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editItem, setEditItem] = useState<AppUser | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<AppUser | null>(null);
  const [inviteForm, setInviteForm] = useState<CreateUserBody>({ email: "", firstName: null, lastName: null, roleId: 0 });
  const [selectedRoleId, setSelectedRoleId] = useState<string>("none");

  const { data, isLoading } = useListUsers({ search: search || undefined } as any);
  const { data: roles } = useListRoles();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/users"] });

  const inviteMutation = useMutation({
    mutationFn: () => createUser(inviteForm),
    onSuccess: () => {
      invalidate();
      setInviteOpen(false);
      setInviteForm({ email: "", firstName: null, lastName: null, roleId: 0 });
      toast({ title: "Utilisateur ajouté avec succès" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, roleId }: { id: string; roleId: number | null }) =>
      updateUser(id, { roleId } as any),
    onSuccess: () => { invalidate(); setEditOpen(false); setEditItem(null); toast({ title: "Rôle mis à jour" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => { invalidate(); setDeleteItem(null); toast({ title: "Utilisateur retiré de l'entreprise" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openEdit = (u: AppUser) => {
    setEditItem(u);
    setSelectedRoleId(u.roleId?.toString() || "none");
    setEditOpen(true);
  };

  const openInvite = () => {
    setInviteForm({ email: "", firstName: null, lastName: null, roleId: roles?.[0]?.id ?? 0 });
    setInviteOpen(true);
  };

  const totalUsers = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Utilisateurs</h1>
          <p className="text-muted-foreground mt-2">Gérez les accès et les rôles des membres de votre équipe</p>
        </div>
        <Button onClick={openInvite}>
          <UserPlus className="w-4 h-4 mr-2" /> Ajouter un utilisateur
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-blue-700">{totalUsers}</div>
            <div className="text-sm text-blue-600">Utilisateurs total</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-purple-700">{roles?.length ?? 0}</div>
            <div className="text-sm text-purple-600">Rôles disponibles</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-green-700">
              {data?.data?.filter(u => u.roleId).length ?? 0}
            </div>
            <div className="text-sm text-green-600">Avec rôle assigné</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou email..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Ajouté le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Mail className="w-8 h-8 opacity-30" />
                      <p>{search ? "Aucun utilisateur trouvé" : "Aucun utilisateur dans cette entreprise"}</p>
                      {!search && (
                        <Button size="sm" variant="outline" onClick={openInvite}>
                          <Plus className="w-3 h-3 mr-1" /> Ajouter
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : data.data.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar user={u} />
                      <div>
                        <p className="font-medium leading-tight">
                          {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    {u.roleName ? (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[u.roleName] ?? "bg-primary/10 text-primary"}`}>
                        {u.roleName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">Aucun rôle</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{format(new Date(u.createdAt), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Modifier le rôle">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteItem(u)}
                        title="Retirer de l'entreprise"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Ajouter un utilisateur */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Ajouter un utilisateur</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); inviteMutation.mutate(); }} className="space-y-4">
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                placeholder="utilisateur@exemple.mr"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prénom</Label>
                <Input
                  value={inviteForm.firstName ?? ""}
                  onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value || null }))}
                  placeholder="Ahmed"
                />
              </div>
              <div>
                <Label>Nom</Label>
                <Input
                  value={inviteForm.lastName ?? ""}
                  onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value || null }))}
                  placeholder="Ould Mohamed"
                />
              </div>
            </div>
            <div>
              <Label>Rôle *</Label>
              <Select
                value={inviteForm.roleId?.toString() || ""}
                onValueChange={v => setInviteForm(f => ({ ...f, roleId: Number(v) }))}
              >
                <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                <SelectContent>
                  {roles?.map(r => (
                    <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={inviteMutation.isPending || !inviteForm.roleId}>
                {inviteMutation.isPending ? "Ajout en cours..." : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Modifier le rôle */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="w-4 h-4" /> Modifier le rôle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {editItem && <Avatar user={editItem} />}
              <div>
                <p className="font-medium">{[editItem?.firstName, editItem?.lastName].filter(Boolean).join(" ") || "—"}</p>
                <p className="text-sm text-muted-foreground">{editItem?.email}</p>
              </div>
            </div>
            <div>
              <Label>Rôle</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun rôle</SelectItem>
                  {roles?.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button
              onClick={() => editItem && updateMutation.mutate({
                id: String(editItem.id),
                roleId: selectedRoleId === "none" ? null : Number(selectedRoleId),
              })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "En cours..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirmer suppression */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer l'utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteItem?.email}</strong> sera retiré de l'entreprise et perdra tout accès. Cette action ne supprime pas le compte utilisateur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteItem && deleteMutation.mutate(String(deleteItem.id))}
            >
              {deleteMutation.isPending ? "Suppression..." : "Retirer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
