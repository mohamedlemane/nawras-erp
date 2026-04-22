import { useParams, Link } from "wouter";
import { useGetEmployee } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Mail, Phone, MapPin, Building2, Calendar, ShieldAlert, CreditCard } from "lucide-react";
import { format } from "date-fns";

export default function EmployeeDetail() {
  const { id } = useParams();
  const { data: employee, isLoading } = useGetEmployee(Number(id), { query: { enabled: !!id, queryKey: ["employee", id] } });

  if (isLoading) return <div>Chargement...</div>;
  if (!employee) return <div>Employé introuvable</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/hr/employees"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{employee.firstName} {employee.lastName}</h1>
              <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-mono">{employee.employeeCode}</span>
            </div>
            <p className="text-muted-foreground mt-1">{employee.positionName} - {employee.departmentName}</p>
          </div>
        </div>
        <Button variant="outline"><Edit className="w-4 h-4 mr-2" /> Modifier</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle>Contact & Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{employee.email || '-'}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{employee.phone || '-'}</span>
            </div>
            {(employee as any).nni && (
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono text-sm">NNI : {(employee as any).nni}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{employee.address || '-'}</span>
            </div>
            <hr className="my-2" />
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span>{employee.departmentName || '-'}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>Embauche: {format(new Date(employee.hireDate), 'dd/MM/yyyy')}</span>
            </div>
            {employee.emergencyContact && (
              <>
                <hr className="my-2" />
                <div className="flex items-start gap-3 text-sm">
                  <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-destructive">Contact d'urgence</span>
                    <span>{employee.emergencyContact}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          <Tabs defaultValue="contracts" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
              <TabsTrigger value="contracts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Contrats</TabsTrigger>
              <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Documents</TabsTrigger>
            </TabsList>
            
            <TabsContent value="contracts" className="pt-4">
              <Card>
                <CardContent className="p-0">
                  {employee.contracts?.length ? (
                    <div className="divide-y">
                      {employee.contracts.map(contract => (
                        <div key={contract.id} className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{contract.contractType.toUpperCase()}</p>
                            <p className="text-sm text-muted-foreground">Du {format(new Date(contract.startDate), 'dd/MM/yyyy')} {contract.endDate ? `au ${format(new Date(contract.endDate), 'dd/MM/yyyy')}` : ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{new Intl.NumberFormat('fr-MR', { style: 'currency', currency: 'MRU' }).format(contract.salary)}</p>
                            <span className="text-xs text-muted-foreground">{contract.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="p-8 text-center text-muted-foreground">Aucun contrat</div>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="pt-4">
              <Card>
                <CardContent className="p-0">
                  {employee.documents?.length ? (
                    <div className="divide-y">
                      {employee.documents.map(doc => (
                        <div key={doc.id} className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">{doc.documentType}</p>
                          </div>
                          <Button variant="ghost" size="sm">Voir</Button>
                        </div>
                      ))}
                    </div>
                  ) : <div className="p-8 text-center text-muted-foreground">Aucun document</div>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
