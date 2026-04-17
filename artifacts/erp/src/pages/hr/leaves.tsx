import { useState } from "react";
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
import { Plus, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const statusBadge = (s: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'En attente', cls: 'bg-yellow-100 text-yellow-700' },
    approved: { label: 'Approuvé', cls: 'bg-green-100 text-green-700' },
    rejected: { label: 'Refusé', cls: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Annulé', cls: 'bg-gray-100 text-gray-700' },
  };
  return map[s] || { label: s, cls: 'bg-gray-100 text-gray-700' };
};

export default function LeavesList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateLeaveRequestBody>({
    employeeId: 0, leaveTypeId: 0,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'), reason: null,
  });

  const { data, isLoading } = useListLeaveRequests(status !== "all" ? { status } as any : undefined);
  const { data: employeesData } = useListEmployees();
  const { data: leaveTypes } = useListLeaveTypes();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });

  const createMutation = useMutation({
    mutationFn: (data: CreateLeaveRequestBody) => createLeaveRequest(data),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Demande créée" }); },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Congés</h1>
          <p className="text-muted-foreground mt-2">Demandes de congés et absences</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nouvelle Demande</Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <Select value={status} onValueChange={setStatus}>
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
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Aucune demande trouvée</TableCell></TableRow>
              ) : data.data.map(leave => {
                const badge = statusBadge(leave.status);
                return (
                  <TableRow key={leave.id}>
                    <TableCell className="font-medium">{leave.employeeName}</TableCell>
                    <TableCell>{leave.leaveTypeName}</TableCell>
                    <TableCell>{format(new Date(leave.startDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{format(new Date(leave.endDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">{leave.daysCount}</TableCell>
                    <TableCell><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.label}</span></TableCell>
                    <TableCell className="text-right">
                      {leave.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="text-green-600 hover:bg-green-50" onClick={() => approveMutation.mutate(leave.id)} disabled={approveMutation.isPending}><CheckCircle className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50" onClick={() => rejectMutation.mutate(leave.id)} disabled={rejectMutation.isPending}><XCircle className="w-4 h-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle demande de congé</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div>
              <Label>Employé *</Label>
              <Select value={form.employeeId?.toString() || ""} onValueChange={v => setForm(f => ({ ...f, employeeId: Number(v) }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un employé" /></SelectTrigger>
                <SelectContent>{employeesData?.data?.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type de congé *</Label>
              <Select value={form.leaveTypeId?.toString() || ""} onValueChange={v => setForm(f => ({ ...f, leaveTypeId: Number(v) }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                <SelectContent>{leaveTypes?.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date de début *</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required /></div>
              <div><Label>Date de fin *</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required /></div>
            </div>
            <div><Label>Motif</Label><Textarea value={form.reason ?? ""} onChange={e => setForm(f => ({ ...f, reason: e.target.value || null }))} rows={3} /></div>
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
