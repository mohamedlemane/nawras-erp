import { useState } from "react";
import ReactSelect from "react-select";
import { rsClassNames, rsPortalStyles } from "@/lib/rs-styles";
import { useListLeaveRequests, useListEmployees, useListLeaveTypes, createLeaveRequest, updateLeaveRequest } from "@workspace/api-client-react";
import type { CreateLeaveRequestBody } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { Plus, CheckCircle, XCircle, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const statusBadge = (s: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'En attente', cls: 'bg-yellow-100 text-yellow-700' },
    approved:  { label: 'Approuvé',   cls: 'bg-green-100 text-green-700' },
    rejected:  { label: 'Refusé',     cls: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Annulé',     cls: 'bg-gray-100 text-gray-700' },
  };
  return map[s] || { label: s, cls: 'bg-gray-100 text-gray-700' };
};

const emptyForm = (): CreateLeaveRequestBody => ({
  employeeId: 0, leaveTypeId: 0,
  startDate: format(new Date(), 'yyyy-MM-dd'),
  endDate: format(new Date(), 'yyyy-MM-dd'),
  reason: null,
});

export default function LeavesList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [form, setForm] = useState<CreateLeaveRequestBody>(emptyForm());

  const { data, isLoading } = useListLeaveRequests(status !== "all" ? { status } as any : undefined);
  const rows = data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paginated = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const { data: employeesData } = useListEmployees();
  const { data: leaveTypes } = useListLeaveTypes();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });

  const createMutation = useMutation({
    mutationFn: (data: CreateLeaveRequestBody) => createLeaveRequest(data),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Demande créée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateLeaveRequestBody> }) =>
      updateLeaveRequest(id, data as any),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Congé mis à jour" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => updateLeaveRequest(id, { status: 'approved' }),
    onSuccess: () => { invalidate(); toast({ title: "Demande approuvée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => updateLeaveRequest(id, { status: 'rejected' }),
    onSuccess: () => { invalidate(); toast({ title: "Demande refusée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (leave: any) => {
    setEditItem(leave);
    setForm({
      employeeId: leave.employeeId,
      leaveTypeId: leave.leaveTypeId,
      startDate: leave.startDate,
      endDate: leave.endDate,
      reason: leave.reason ?? null,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId || !form.leaveTypeId) return;
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Congés</h1>
          <p className="text-muted-foreground mt-2">Demandes de congés et absences</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Nouvelle Demande</Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="approved">Approuvé</SelectItem>
              <SelectItem value="rejected">Refusé</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead className="text-right">Jours</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">Aucune demande trouvée</TableCell></TableRow>
              ) : paginated.map(leave => {
                const badge = statusBadge(leave.status);
                return (
                  <TableRow key={leave.id}>
                    <TableCell className="font-medium">{leave.employeeName}</TableCell>
                    <TableCell>{leave.leaveTypeName}</TableCell>
                    <TableCell>{format(new Date(leave.startDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{format(new Date(leave.endDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">{leave.daysCount}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-muted-foreground text-sm">
                      {leave.reason || <span className="italic">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="icon"
                          title="Modifier"
                          onClick={() => openEdit(leave)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {leave.status === 'pending' && (
                          <>
                            <Button variant="ghost" size="icon" className="text-green-600 hover:bg-green-50" onClick={() => approveMutation.mutate(leave.id)} disabled={approveMutation.isPending}>
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50" onClick={() => rejectMutation.mutate(leave.id)} disabled={rejectMutation.isPending}>
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination page={page} totalPages={totalPages} total={rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* Dialog création / édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? "Modifier la demande de congé" : "Nouvelle demande de congé"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Employé *</Label>
              <ReactSelect
                unstyled classNames={rsClassNames} styles={rsPortalStyles}
                placeholder="Rechercher un employé..."
                noOptionsMessage={() => "Aucun employé trouvé"}
                options={employeesData?.data?.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName}` })) ?? []}
                value={form.employeeId
                  ? { value: form.employeeId, label: (() => { const e = employeesData?.data?.find(e => e.id === form.employeeId); return e ? `${e.firstName} ${e.lastName}` : ""; })() }
                  : null}
                onChange={opt => setForm(f => ({ ...f, employeeId: opt ? opt.value : 0 }))}
              />
            </div>
            <div>
              <Label>Type de congé *</Label>
              <Select value={form.leaveTypeId?.toString() || ""} onValueChange={v => setForm(f => ({ ...f, leaveTypeId: Number(v) }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                <SelectContent>
                  {leaveTypes?.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date de début *</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required /></div>
              <div><Label>Date de fin *</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required /></div>
            </div>
            <div>
              <Label>Motif</Label>
              <Textarea value={form.reason ?? ""} onChange={e => setForm(f => ({ ...f, reason: e.target.value || null }))} rows={3} />
            </div>
            {editItem && (
              <div>
                <Label>Statut</Label>
                <Select value={(form as any).status || editItem.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="approved">Approuvé</SelectItem>
                    <SelectItem value="rejected">Refusé</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={pending || !form.employeeId || !form.leaveTypeId}>
                {pending ? "En cours..." : editItem ? "Mettre à jour" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
