import { useState } from "react";
import { useListProformas } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye } from "lucide-react";
import { format } from "date-fns";

export default function ProformasList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const { data, isLoading } = useListProformas({ query: { queryKey: ["proformas", { search, status }] } });

  const formatCurrency = (val: number) => new Intl.NumberFormat('fr-MR', { style: 'currency', currency: 'MRU' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proformas</h1>
          <p className="text-muted-foreground mt-2">Gérez vos factures proforma</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> Nouvelle Proforma</Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Rechercher..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : !data?.data?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Aucune proforma trouvée</TableCell></TableRow>
              ) : (
                data.data.map(proforma => (
                  <TableRow key={proforma.id}>
                    <TableCell className="font-medium">{proforma.proformaNumber}</TableCell>
                    <TableCell>{proforma.partnerName}</TableCell>
                    <TableCell>{format(new Date(proforma.issueDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(proforma.total)}</TableCell>
                    <TableCell><span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-800">{proforma.status}</span></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/billing/proformas/${proforma.id}`}><Eye className="w-4 h-4" /></Link>
                      </Button>
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
