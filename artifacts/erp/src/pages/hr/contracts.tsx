import { useState } from "react";
import { useListContracts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { format } from "date-fns";

export default function ContractsList() {
  const { data, isLoading } = useListContracts({ query: { queryKey: ["contracts"] } });

  const formatCurrency = (val: number) => new Intl.NumberFormat('fr-MR', { style: 'currency', currency: 'MRU' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contrats</h1>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> Nouveau Contrat</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
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
              ) : (
                data.data.map(contract => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.employeeName}</TableCell>
                    <TableCell className="uppercase">{contract.contractType}</TableCell>
                    <TableCell>{format(new Date(contract.startDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{contract.endDate ? format(new Date(contract.endDate), 'dd/MM/yyyy') : '-'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(contract.salary)}</TableCell>
                    <TableCell><span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">{contract.status}</span></TableCell>
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
