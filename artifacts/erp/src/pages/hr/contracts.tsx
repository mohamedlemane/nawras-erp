import { useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
import ReactSelect from "react-select";
import { rsClassNames, rsPortalStyles } from "@/lib/rs-styles";
import { useListContracts, useListEmployees, createContract } from "@workspace/api-client-react";
import type { CreateContractBody, CreateContractBodyContractType } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const contractTypeLabels: Record<string, string> = {
  cdi: 'CDI', cdd: 'CDD', interim: 'Intérim', internship: 'Stage', freelance: 'Freelance',
};
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700', expired: 'bg-red-100 text-red-700',
  terminated: 'bg-gray-100 text-gray-700',
};

export default function ContractsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListContracts();
  const { data: employeesData } = useListEmployees();
  const rows = data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paginated = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateContractBody>({
    employeeId: 0, contractType: 'cdi' as CreateContractBodyContractType,
    startDate: format(new Date(), 'yyyy-MM-dd'), endDate: null, salary: 0,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });

  const createMutation = useMutation({
    mutationFn: (data: CreateContractBody) => createContract(data),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Contrat créé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const { formatCurrency } = useCurrency();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contrats</h1>
          <p className="text-muted-foreground mt-1">Contrats de travail des employés</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nouveau Contrat</Button>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employé</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date Début</TableHead>
              <TableHead>Date Fin</TableHead>
              <TableHead className="text-right">Salaire</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24">Chargement...</TableCell></TableRow>
            ) : !data?.data?.length ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Aucun contrat</TableCell></TableRow>
            ) : paginated.map(contract => (
              <TableRow key={contract.id}>
                <TableCell className="font-medium">{contract.employeeName}</TableCell>
                <TableCell><span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">{contractTypeLabels[contract.contractType] || contract.contractType}</span></TableCell>
                <TableCell>{format(new Date(contract.startDate), 'dd/MM/yyyy')}</TableCell>
                <TableCell>{contract.endDate ? format(new Date(contract.endDate), 'dd/MM/yyyy') : 'Indéterminé'}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(contract.salary)}</TableCell>
                <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[contract.status] || 'bg-gray-100 text-gray-700'}`}>{contract.status}</span></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination page={page} totalPages={totalPages} total={rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau contrat</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Employé *</Label>
              <ReactSelect
                unstyled
                classNames={rsClassNames}
                styles={rsPortalStyles}
                placeholder="Rechercher un employé..."
                noOptionsMessage={() => "Aucun employé trouvé"}
                options={employeesData?.data?.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })) ?? []}
                value={form.employeeId ? { value: form.employeeId, label: employeesData?.data?.find(e => e.id === form.employeeId) ? `${employeesData.data.find(e => e.id === form.employeeId)!.firstName} ${employeesData.data.find(e => e.id === form.employeeId)!.lastName}` : "" } : null}
                onChange={opt => setForm(f => ({ ...f, employeeId: opt ? opt.value : 0 }))}
              />
            </div>
            <div>
              <Label>Type de contrat *</Label>
              <Select value={form.contractType} onValueChange={v => setForm(f => ({ ...f, contractType: v as CreateContractBodyContractType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(contractTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date de début *</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required /></div>
              <div><Label>Date de fin</Label><Input type="date" value={form.endDate ?? ""} onChange={e => setForm(f => ({ ...f, endDate: e.target.value || null }))} /></div>
            </div>
            <div><Label>Salaire (MRU) *</Label><Input type="number" min="0" step="1" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: Number(e.target.value) }))} required /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "En cours..." : "Créer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
