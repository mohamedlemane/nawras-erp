import { useState } from "react";
import { useListLeaveRequests } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function LeavesList() {
  const [status, setStatus] = useState<string>("all");
  const { data, isLoading } = useListLeaveRequests({ query: { queryKey: ["leaves", { status }] } });

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Congés</h1>
          <p className="text-muted-foreground mt-2">Demandes de congés et absences</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> Nouvelle Demande</Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex gap-4 items-center">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="approved">Approuvé</SelectItem>
                <SelectItem value="rejected">Refusé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date Début</TableHead>
                <TableHead>Date Fin</TableHead>
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
              ) : (
                data.data.map(leave => (
                  <TableRow key={leave.id}>
                    <TableCell className="font-medium">{leave.employeeName}</TableCell>
                    <TableCell>{leave.leaveTypeName}</TableCell>
                    <TableCell>{format(new Date(leave.startDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{format(new Date(leave.endDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">{leave.daysCount}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(leave.status)}`}>
                        {leave.status === 'pending' ? 'En attente' : leave.status === 'approved' ? 'Approuvé' : 'Refusé'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {leave.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700 hover:bg-green-100">
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-100">
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
