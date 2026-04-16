import { useState } from "react";
import { useListAttendances } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { format } from "date-fns";

export default function AttendancesList() {
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data, isLoading } = useListAttendances({ query: { queryKey: ["attendances", { date: dateStr }] } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Présences</h1>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> Pointer</Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex gap-4 items-center">
            <Input 
              type="date" 
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-[200px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Heure d'arrivée</TableHead>
                <TableHead>Heure de départ</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Aucune présence trouvée pour cette date</TableCell></TableRow>
              ) : (
                data.data.map(att => (
                  <TableRow key={att.id}>
                    <TableCell className="font-medium">{att.employeeName}</TableCell>
                    <TableCell>{format(new Date(att.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{att.checkIn ? format(new Date(att.checkIn), 'HH:mm') : '-'}</TableCell>
                    <TableCell>{att.checkOut ? format(new Date(att.checkOut), 'HH:mm') : '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        att.status === 'present' ? 'bg-green-100 text-green-700' :
                        att.status === 'absent' ? 'bg-red-100 text-red-700' :
                        att.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {att.status}
                      </span>
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
