import { useParams, Link } from "wouter";
import { useGetPartner } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit } from "lucide-react";

export default function PartnerDetail() {
  const { id } = useParams();
  const { data: partner, isLoading } = useGetPartner(Number(id), { query: { enabled: !!id, queryKey: ["partner", id] } });

  if (isLoading) return <div>Chargement...</div>;
  if (!partner) return <div>Partenaire introuvable</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/billing/partners"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{partner.name}</h1>
            <p className="text-muted-foreground mt-1">Détails du partenaire</p>
          </div>
        </div>
        <Button variant="outline"><Edit className="w-4 h-4 mr-2" /> Modifier</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Type</span>
              <p className="font-medium">{partner.type}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Entreprise</span>
              <p className="font-medium">{partner.companyName || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Personne de contact</span>
              <p className="font-medium">{partner.contactPerson || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">NIF</span>
              <p className="font-medium">{partner.taxNumber || '-'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contact & Adresse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Email</span>
              <p className="font-medium">{partner.email || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Téléphone</span>
              <p className="font-medium">{partner.phone || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Adresse</span>
              <p className="font-medium">{partner.address || '-'}, {partner.city || '-'}, {partner.country || '-'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
