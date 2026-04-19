import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Search, Edit, UserPlus, Mail, KeyRound, Eye, EyeOff, ShieldCheck, Users, UserCheck, UserX } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Role = { id: number; name: string; description: string | null; isSystem: boolean };
type AppUser = {
  id: string; email: string | null; firstName: string | null; lastName: string | null;
  profileImageUrl: string | null; companyId: number; roleId: number | null;
  roleName: string | null; isActive: boolean; createdAt: string; updatedAt: string;
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-800",
  admin: "bg-indigo-100 text-indigo-800",
  manager: "bg-blue-100 text-blue-800",
  comptable: "bg-cyan-100 text-cyan-800",
  rh_manager: "bg-green-100 text-green-800",
  employe: "bg-gray-100 text-gray-700",
};

function Avatar({ user }: { user: AppUser }) {
  const initials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.email?.[0]?.toUpperCase() ?? "?";
  return user.profileImageUrl ? (
    <img src={user.profileImageUrl} alt="" className={`w-9 h-9 rounded-full object-cover ${!user.isActive ? "opacity-50 grayscale" : ""}`} />
  ) : (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${user.isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
      {initials.toUpperCase()}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "••••••••"}
        className="pr-10"
      />
      <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

const EMPTY_INVITE = { email: "", firstName: "", lastName: "", roleId: "", password: "", confirmPassword: "" };

export default function UsersList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editItem, setEditItem] = useState<AppUser | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [toggleItem, setToggleItem] = useState<AppUser | null>(null);
  const [resetItem, setResetItem] = useState<AppUser | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [inviteForm, setInviteForm] = useState({ ...EMPTY_INVITE });
  const [selectedRoleId, setSelectedRoleId] = useState<string>("none");

  const { data, isLoading } = useQuery<{ data: AppUser[]; total: number }>({
    queryKey: ["/api/users", search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (search) params.set("search", search);
      return fetch(`${BASE}/api/users?${params}`, { credentials: "include" }).then(r => r.json());
    },
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
    queryFn: () => fetch(`${BASE}/api/roles`, { credentials: "include" }).then(r => r.json()),
  });

  // Filter out super_admin from selectable roles — only platform superadmin can assign it
  const selectableRoles = roles?.filter(r => r.name !== "super_admin") ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/users"] });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (inviteForm.password && inviteForm.password !== inviteForm.confirmPassword) {
        throw new Error("Les mots de passe ne correspondent pas");
      }
      const body: any = {
        email: inviteForm.email,
        firstName: inviteForm.firstName || null,
        lastName: inviteForm.lastName || null,
        roleId: Number(inviteForm.roleId),
      };
      if (inviteForm.password) body.password = inviteForm.password;
      const r = await fetch(`${BASE}/api/users`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = await r.json();
      if (!r.ok) throw new Error(res.error || "Erreur création");
      return res;
    },
    onSuccess: () => {
      invalidate();
      setInviteOpen(false);
      setInviteForm({ ...EMPTY_INVITE });
      toast({ title: "Utilisateur créé avec succès" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, roleId }: { id: string; roleId: number | null }) =>
      fetch(`${BASE}/api/users/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { invalidate(); setEditOpen(false); setEditItem(null); toast({ title: "Rôle mis à jour" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`${BASE}/api/users/${id}/status`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: (_, vars) => {
      invalidate();
      setToggleItem(null);
      toast({ title: vars.isActive ? "Compte activé" : "Compte désactivé" });
    },
    onError: (e: Error) => { setToggleItem(null); toast({ title: "Erreur", description: e.message, variant: "destructive" }); },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      fetch(`${BASE}/api/users/${id}/reset-password`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { setResetItem(null); setResetPwd(""); toast({ title: "Mot de passe réinitialisé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openEdit = (u: AppUser) => {
    setEditItem(u);
    setSelectedRoleId(u.roleId?.toString() || "none");
    setEditOpen(true);
  };

  const openInvite = () => {
    setInviteForm({ ...EMPTY_INVITE, roleId: selectableRoles[0]?.id?.toString() ?? "" });
    setInviteOpen(true);
  };

  const totalUsers = data?.total ?? 0;
  const activeCount = data?.data?.filter(u => u.isActive).length ?? 0;
  const inactiveCount = data?.data?.filter(u => !u.isActive).length ?? 0;

  return (
    <TooltipProvider>
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
            <CardContent className="pt-4 pb-4 flex items-center gap-4">
              <Users className="w-8 h-8 text-blue-400" />
              <div>
                <div className="text-2xl font-bold text-blue-700">{totalUsers}</div>
                <div className="text-sm text-blue-600">Utilisateurs total</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4 pb-4 flex items-center gap-4">
              <UserCheck className="w-8 h-8 text-green-400" />
              <div>
                <div className="text-2xl font-bold text-green-700">{activeCount}</div>
                <div className="text-sm text-green-600">Comptes actifs</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="pt-4 pb-4 flex items-center gap-4">
              <UserX className="w-8 h-8 text-orange-400" />
              <div>
                <div className="text-2xl font-bold text-orange-700">{inactiveCount}</div>
                <div className="text-sm text-orange-600">Comptes désactivés</div>
              </div>
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
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Ajouté le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-24">Chargement...</TableCell></TableRow>
                ) : !data?.data?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32">
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
                ) : data.data.map(u => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <TableRow key={u.id} className={!u.isActive ? "opacity-60" : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar user={u} />
                          <div>
                            <p className="font-medium leading-tight">
                              {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                              {isSelf && <span className="ml-2 text-xs text-muted-foreground italic">(vous)</span>}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell>
                        {u.roleName ? (
                          <Badge className={`text-xs font-semibold ${ROLE_COLORS[u.roleName] ?? "bg-primary/10 text-primary"}`}>
                            {u.roleName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Aucun rôle</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2.5 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-100 rounded-full px-2.5 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> Désactivé
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(u.createdAt), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* Edit role */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Modifier le rôle</TooltipContent>
                          </Tooltip>

                          {/* Reset password */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => { setResetItem(u); setResetPwd(""); }}
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Réinitialiser le mot de passe</TooltipContent>
                          </Tooltip>

                          {/* Activate / Deactivate */}
                          {!isSelf && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="icon"
                                  className={`h-8 w-8 ${u.isActive ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}`}
                                  onClick={() => setToggleItem(u)}
                                >
                                  {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{u.isActive ? "Désactiver le compte" : "Activer le compte"}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
                  <Input value={inviteForm.firstName} onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Ahmed" />
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input value={inviteForm.lastName} onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Ould Mohamed" />
                </div>
              </div>
              <div>
                <Label>Rôle *</Label>
                <Select value={inviteForm.roleId} onValueChange={v => setInviteForm(f => ({ ...f, roleId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                  <SelectContent>
                    {selectableRoles.map(r => (
                      <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Le rôle <strong>super_admin</strong> est réservé à l'administrateur de la plateforme.</p>
              </div>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Mot de passe initial (recommandé)</p>
                <div>
                  <Label>Mot de passe</Label>
                  <PasswordInput value={inviteForm.password} onChange={v => setInviteForm(f => ({ ...f, password: v }))} placeholder="Min. 6 caractères" />
                </div>
                <div>
                  <Label>Confirmer le mot de passe</Label>
                  <PasswordInput value={inviteForm.confirmPassword} onChange={v => setInviteForm(f => ({ ...f, confirmPassword: v }))} placeholder="Répéter le mot de passe" />
                </div>
                {inviteForm.password && inviteForm.confirmPassword && inviteForm.password !== inviteForm.confirmPassword && (
                  <p className="text-xs text-destructive">Les mots de passe ne correspondent pas</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={inviteMutation.isPending || !inviteForm.roleId}>
                  {inviteMutation.isPending ? "Création..." : "Créer l'utilisateur"}
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
                    {selectableRoles.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
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

        {/* Dialog: Réinitialiser mot de passe */}
        <Dialog open={!!resetItem} onOpenChange={open => { if (!open) { setResetItem(null); setResetPwd(""); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-amber-600" /> Réinitialiser le mot de passe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                {resetItem && <Avatar user={resetItem} />}
                <div>
                  <p className="font-medium">{[resetItem?.firstName, resetItem?.lastName].filter(Boolean).join(" ") || "—"}</p>
                  <p className="text-sm text-muted-foreground">{resetItem?.email}</p>
                </div>
              </div>
              <div>
                <Label>Nouveau mot de passe *</Label>
                <PasswordInput value={resetPwd} onChange={setResetPwd} placeholder="Min. 6 caractères" />
              </div>
              {resetPwd.length > 0 && resetPwd.length < 6 && (
                <p className="text-xs text-destructive">Le mot de passe doit avoir au moins 6 caractères</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setResetItem(null); setResetPwd(""); }}>Annuler</Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700"
                disabled={resetPwd.length < 6 || resetPasswordMutation.isPending}
                onClick={() => resetItem && resetPasswordMutation.mutate({ id: String(resetItem.id), password: resetPwd })}
              >
                {resetPasswordMutation.isPending ? "Réinitialisation..." : "Confirmer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AlertDialog: Confirmer activation / désactivation */}
        <AlertDialog open={!!toggleItem} onOpenChange={() => setToggleItem(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {toggleItem?.isActive ? "Désactiver ce compte ?" : "Activer ce compte ?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {toggleItem?.isActive ? (
                  <>
                    <strong>{toggleItem?.email}</strong> ne pourra plus se connecter à l'application. Vous pourrez le réactiver à tout moment.
                  </>
                ) : (
                  <>
                    <strong>{toggleItem?.email}</strong> pourra à nouveau se connecter à l'application.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className={toggleItem?.isActive
                  ? "bg-orange-600 text-white hover:bg-orange-700"
                  : "bg-green-600 text-white hover:bg-green-700"}
                onClick={() => toggleItem && statusMutation.mutate({ id: String(toggleItem.id), isActive: !toggleItem.isActive })}
              >
                {statusMutation.isPending ? "En cours..." : toggleItem?.isActive ? "Désactiver" : "Activer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
