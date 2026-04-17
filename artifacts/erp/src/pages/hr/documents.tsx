import { useState } from "react";
import { useListEmployeeDocuments, useListEmployees, createEmployeeDocument } from "@workspace/api-client-react";
import type { CreateEmployeeDocumentBody, CreateEmployeeDocumentBodyDocumentType } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const docTypeLabels: Record<string, string> = {
  contract: 'Contrat', id_card: 'Carte d\'identité', diploma: 'Diplôme', medical: 'Médical', other: 'Autre',
};

export default function EmployeeDocumentsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateEmployeeDocumentBody>({
    employeeId: 0, title: "", fileUrl: null, documentType: 'other' as CreateEmployeeDocumentBodyDocumentType,
  });

  const { data, isLoading } = useListEmployeeDocuments();
  const { data: employeesData } = useListEmployees();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/employee-documents"] });

  const createMutation = useMutation({
    mutationFn: (data: CreateEmployeeDocumentBody) => createEmployeeDocument(data),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Document ajouté" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-2">Dossiers et documents des employés</p>
        </div>
        <Button onClick={() => { setForm({ employeeId: 0, title: "", fileUrl: null, documentType: 'other' as CreateEmployeeDocumentBodyDocumentType }); setDialogOpen(true); }}>
          <Upload className="w-4 h-4 mr-2" /> Ajouter Document
        </Button>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date d'ajout</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center h-24">Chargement...</TableCell></TableRow>
            ) : !data?.data?.length ? (
              <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Aucun document trouvé</TableCell></TableRow>
            ) : data.data.map(doc => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" />{doc.title}</div>
                </TableCell>
                <TableCell><span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{docTypeLabels[doc.documentType] || doc.documentType}</span></TableCell>
                <TableCell>{format(new Date(doc.createdAt), 'dd/MM/yyyy')}</TableCell>
                <TableCell className="text-right">
                  {doc.fileUrl && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un document</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div>
              <Label>Employé *</Label>
              <Select value={form.employeeId?.toString() || ""} onValueChange={v => setForm(f => ({ ...f, employeeId: Number(v) }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un employé" /></SelectTrigger>
                <SelectContent>{employeesData?.data?.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Titre *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
            <div>
              <Label>Type de document *</Label>
              <Select value={form.documentType} onValueChange={v => setForm(f => ({ ...f, documentType: v as CreateEmployeeDocumentBodyDocumentType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(docTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>URL du fichier</Label><Input type="url" value={form.fileUrl ?? ""} onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value || null }))} placeholder="https://..." /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "En cours..." : "Ajouter"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
