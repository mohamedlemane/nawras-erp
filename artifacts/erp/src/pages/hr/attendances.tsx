import { useState } from "react";
import { useListAttendances, useListEmployees, createAttendance, updateAttendance } from "@workspace/api-client-react";
import type { CreateAttendanceBody, CreateAttendanceBodyStatus, Attendance } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  present: 'bg-green-100 text-green-700', absent: 'bg-red-100 text-red-700',
  late: 'bg-yellow-100 text-yellow-700', half_day: 'bg-blue-100 text-blue-700',
  holiday: 'bg-purple-100 text-purple-700',
};
const statusLabels: Record<string, string> = {
  present: 'Présent', absent: 'Absent', late: 'En retard', half_day: 'Demi-journée', holiday: 'Congé',
};

export default function AttendancesList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Attendance | null>(null);
  const [form, setForm] = useState<CreateAttendanceBody>({
    employeeId: 0, date: format(new Date(), 'yyyy-MM-dd'),
    checkIn: null, checkOut: null, status: 'present' as CreateAttendanceBodyStatus, notes: null,
  });

  const { data, isLoading } = useListAttendances({ date: dateStr } as any);
  const { data: employeesData } = useListEmployees();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/attendances"] });

  const createMutation = useMutation({
    mutationFn: (data: CreateAttendanceBody) => createAttendance(data),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Présence enregistrée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateAttendanceBody> }) => updateAttendance(id, data),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Présence mise à jour" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditItem(null);
    setForm({ employeeId: 0, date: dateStr, checkIn: null, checkOut: null, status: 'present' as CreateAttendanceBodyStatus, notes: null });
    setDialogOpen(true);
  };

  const openEdit = (att: Attendance) => {
    setEditItem(att);
    setForm({ employeeId: att.employeeId, date: att.date, checkIn: att.checkIn ?? null, checkOut: att.checkOut ?? null, status: att.status as CreateAttendanceBodyStatus, notes: att.notes ?? null });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editItem ? updateMutation.mutate({ id: editItem.id, data: form }) : createMutation.mutate(form);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Présences</h1>
          <p className="text-muted-foreground mt-1">Pointage des employés</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Pointer</Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <Input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className="w-[200px]" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Arrivée</TableHead>
                <TableHead>Départ</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Aucune présence pour cette date</TableCell></TableRow>
              ) : data.data.map(att => (
                <TableRow key={att.id}>
                  <TableCell className="font-medium">{att.employeeName}</TableCell>
                  <TableCell>{format(new Date(att.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{att.checkIn || '-'}</TableCell>
                  <TableCell>{att.checkOut || '-'}</TableCell>
                  <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[att.status] || 'bg-gray-100 text-gray-700'}`}>{statusLabels[att.status] || att.status}</span></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(att)}><Pencil className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "Modifier la présence" : "Enregistrer une présence"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editItem && (
              <div>
                <Label>Employé *</Label>
                <Select value={form.employeeId?.toString() || ""} onValueChange={v => setForm(f => ({ ...f, employeeId: Number(v) }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un employé" /></SelectTrigger>
                  <SelectContent>{employeesData?.data?.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required /></div>
            <div>
              <Label>Statut *</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as CreateAttendanceBodyStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Heure d'arrivée</Label><Input type="time" value={form.checkIn ?? ""} onChange={e => setForm(f => ({ ...f, checkIn: e.target.value || null }))} /></div>
              <div><Label>Heure de départ</Label><Input type="time" value={form.checkOut ?? ""} onChange={e => setForm(f => ({ ...f, checkOut: e.target.value || null }))} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))} rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "En cours..." : editItem ? "Modifier" : "Enregistrer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
