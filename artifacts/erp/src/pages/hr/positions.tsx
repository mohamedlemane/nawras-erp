import { useListPositions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

export default function PositionsList() {
  const { data: positions, isLoading } = useListPositions({ query: { queryKey: ["positions"] } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Postes</h1>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> Nouveau Poste</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={2} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !positions?.length ? (
                <TableRow><TableCell colSpan={2} className="text-center h-24 text-muted-foreground">Aucun poste</TableCell></TableRow>
              ) : (
                positions.map(pos => (
                  <TableRow key={pos.id}>
                    <TableCell className="font-medium">{pos.name}</TableCell>
                    <TableCell>{pos.description || '-'}</TableCell>
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
