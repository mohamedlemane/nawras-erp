import { useState } from "react";
import ReactSelect from "react-select";
import { rsClassNames, rsPortalStyles } from "@/lib/rs-styles";
import { useListEmployees, useListDepartments, useListPositions, createEmployee, updateEmployee } from "@workspace/api-client-react";
import type { CreateEmployeeBody, Employee } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const emptyForm = (): CreateEmployeeBody => ({
  firstName: "", lastName: "", gender: null, birthDate: null, phone: null,
  email: null, address: null, hireDate: format(new Date(), 'yyyy-MM-dd'),
  departmentId: null, positionId: null, managerId: null, notes: null, emergencyContact: null,
});

export default function EmployeesList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editItem, setEditItem] = useState<Employee | null>(null);
  const [form, setForm] = useState<CreateEmployeeBody>(emptyForm());

  const { data, isLoading } = useListEmployees({ search } as any);
  const { data: departments } = useListDepartments();
  const { data: positions } = useListPositions();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/employees"] });

  const createMutation = useMutation({
    mutationFn: (data: CreateEmployeeBody) => createEmployee(data),
    onSuccess: () => { invalidate(); setSheetOpen(false); toast({ title: "Employé créé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateEmployeeBody }) => updateEmployee(id, data),
    onSuccess: () => { invalidate(); setSheetOpen(false); toast({ title: "Employé mis à jour" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditItem(null); setForm(emptyForm()); setSheetOpen(true); };
  const openEdit = (emp: Employee) => {
    setEditItem(emp);
    setForm({
      firstName: emp.firstName, lastName: emp.lastName, gender: emp.gender ?? null,
      birthDate: emp.birthDate ?? null, phone: emp.phone ?? null, email: emp.email ?? null,
      address: emp.address ?? null, hireDate: emp.hireDate, departmentId: emp.departmentId ?? null,
      positionId: emp.positionId ?? null, managerId: emp.managerId ?? null, notes: null, emergencyContact: null,
    });
    setSheetOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editItem ? updateMutation.mutate({ id: editItem.id, data: form }) : createMutation.mutate(form);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'on_leave': return 'bg-yellow-100 text-yellow-700';
      case 'terminated': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };
  const statusLabel = (s: string) => ({ active: 'Actif', on_leave: 'En congé', terminated: 'Terminé' }[s] || s);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employés</h1>
          <p className="text-muted-foreground mt-2">Gérez les ressources humaines</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Nouvel Employé</Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher un employé..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Département</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Date d'embauche</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Aucun employé trouvé</TableCell></TableRow>
              ) : data.data.map(emp => (
                <TableRow key={emp.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs">{emp.employeeCode}</TableCell>
                  <TableCell className="font-medium">{emp.firstName} {emp.lastName}</TableCell>
                  <TableCell>{emp.departmentName || '-'}</TableCell>
                  <TableCell>{emp.positionName || '-'}</TableCell>
                  <TableCell>{format(new Date(emp.hireDate), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(emp.employmentStatus)}`}>
                      {statusLabel(emp.employmentStatus)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/hr/employees/${emp.id}`}><Eye className="w-4 h-4" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editItem ? "Modifier l'employé" : "Nouvel employé"}</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Prénom *</Label><Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required /></div>
              <div><Label>Nom *</Label><Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Genre</Label>
                <Select value={form.gender || "none"} onValueChange={v => setForm(f => ({ ...f, gender: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non précisé</SelectItem>
                    <SelectItem value="male">Homme</SelectItem>
                    <SelectItem value="female">Femme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date de naissance</Label><Input type="date" value={form.birthDate ?? ""} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value || null }))} /></div>
            </div>
            <div><Label>Date d'embauche *</Label><Input type="date" value={form.hireDate} onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Téléphone</Label><Input value={form.phone ?? ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value || null }))} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value || null }))} /></div>
            </div>
            <div>
              <Label>Département</Label>
              <ReactSelect
                unstyled
                classNames={rsClassNames}
                styles={rsPortalStyles}
                isClearable
                placeholder="Rechercher un département..."
                noOptionsMessage={() => "Aucun département trouvé"}
                options={departments?.map(d => ({ value: d.id, label: d.name })) ?? []}
                value={form.departmentId ? { value: form.departmentId, label: departments?.find(d => d.id === form.departmentId)?.name ?? "" } : null}
                onChange={opt => setForm(f => ({ ...f, departmentId: opt ? opt.value : null }))}
              />
            </div>
            <div>
              <Label>Poste</Label>
              <ReactSelect
                unstyled
                classNames={rsClassNames}
                styles={rsPortalStyles}
                isClearable
                placeholder="Rechercher un poste..."
                noOptionsMessage={() => "Aucun poste trouvé"}
                options={positions?.map(p => ({ value: p.id, label: p.name })) ?? []}
                value={form.positionId ? { value: form.positionId, label: positions?.find(p => p.id === form.positionId)?.name ?? "" } : null}
                onChange={opt => setForm(f => ({ ...f, positionId: opt ? opt.value : null }))}
              />
            </div>
            <div><Label>Adresse</Label><Input value={form.address ?? ""} onChange={e => setForm(f => ({ ...f, address: e.target.value || null }))} /></div>
            <div><Label>Contact d'urgence</Label><Input value={form.emergencyContact ?? ""} onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value || null }))} /></div>
            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "En cours..." : editItem ? "Modifier" : "Créer"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
