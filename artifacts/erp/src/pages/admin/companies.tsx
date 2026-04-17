import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useListCompanies, createCompany } from "@workspace/api-client-react";
import type { Company, CreateCompanyBody } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building, Plus, Edit, Phone, Mail, MapPin, Globe } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type CompanyForm = Partial<CreateCompanyBody & { status: string }>;

const EMPTY: CompanyForm = {
  name: "", legalName: null, taxNumber: null, registrationNumber: null,
  email: null, phone: null, address: null, city: null, country: "Mauritanie",
};

async function patchCompany(id: number, data: CompanyForm) {
  const r = await fetch(`${BASE}/api/companies/${id}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || "Erreur mise à jour");
  return body as Company;
}

function FormFields({ data, onChange }: { data: CompanyForm; onChange: (f: CompanyForm) => void }) {
  const set = (k: keyof CompanyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...data, [k]: e.target.value || null });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Label>Nom commercial *</Label>
        <Input value={data.name ?? ""} onChange={e => onChange({ ...data, name: e.target.value })} required placeholder="Ex: Société XYZ" />
      </div>
      <div className="col-span-2">
        <Label>Raison sociale</Label>
        <Input value={data.legalName ?? ""} onChange={set("legalName")} placeholder="Nom légal complet" />
      </div>
      <div>
        <Label>NIF</Label>
        <Input value={data.taxNumber ?? ""} onChange={set("taxNumber")} placeholder="Numéro identif. fiscal" />
      </div>
      <div>
        <Label>N° RC</Label>
        <Input value={data.registrationNumber ?? ""} onChange={set("registrationNumber")} placeholder="Registre du commerce" />
      </div>
      <div>
        <Label><Mail className="w-3 h-3 inline mr-1" />Email</Label>
        <Input type="email" value={data.email ?? ""} onChange={set("email")} placeholder="contact@exemple.mr" />
      </div>
      <div>
        <Label><Phone className="w-3 h-3 inline mr-1" />Téléphone</Label>
        <Input value={data.phone ?? ""} onChange={set("phone")} placeholder="+222 XX XX XX XX" />
      </div>
      <div className="col-span-2">
        <Label><MapPin className="w-3 h-3 inline mr-1" />Adresse</Label>
        <Input value={data.address ?? ""} onChange={set("address")} placeholder="Rue, quartier..." />
      </div>
      <div>
        <Label>Ville</Label>
        <Input value={data.city ?? ""} onChange={set("city")} placeholder="Nouakchott" />
      </div>
      <div>
        <Label><Globe className="w-3 h-3 inline mr-1" />Pays</Label>
        <Input value={data.country ?? ""} onChange={set("country")} placeholder="Mauritanie" />
      </div>
    </div>
  );
}

export default function CompaniesList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY);
  const [editForm, setEditForm] = useState<CompanyForm>({});

  const { data: companies, isLoading } = useListCompanies({ query: { queryKey: ["companies"] } });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["companies"] });

  const createMutation = useMutation({
    mutationFn: () => createCompany(form as CreateCompanyBody),
    onSuccess: () => { invalidate(); setCreateOpen(false); setForm(EMPTY); toast({ title: "Entreprise créée avec succès" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => patchCompany(editItem!.id, editForm),
    onSuccess: () => { invalidate(); setEditOpen(false); setEditItem(null); toast({ title: "Entreprise mise à jour" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: (c: Company) => patchCompany(c.id, { status: c.status === "active" ? "inactive" : "active" }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openEdit = (c: Company) => {
    setEditItem(c);
    setEditForm({
      name: c.name, legalName: c.legalName, taxNumber: c.taxNumber,
      registrationNumber: c.registrationNumber, email: c.email, phone: c.phone,
      address: c.address, city: c.city, country: c.country,
    });
    setEditOpen(true);
  };

  const active = companies?.filter(c => c.status === "active").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Entreprises</h1>
          <p className="text-muted-foreground mt-2">Gérez les entreprises enregistrées dans le système</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setCreateOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nouvelle Entreprise
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-blue-700">{companies?.length ?? 0}</div>
            <div className="text-sm text-blue-600">Total entreprises</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-green-700">{active}</div>
            <div className="text-sm text-green-600">Actives</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-gray-700">{(companies?.length ?? 0) - active}</div>
            <div className="text-sm text-gray-600">Inactives</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>NIF / RC</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !companies?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Building className="w-8 h-8 opacity-30" />
                      <p>Aucune entreprise enregistrée</p>
                      <Button size="sm" variant="outline" onClick={() => { setForm(EMPTY); setCreateOpen(true); }}>
                        <Plus className="w-3 h-3 mr-1" /> Ajouter
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : companies.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {c.logo
                          ? <img src={c.logo} alt="" className="w-full h-full object-cover" />
                          : <Building className="w-4 h-4 text-primary" />}
                      </div>
                      <div>
                        <p className="font-medium leading-tight">{c.name}</p>
                        {c.legalName && <p className="text-xs text-muted-foreground">{c.legalName}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {c.taxNumber && <div>NIF : <span className="font-mono">{c.taxNumber}</span></div>}
                      {c.registrationNumber && <div className="text-muted-foreground">RC : {c.registrationNumber}</div>}
                      {!c.taxNumber && !c.registrationNumber && <span className="text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {c.email && <div>{c.email}</div>}
                      {c.phone && <div className="text-muted-foreground">{c.phone}</div>}
                      {!c.email && !c.phone && <span className="text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{c.city || "—"}</TableCell>
                  <TableCell className="text-sm">{format(new Date(c.createdAt), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleStatus.mutate(c)}
                      disabled={toggleStatus.isPending}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-75 cursor-pointer ${
                        c.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {c.status === "active" ? "Active" : "Inactive"}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Créer */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building className="w-5 h-5" /> Nouvelle Entreprise</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <FormFields data={form} onChange={setForm} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Création..." : "Créer l'entreprise"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sheet Modifier */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle className="flex items-center gap-2"><Edit className="w-5 h-5" /> Modifier — {editItem?.name}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 px-6 py-4">
            <form onSubmit={e => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4">
              <FormFields data={editForm} onChange={setEditForm} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
